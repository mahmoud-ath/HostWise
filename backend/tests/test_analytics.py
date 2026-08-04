"""Tests for analytics: portfolio/property analytics and health score.

Verifies the occupancy/ADR/RevPAR metrics were fully removed.
"""
from datetime import date

YEAR = date.today().year


async def _seed(client, seed_property):
    await client.post(
        "/api/v1/finance/revenue",
        json={"property_id": seed_property, "date": f"{YEAR}-06-10",
              "gross_amount": 1000.0, "commission_amount": 150.0, "source": "airbnb"},
    )
    await client.post(
        "/api/v1/finance/revenue",
        json={"property_id": seed_property, "date": f"{YEAR}-07-05",
              "gross_amount": 800.0, "commission_amount": 100.0, "source": "booking"},
    )
    await client.post(
        "/api/v1/finance/expense",
        json={"property_id": seed_property, "date": f"{YEAR}-06-12",
              "amount": 300.0, "description": "Cleaning"},
    )


async def test_portfolio_analytics_no_occupancy(client, seed_property):
    await _seed(client, seed_property)
    resp = await client.get(f"/api/v1/analytics/portfolio?year={YEAR}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["property_count"] == 1
    assert body["gross_revenue"] > 0
    # Occupancy/ADR/RevPAR must NOT be present
    for key in ("occupancy_rate", "adr", "revpar", "avg_daily_rate", "occupancy"):
        assert key not in body, f"removed metric '{key}' still present in portfolio analytics"


async def test_property_analytics_no_occupancy(client, seed_property):
    await _seed(client, seed_property)
    resp = await client.get(f"/api/v1/analytics/property/{seed_property}?year={YEAR}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["net_revenue"] > 0
    for key in ("occupancy_rate", "adr", "revpar", "occupancy"):
        assert key not in body, f"removed metric '{key}' still present in property analytics"


async def test_property_health_score(client, seed_property):
    await _seed(client, seed_property)
    resp = await client.get(f"/api/v1/analytics/property/{seed_property}/health")
    assert resp.status_code == 200
    body = resp.json()
    assert 0 <= body["health_score"] <= 100
    # Health uses profit-focused inputs, not occupancy
    assert "occupancy_rate" not in body
    assert "profit_margin" in body
    assert "net_revenue" in body
    assert "target_annual_revenue" in body


async def test_health_score_empty_property(client, seed_property):
    resp = await client.get(f"/api/v1/analytics/property/{seed_property}/health")
    assert resp.status_code == 200
    body = resp.json()
    # Baseline score with no data (no negative penalties)
    assert 0 <= body["health_score"] <= 100
