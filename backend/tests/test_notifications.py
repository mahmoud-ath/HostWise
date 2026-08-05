"""Tests for the in-app notifications engine (roadmap 3.5)."""
from datetime import date, timedelta


def _month_bounds():
    today = date.today()
    cur_first = today.replace(day=1)
    prev = cur_first - timedelta(days=1)
    return prev.year, prev.month, today.year, today.month


async def _add_revenue(client, property_id, year, month, day, gross, comm=0):
    resp = await client.post(
        "/api/v1/finance/revenue",
        json={
            "property_id": property_id,
            "date": f"{year:04d}-{month:02d}-{day:02d}",
            "gross_amount": gross,
            "commission_amount": comm,
            "source": "manual",
            "currency": "EUR",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_profit_drop_notification(client, seed_property):
    py, pm, cy, cm = _month_bounds()
    # Previous month strong, current month weaker → profit drops.
    await _add_revenue(client, seed_property, py, pm, 15, 2000, 200)
    await _add_revenue(client, seed_property, cy, cm, 5, 1000, 100)

    resp = await client.post("/api/v1/notifications/refresh")
    assert resp.status_code == 200
    body = resp.json()
    assert body["created"] >= 1
    assert body["unread"] >= 1

    listing = (await client.get("/api/v1/notifications")).json()
    assert any(n["type"] == "profit_drop" for n in listing["notifications"])
    assert listing["unread"] == body["unread"]

    # Idempotent — re-refresh creates nothing new.
    again = (await client.post("/api/v1/notifications/refresh")).json()
    assert again["created"] == 0
    assert again["total"] == body["total"]


async def test_revenue_increase_notification(client, seed_property):
    py, pm, cy, cm = _month_bounds()
    await _add_revenue(client, seed_property, py, pm, 15, 500, 50)
    await _add_revenue(client, seed_property, cy, cm, 5, 1000, 100)

    await client.post("/api/v1/notifications/refresh")
    listing = (await client.get("/api/v1/notifications")).json()
    assert any(n["type"] == "revenue_increase" for n in listing["notifications"])


async def test_mark_read_and_read_all(client, seed_property):
    py, pm, cy, cm = _month_bounds()
    await _add_revenue(client, seed_property, py, pm, 15, 2000, 200)
    await _add_revenue(client, seed_property, cy, cm, 5, 1000, 100)
    await client.post("/api/v1/notifications/refresh")

    listing = (await client.get("/api/v1/notifications")).json()
    nid = listing["notifications"][0]["id"]
    marked = (await client.post(f"/api/v1/notifications/{nid}/read")).json()
    assert marked["updated"] is True

    summary = (await client.get("/api/v1/notifications/summary")).json()
    assert summary["unread"] == listing["unread"] - 1

    # read-all marks the remaining unread (listing["unread"] - 1).
    all_read = (await client.post("/api/v1/notifications/read-all")).json()
    assert all_read["updated"] == listing["unread"] - 1
    assert (await client.get("/api/v1/notifications/summary")).json()["unread"] == 0


async def test_clear_all(client, seed_property):
    py, pm, cy, cm = _month_bounds()
    await _add_revenue(client, seed_property, py, pm, 15, 2000, 200)
    await _add_revenue(client, seed_property, cy, cm, 5, 1000, 100)
    await client.post("/api/v1/notifications/refresh")

    resp = await client.delete("/api/v1/notifications")
    assert resp.status_code == 200
    assert resp.json()["deleted"] >= 1
    assert (await client.get("/api/v1/notifications")).json()["notifications"] == []


async def test_disabled_notifications_generate_nothing(client, seed_property):
    py, pm, cy, cm = _month_bounds()
    await _add_revenue(client, seed_property, py, pm, 15, 2000, 200)
    await _add_revenue(client, seed_property, cy, cm, 5, 1000, 100)

    await client.put("/api/v1/settings", json={"settings": {
        "notify_profit_drops": False,
        "notify_revenue_increase": False,
        "notify_occupancy_falls": False,
        "notify_backup_completed": False,
        "notify_monthly_report": False,
        "report_auto_generate": "off",
    }})

    body = (await client.post("/api/v1/notifications/refresh")).json()
    assert body["created"] == 0
    assert body["total"] == 0
