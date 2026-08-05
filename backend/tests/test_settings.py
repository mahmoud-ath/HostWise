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


# ── Phase 4: secret masking + base-URL guard ─────────────

async def test_ai_key_masked_and_roundtrip_safe(client):
    """GET /settings masks the API key; saving the mask doesn't clobber it."""
    from app.core.database import async_session_factory
    from app.settings.service import SettingsService

    await client.put("/api/v1/settings", json={"settings": {"ai_api_key": "sk-secret-1234567890abcd"}})

    body = (await client.get("/api/v1/settings")).json()
    assert body["ai_api_key"] != "sk-secret-1234567890abcd"
    assert "••" in body["ai_api_key"]

    # Server-side access still sees the real key.
    async with async_session_factory() as session:
        internal = await SettingsService(session).get_all_internal()
    assert internal["ai_api_key"] == "sk-secret-1234567890abcd"

    # Round-tripping the masked value keeps the real key intact.
    await client.put("/api/v1/settings", json={
        "settings": {"ai_api_key": body["ai_api_key"], "business_name": "Still There"},
    })
    async with async_session_factory() as session:
        internal2 = await SettingsService(session).get_all_internal()
    assert internal2["ai_api_key"] == "sk-secret-1234567890abcd"
    assert (await client.get("/api/v1/settings")).json()["business_name"] == "Still There"

    # Clearing the key (empty string) works.
    await client.put("/api/v1/settings", json={"settings": {"ai_api_key": ""}})
    async with async_session_factory() as session:
        internal3 = await SettingsService(session).get_all_internal()
    assert internal3["ai_api_key"] == ""


async def test_invalid_base_url_rejected(client):
    resp = await client.put(
        "/api/v1/settings",
        json={"settings": {"ai_base_url": "ftp://not-allowed"}},
    )
    assert resp.status_code == 422

    # A valid http(s) URL is accepted.
    ok = await client.put(
        "/api/v1/settings",
        json={"settings": {"ai_base_url": "https://api.deepseek.com/v1"}},
    )
    assert ok.status_code == 200
    assert ok.json()["ai_base_url"] == "https://api.deepseek.com/v1"
