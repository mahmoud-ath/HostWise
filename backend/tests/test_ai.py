"""Tests for the AI Advisor module (rules engine + BYOK paths)."""
from datetime import date
from unittest.mock import patch

YEAR = date.today().year


async def _clear_caches():
    from app.ai.cache import advisor_cache, annual_report_cache
    advisor_cache.clear()
    annual_report_cache.clear()


async def _seed(client, seed_property):
    await client.post(
        "/api/v1/finance/revenue",
        json={"property_id": seed_property, "date": f"{YEAR}-06-10",
              "gross_amount": 1000.0, "commission_amount": 150.0, "source": "airbnb"},
    )
    await client.post(
        "/api/v1/finance/expense",
        json={"property_id": seed_property, "date": f"{YEAR}-06-12",
              "amount": 300.0, "description": "Cleaning"},
    )


async def test_analyze_rules(client, seed_property):
    await _seed(client, seed_property)
    resp = await client.get("/api/v1/ai/analyze")
    assert resp.status_code == 200
    body = resp.json()
    assert "executive_summary" in body
    assert isinstance(body.get("recommendations"), list)
    # No occupancy references in the AI output
    assert "occupancy" not in body["executive_summary"].lower()


async def test_advisor_report(client, seed_property):
    await _seed(client, seed_property)
    resp = await client.get(f"/api/v1/ai/advisor?year={YEAR}")
    assert resp.status_code == 200
    body = resp.json()
    for key in ("health_score", "priority_actions", "opportunities", "risks", "forecast"):
        assert key in body, f"missing advisor key: {key}"
    assert isinstance(body["health_score"], dict)
    assert "score" in body["health_score"] and "status" in body["health_score"]


async def test_chat_rules_mode(client, seed_property):
    await _seed(client, seed_property)
    resp = await client.post(
        "/api/v1/ai/chat",
        json={"question": "How can I increase revenue?", "year": YEAR},
    )
    assert resp.status_code == 200
    body = resp.json()
    # Without a configured API key the advisor falls back to rules mode
    assert body.get("mode") == "rules"
    assert body.get("answer")


async def test_chat_occupancy_question(client, seed_property):
    """Asking about occupancy should explain it is no longer tracked."""
    resp = await client.post(
        "/api/v1/ai/chat",
        json={"question": "What is my occupancy rate?", "year": YEAR},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "occupancy" in body["answer"].lower()


async def test_scenario_simulator(client, seed_property):
    await _seed(client, seed_property)
    resp = await client.post(
        "/api/v1/ai/scenario",
        json={"scenario": "price_increase", "params": {"pct": 10}, "year": YEAR},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "baseline" in body and "projected" in body
    assert body["baseline"]["revenue"] > 0
    assert body["projected"]["revenue"] > body["baseline"]["revenue"]


async def test_scenario_unknown_rejected(client):
    resp = await client.post(
        "/api/v1/ai/scenario",
        json={"scenario": "occupancy_increase", "params": {}, "year": YEAR},
    )
    assert resp.status_code == 400
    assert "occupancy" not in resp.json().get("detail", "")


async def test_test_connection_no_key(client):
    """Without a configured key, the test should fail gracefully (not 500)."""
    resp = await client.post("/api/v1/ai/test-connection")
    assert resp.status_code in (200, 400, 422)
    body = resp.json()
    assert "ok" in body or "error" in body or "detail" in body


# ── Phase 4: caching, strict parsing, config honored ─────

async def test_advisor_served_from_cache(client, seed_property):
    """Two identical calls return the same cached object (roadmap 4.2)."""
    from app.ai.service import AIAdvisorService
    from app.core.database import async_session_factory

    await _seed(client, seed_property)
    await _clear_caches()
    async with async_session_factory() as session:
        svc = AIAdvisorService(session)
        r1 = await svc.generate_advisor_report(year=YEAR)
        r2 = await svc.generate_advisor_report(year=YEAR)
        assert r2 is r1  # identical object → served from cache
        assert r2["provider"] == "hostwise"
    await _clear_caches()


async def test_advisor_cache_invalidated_by_data_change(client, seed_property):
    """A data change bumps the fingerprint, so the cache is bypassed (4.2)."""
    from app.ai.service import AIAdvisorService
    from app.core.database import async_session_factory

    await _seed(client, seed_property)
    await _clear_caches()
    async with async_session_factory() as session:
        svc = AIAdvisorService(session)
        r1 = await svc.generate_advisor_report(year=YEAR)
    # Add another revenue record → fingerprint changes.
    await client.post(
        "/api/v1/finance/revenue",
        json={"property_id": seed_property, "date": f"{YEAR}-07-01",
              "gross_amount": 500.0, "commission_amount": 50.0, "source": "direct"},
    )
    async with async_session_factory() as session:
        svc = AIAdvisorService(session)
        r2 = await svc.generate_advisor_report(year=YEAR)
    assert r2 is not r1  # recomputed, not the stale cached object
    assert r2["current_metrics"]["net_revenue"] != r1["current_metrics"]["net_revenue"]
    await _clear_caches()


async def test_malformed_llm_falls_back_to_rules(client, seed_property):
    """Garbage LLM output must never break the page (roadmap 4.4)."""
    from app.ai.service import AIAdvisorService
    from app.core.database import async_session_factory

    await _seed(client, seed_property)
    await client.put("/api/v1/settings", json={"settings": {
        "ai_provider": "openai", "ai_api_key": "sk-test-123456", "ai_enabled": True,
    }})
    await _clear_caches()
    with patch("app.ai.providers.LLMProvider.call", return_value="this is definitely not json {{{"):
        async with async_session_factory() as session:
            svc = AIAdvisorService(session)
            report = await svc.generate_advisor_report(year=YEAR)
    assert report["provider"] == "hostwise"  # rules fallback
    assert "health_score" in report and "score" in report["health_score"]
    await _clear_caches()


def test_extract_json_handles_fences_and_trailing_commas():
    from app.ai.providers import LLMProvider

    raw = '```json\n{"executive_summary": "Hi there", "health_score": {"score": 72, "status": "good",},}\n```'
    parsed = LLMProvider._extract_json(raw)
    assert parsed == {"executive_summary": "Hi there", "health_score": {"score": 72, "status": "good"}}


def test_extract_json_garbage_returns_none():
    from app.ai.providers import LLMProvider

    assert LLMProvider._extract_json("no json here") is None
    assert LLMProvider._extract_json("") is None
    assert LLMProvider._extract_json(None) is None


async def test_advisor_summary_level_trims(client, seed_property):
    """`ai_analysis_level: summary` trims the report (roadmap 4.1)."""
    await _seed(client, seed_property)
    await client.put("/api/v1/settings", json={"settings": {"ai_analysis_level": "summary"}})
    await _clear_caches()
    resp = await client.get(f"/api/v1/ai/advisor?year={YEAR}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["analysis_level"] == "summary"
    assert body["priority_actions"]["medium"] == []
    assert body["priority_actions"]["low"] == []
    await _clear_caches()


async def test_advisor_health_no_data_when_empty(client):
    """With an empty database the advisor shows 'no data', not fabricated scores."""
    await _clear_caches()
    resp = await client.get(f"/api/v1/ai/advisor?year={YEAR}")
    assert resp.status_code == 200
    health = resp.json()["health_score"]
    assert health["status"] == "no_data"
    assert health["score"] is None
    assert health["components"]["revenue"] is None
    await _clear_caches()
