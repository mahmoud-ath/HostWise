"""Tests for the finance module: revenue/expense CRUD + summary + reports."""
from datetime import date


async def _add_revenue(client, property_id, gross=1000.0, when="2025-06-10"):
    resp = await client.post(
        "/api/v1/finance/revenue",
        json={
            "property_id": property_id,
            "date": when,
            "gross_amount": gross,
            "commission_amount": 150.0,
            "source": "manual",
            "currency": "EUR",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _add_expense(client, property_id, amount=200.0, when="2025-06-12"):
    resp = await client.post(
        "/api/v1/finance/expense",
        json={
            "property_id": property_id,
            "date": when,
            "amount": amount,
            "currency": "EUR",
            "description": "Cleaning",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_and_list_revenue_expense(client, seed_property):
    rev = await _add_revenue(client, seed_property)
    assert rev["gross_amount"] == 1000.0
    assert rev["net_amount"] == 850.0  # gross - commission

    exp = await _add_expense(client, seed_property)
    assert exp["amount"] == 200.0

    revenues = (await client.get("/api/v1/finance/revenue")).json()
    expenses = (await client.get("/api/v1/finance/expense")).json()
    assert len(revenues) == 1
    assert len(expenses) == 1


async def test_financial_summary(client, seed_property):
    await _add_revenue(client, seed_property, gross=1000.0)
    await _add_revenue(client, seed_property, gross=500.0)
    await _add_expense(client, seed_property, amount=300.0)

    summary = (await client.get("/api/v1/finance/summary")).json()
    assert summary["gross_revenue"] == 1500.0
    assert summary["net_revenue"] == 1200.0  # (1000+500) - (150+150) commissions
    assert summary["total_expenses"] == 300.0
    assert summary["profit"] == 900.0
    assert summary["property_count"] == 1


async def test_annual_report(client, seed_property):
    await _add_revenue(client, seed_property, gross=1000.0, when="2025-06-10")
    await _add_expense(client, seed_property, amount=200.0, when="2025-06-12")

    report = (await client.get("/api/v1/finance/report/annual?year=2025")).json()
    assert report["year"] == 2025
    assert report["summary"]["gross_revenue"] == 1000.0
    assert report["summary"]["total_expenses"] == 200.0
    assert len(report["monthly_breakdown"]) == 12


async def test_monthly_report(client, seed_property):
    await _add_revenue(client, seed_property, gross=1000.0, when="2025-06-10")
    report = (await client.get("/api/v1/finance/report/monthly?year=2025&month=6")).json()
    assert report["month"] == 6
    assert report["summary"]["gross_revenue"] == 1000.0


async def test_update_and_delete_expense(client, seed_property):
    exp = await _add_expense(client, seed_property, amount=200.0)

    updated = await client.patch(
        f"/api/v1/finance/expense/{exp['id']}",
        json={"amount": 250.0, "description": "Deep clean"},
    )
    assert updated.status_code == 200
    assert updated.json()["amount"] == 250.0

    deleted = await client.delete(f"/api/v1/finance/expense/{exp['id']}")
    assert deleted.status_code == 204
    assert (await client.get("/api/v1/finance/expense")).json() == []


async def test_update_and_delete_revenue(client, seed_property):
    rev = await _add_revenue(client, seed_property, gross=1000.0)

    updated = await client.patch(
        f"/api/v1/finance/revenue/{rev['id']}",
        json={"gross_amount": 1200.0},
    )
    assert updated.status_code == 200
    assert updated.json()["gross_amount"] == 1200.0

    deleted = await client.delete(f"/api/v1/finance/revenue/{rev['id']}")
    assert deleted.status_code == 204
    assert (await client.get("/api/v1/finance/revenue")).json() == []
