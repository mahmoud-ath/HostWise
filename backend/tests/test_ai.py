"""Tests for the AI Advisor module (rules engine + BYOK paths)."""
from datetime import date

YEAR = date.today().year


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
