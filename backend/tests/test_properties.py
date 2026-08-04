"""Tests for property CRUD (auth-free)."""


async def test_create_property(client):
    resp = await client.post(
        "/api/v1/properties",
        json={
            "name": "Seaside Studio",
            "city": "Faro",
            "country": "Portugal",
            "bedrooms": 1,
            "bathrooms": 1,
            "max_guests": 2,
            "target_annual_revenue": 30000,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Seaside Studio"
    assert body["target_annual_revenue"] == 30000
    return body["id"]


async def test_list_properties(client):
    await test_create_property(client)
    await test_create_property(client)
    props = (await client.get("/api/v1/properties")).json()
    assert len(props) == 2


async def test_update_property(client):
    pid = await test_create_property(client)
    resp = await client.patch(
        f"/api/v1/properties/{pid}",
        json={"name": "Seaside Studio Deluxe", "max_guests": 4},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Seaside Studio Deluxe"
    assert body["max_guests"] == 4


async def test_delete_property(client):
    pid = await test_create_property(client)
    resp = await client.delete(f"/api/v1/properties/{pid}")
    assert resp.status_code == 204
    # Soft-deleted: no longer returned
    props = (await client.get("/api/v1/properties")).json()
    assert all(p["id"] != pid for p in props)


async def test_get_property_detail(client):
    pid = await test_create_property(client)
    resp = await client.get(f"/api/v1/properties/{pid}")
    assert resp.status_code == 200
    assert resp.json()["id"] == pid


async def test_delete_property_cascades_to_revenues_and_expenses(client):
    """Deleting a property must also remove its linked revenues and expenses."""
    pid = await test_create_property(client)

    # Create a revenue + expense for the property
    rev = await client.post(
        "/api/v1/finance/revenue",
        json={
            "property_id": pid,
            "date": "2026-03-10",
            "gross_amount": 1200.0,
            "commission_amount": 100.0,
            "net_amount": 1100.0,
            "currency": "USD",
        },
    )
    assert rev.status_code == 201, rev.text
    rev_id = rev.json()["id"]

    exp = await client.post(
        "/api/v1/finance/expense",
        json={
            "property_id": pid,
            "date": "2026-03-11",
            "amount": 150.0,
            "currency": "USD",
            "vendor": "Housekeeping",
        },
    )
    assert exp.status_code == 201, exp.text
    exp_id = exp.json()["id"]

    revs = (await client.get("/api/v1/finance/revenue")).json()
    exps = (await client.get("/api/v1/finance/expense")).json()
    assert any(x["id"] == rev_id for x in revs)
    assert any(x["id"] == exp_id for x in exps)

    # Delete the property → related financial records must be soft-deleted too
    resp = await client.delete(f"/api/v1/properties/{pid}")
    assert resp.status_code == 204

    revs = (await client.get("/api/v1/finance/revenue")).json()
    exps = (await client.get("/api/v1/finance/expense")).json()
    assert not any(x["id"] == rev_id for x in revs)
    assert not any(x["id"] == exp_id for x in exps)
