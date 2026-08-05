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


async def test_portfolio_report_health_no_data_when_empty(client):
    """With an empty database the portfolio report shows 'no data', not 50/100."""
    resp = await client.get(f"/api/v1/reports/portfolio?year={YEAR}")
    assert resp.status_code == 200
    body = resp.json()
    health = body["portfolio_health"]
    assert health["status"] == "no_data"
    assert health["score"] is None
    assert body["executive_summary"]["portfolio_health_score"] is None


async def test_property_health_no_data_when_empty(client, seed_property):
    """A property with no financial activity shows 'no data', not a fake 70."""
    resp = await client.get(f"/api/v1/analytics/property/{seed_property}/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "no_data"
    assert body["health_score"] is None


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
    # No financial activity → "no data" (not a fabricated baseline score)
    assert body["status"] == "no_data"
    assert body["health_score"] is None
