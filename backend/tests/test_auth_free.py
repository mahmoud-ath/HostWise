"""Verify the product is auth-free: business endpoints work with no token."""
from datetime import date

YEAR = date.today().year


async def test_health_endpoint(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] in ("healthy", "degraded")


async def test_business_endpoints_need_no_auth(client, seed_property):
    # No Authorization header is sent on any of these calls.
    r1 = await client.post(
        "/api/v1/properties",
        json={"name": "No Auth Villa", "city": "Porto"},
    )
    assert r1.status_code == 201

    r2 = await client.post(
        "/api/v1/finance/revenue",
        json={"property_id": seed_property, "date": f"{YEAR}-05-01",
              "gross_amount": 500.0},
    )
    assert r2.status_code == 201

    r3 = await client.post(
        "/api/v1/finance/expense",
        json={"property_id": seed_property, "date": f"{YEAR}-05-02", "amount": 90.0},
    )
    assert r3.status_code == 201

    r4 = await client.get("/api/v1/finance/summary")
    assert r4.status_code == 200

    r5 = await client.get("/api/v1/analytics/portfolio?year=2025")
    assert r5.status_code == 200

    # No 401/403 anywhere
    for r in (r1, r2, r3, r4, r5):
        assert r.status_code < 400


async def test_connector_guide_and_import(client):
    # Guide endpoint is open
    guide = await client.get("/api/v1/connectors/guide")
    assert guide.status_code == 200
    body = guide.json()
    assert "reservations" in body and "revenues" in body and "expenses" in body
