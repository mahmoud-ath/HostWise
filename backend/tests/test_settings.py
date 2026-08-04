"""Tests for the settings store, full-data export, and wipe."""


async def test_get_settings_defaults(client):
    resp = await client.get("/api/v1/settings")
    assert resp.status_code == 200
    body = resp.json()
    assert "default_currency" in body
    assert "ai_provider" in body
    assert "profile_name" in body


async def test_update_settings(client):
    resp = await client.put(
        "/api/v1/settings",
        json={"settings": {"default_currency": "GBP", "business_name": "My Rentals"}},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["default_currency"] == "GBP"
    assert body["business_name"] == "My Rentals"

    # Persisted — a fresh GET returns the same values
    body = (await client.get("/api/v1/settings")).json()
    assert body["default_currency"] == "GBP"


async def test_export_all_data(client, seed_property):
    await client.post(
        "/api/v1/finance/revenue",
        json={"property_id": seed_property, "date": "2025-06-10",
              "gross_amount": 1000.0, "commission_amount": 100.0},
    )
    resp = await client.get("/api/v1/settings/export")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/vnd.ms-excel")
    assert "Properties" in resp.text
    assert "Revenue" in resp.text
    assert "Expenses" in resp.text


async def test_wipe_keeps_settings(client, seed_property):
    await client.post(
        "/api/v1/finance/revenue",
        json={"property_id": seed_property, "date": "2025-06-10",
              "gross_amount": 1000.0, "commission_amount": 100.0},
    )
    await client.put("/api/v1/settings", json={"settings": {"business_name": "Keep Me"}})

    resp = await client.post("/api/v1/settings/wipe")
    assert resp.status_code == 200
    deleted = resp.json()["deleted"]
    assert deleted.get("revenues", 0) >= 1
    assert deleted.get("properties", 0) >= 1

    # Settings survive the wipe
    body = (await client.get("/api/v1/settings")).json()
    assert body["business_name"] == "Keep Me"
