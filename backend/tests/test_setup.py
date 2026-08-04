"""Tests for the first-run setup (profile onboarding, no auth)."""


async def test_initialize_with_profile(client):
    resp = await client.post(
        "/api/v1/setup/initialize",
        json={"name": "Alex Owner", "email": "alex@example.com"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "initialized"
    assert data["profile"]["name"] == "Alex Owner"
    assert data["profile"]["email"] == "alex@example.com"

    # Profile is persisted as settings
    settings = (await client.get("/api/v1/settings")).json()
    assert settings["profile_name"] == "Alex Owner"
    assert settings["profile_email"] == "alex@example.com"


async def test_initialize_empty_body(client):
    """Calling initialize with no body must not crash (empty payload)."""
    resp = await client.post("/api/v1/setup/initialize")
    assert resp.status_code == 200
    assert resp.json()["status"] == "initialized"


async def test_initialize_partial_profile(client):
    resp = await client.post(
        "/api/v1/setup/initialize",
        json={"name": "Only Name"},
    )
    assert resp.status_code == 200
    assert resp.json()["profile"]["name"] == "Only Name"
