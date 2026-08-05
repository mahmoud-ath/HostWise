"""Tests for expense/revenue category management (create/rename/merge/delete)."""


async def _create_category(client, name, kind="expense"):
    path = "expense" if kind == "expense" else "revenue"
    resp = await client.post(f"/api/v1/finance/{path}-categories", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_category_and_reject_duplicate(client):
    cat = await _create_category(client, "Cleaning")
    assert cat["name"] == "Cleaning"

    # Case-insensitive duplicate → 422
    dup = await client.post("/api/v1/finance/expense-categories", json={"name": "cleaning"})
    assert dup.status_code == 422

    cats = (await client.get("/api/v1/finance/expense-categories")).json()
    assert len(cats) == 1


async def test_rename_category(client):
    cat = await _create_category(client, "Maintenance")
    resp = await client.patch(
        f"/api/v1/finance/expense-categories/{cat['id']}",
        json={"name": "Repairs & Maintenance"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Repairs & Maintenance"


async def test_merge_and_delete_category(client, seed_property):
    a = await _create_category(client, "Cleaning")
    b = await _create_category(client, "Housekeeping")

    # Attach one expense to category A.
    exp = await client.post(
        "/api/v1/finance/expense",
        json={
            "property_id": seed_property,
            "date": "2025-06-12",
            "amount": 120.0,
            "currency": "EUR",
            "category_id": a["id"],
        },
    )
    assert exp.status_code == 201, exp.text

    # Count is surfaced on the category list.
    cats = (await client.get("/api/v1/finance/expense-categories")).json()
    by_name = {c["name"]: c for c in cats}
    assert by_name["Cleaning"]["expense_count"] == 1

    # Merge A into B → A disappears, B now holds the expense.
    resp = await client.post(
        f"/api/v1/finance/expense-categories/{a['id']}/merge",
        json={"target_id": b["id"]},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Housekeeping"
    cats = (await client.get("/api/v1/finance/expense-categories")).json()
    assert [c["name"] for c in cats] == ["Housekeeping"]
    assert cats[0]["expense_count"] == 1

    # Delete B → the expense falls back to "Uncategorized" (category_id NULL).
    resp = await client.delete(f"/api/v1/finance/expense-categories/{b['id']}")
    assert resp.status_code == 200
    assert (await client.get("/api/v1/finance/expense-categories")).json() == []
    expenses = (await client.get("/api/v1/finance/expense")).json()
    assert expenses[0]["category_id"] is None


async def test_revenue_categories_create_rename(client):
    cat = await _create_category(client, "Short Stay", kind="revenue")
    assert cat["name"] == "Short Stay"

    resp = await client.patch(
        f"/api/v1/finance/revenue-categories/{cat['id']}",
        json={"name": "Short Stays"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["name"] == "Short Stays"


async def test_expense_description_auto_creates_category(client, seed_property):
    # No category chosen → the description becomes the category.
    exp = await client.post(
        "/api/v1/finance/expense",
        json={
            "property_id": seed_property,
            "date": "2025-06-12",
            "amount": 90.0,
            "currency": "EUR",
            "description": "Pool Cleaning",
        },
    )
    assert exp.status_code == 201, exp.text
    assert exp.json()["category_id"] is not None

    cats = (await client.get("/api/v1/finance/expense-categories")).json()
    assert [c["name"] for c in cats] == ["Pool Cleaning"]
    assert cats[0]["expense_count"] == 1

    # Same description (case-insensitive) reuses the existing category.
    exp2 = await client.post(
        "/api/v1/finance/expense",
        json={
            "property_id": seed_property,
            "date": "2025-06-13",
            "amount": 10.0,
            "currency": "EUR",
            "description": "pool cleaning",
        },
    )
    assert exp2.status_code == 201, exp2.text
    assert exp2.json()["category_id"] == exp.json()["category_id"]
    cats = (await client.get("/api/v1/finance/expense-categories")).json()
    assert len(cats) == 1
    assert cats[0]["expense_count"] == 2


async def test_revenue_description_auto_creates_category(client, seed_property):
    rev = await client.post(
        "/api/v1/finance/revenue",
        json={
            "property_id": seed_property,
            "date": "2025-06-10",
            "gross_amount": 500.0,
            "commission_amount": 50.0,
            "source": "manual",
            "currency": "EUR",
            "description": "Early Check-in Fee",
        },
    )
    assert rev.status_code == 201, rev.text
    assert rev.json()["category_id"] is not None

    cats = (await client.get("/api/v1/finance/revenue-categories")).json()
    assert [c["name"] for c in cats] == ["Early Check-in Fee"]
    assert cats[0]["revenue_count"] == 1
