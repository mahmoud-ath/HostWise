"""Tests for CSV/JSON import via the connector service layer."""
import io
import json

CSV_REVENUES = (
    "property_name,date,gross_revenue,commission_amount,source\n"
    "Villa Algarve,2025-06-01,1000,150,airbnb\n"
    "Villa Algarve,2025-06-05,800,100,booking\n"
)

JSON_EXPENSES = [
    {"property_name": "Villa Algarve", "date": "2025-06-10", "amount": 120, "category": "Cleaning"},
    {"property_name": "Villa Algarve", "date": "2025-06-12", "amount": 80, "category": "Repairs"},
]


async def _upload(client, content: str, filename: str):
    return await client.post(
        "/api/v1/connectors/csv/upload",
        files={"file": (filename, io.BytesIO(content.encode("utf-8")), "text/csv")},
    )


async def test_csv_upload_preview(client):
    resp = await _upload(client, CSV_REVENUES, "revenues.csv")
    assert resp.status_code == 200
    body = resp.json()
    assert body["format"] == "csv"
    assert "property_name" in body["columns"]
    assert body["row_count_estimate"] == 2


async def test_csv_import_revenues(client):
    uploaded = (await _upload(client, CSV_REVENUES, "revenues.csv")).json()
    resp = await client.post(
        "/api/v1/connectors/csv/import",
        params={"filename": uploaded["filename"], "import_type": "revenues"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["imported"] == 2
    assert body["properties_created"] == 1

    summary = (await client.get("/api/v1/finance/summary")).json()
    assert summary["gross_revenue"] == 1800.0


async def test_json_import_expenses(client):
    payload = json.dumps({"type": "expenses", "rows": JSON_EXPENSES})
    resp = await client.post(
        "/api/v1/connectors/csv/upload",
        files={"file": ("expenses.json", io.BytesIO(payload.encode("utf-8")), "application/json")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["format"] == "json"

    imp = await client.post(
        "/api/v1/connectors/csv/import",
        params={"filename": body["filename"], "import_type": "expenses"},
    )
    assert imp.status_code == 200
    assert imp.json()["imported"] == 2

    expenses = (await client.get("/api/v1/finance/expense")).json()
    assert len(expenses) == 2
    assert all(e["currency"] in ("EUR", "USD") for e in expenses)


async def test_import_missing_file(client):
    resp = await client.post(
        "/api/v1/connectors/csv/import",
        params={"filename": "nope.csv", "import_type": "auto"},
    )
    assert resp.status_code == 200
    assert resp.json()["error"]


async def test_csv_import_idempotent(client):
    """Re-importing the same file skips already-imported rows."""
    first = (await _upload(client, CSV_REVENUES, "revenues.csv")).json()
    r1 = await client.post(
        "/api/v1/connectors/csv/import",
        params={"filename": first["filename"], "import_type": "revenues"},
    )
    assert r1.status_code == 200
    assert r1.json()["imported"] == 2
    assert r1.json()["skipped"] == 0

    second = (await _upload(client, CSV_REVENUES, "revenues.csv")).json()
    r2 = await client.post(
        "/api/v1/connectors/csv/import",
        params={"filename": second["filename"], "import_type": "revenues"},
    )
    assert r2.status_code == 200
    assert r2.json()["imported"] == 0
    assert r2.json()["skipped"] == 2

    summary = (await client.get("/api/v1/finance/summary")).json()
    assert summary["gross_revenue"] == 1800.0  # not doubled


async def test_csv_import_reservations_idempotent_by_confirmation_code(client):
    csv_data = (
        "property_name,reservation_id,check_in,check_out,guest_name,gross_amount\n"
        "Villa Algarve,RES-123,2025-06-01,2025-06-05,Alice,1000\n"
        "Villa Algarve,RES-456,2025-06-06,2025-06-08,Bob,800\n"
    )
    # First pass imports both reservations.
    up = (await _upload(client, csv_data, "res.csv")).json()
    r1 = await client.post(
        "/api/v1/connectors/csv/import",
        params={"filename": up["filename"], "import_type": "reservations"},
    )
    assert r1.status_code == 200
    assert r1.json()["imported"] == 2, r1.json()
    assert r1.json()["skipped"] == 0, r1.json()

    # Second pass with the same confirmation codes → all skipped.
    up2 = (await _upload(client, csv_data, "res.csv")).json()
    r2 = await client.post(
        "/api/v1/connectors/csv/import",
        params={"filename": up2["filename"], "import_type": "reservations"},
    )
    assert r2.status_code == 200
    assert r2.json()["imported"] == 0, r2.json()
    assert r2.json()["skipped"] == 2, r2.json()
    # Only two reservations exist (not four) — the second pass was idempotent.
    from sqlalchemy import func, select

    from app.core.database import async_session_factory
    from app.reservations.models import Reservation

    async with async_session_factory() as session:
        count = (await session.execute(select(func.count()).select_from(Reservation))).scalar_one()
        assert count == 2


ICS_SAMPLE = (
    "BEGIN:VCALENDAR\n"
    "VERSION:2.0\n"
    "PRODID:-//Airbnb//HostWise test//EN\n"
    "BEGIN:VEVENT\n"
    "UID:airbnb-12345@airbnb.com\n"
    "DTSTART;VALUE=DATE:20250601\n"
    "DTEND;VALUE=DATE:20250605\n"
    "SUMMARY:Jane Doe\n"
    "END:VEVENT\n"
    "BEGIN:VEVENT\n"
    "UID:airbnb-67890@airbnb.com\n"
    "DTSTART;TZID=Europe/Lisbon:20250610T140000\n"
    "DTEND;TZID=Europe/Lisbon:20250613T100000\n"
    "SUMMARY:John Smith\n"
    "END:VEVENT\n"
    "END:VCALENDAR\n"
)


async def test_ical_import(client, seed_property):
    up = await client.post(
        "/api/v1/connectors/ical/upload",
        files={"file": ("calendar.ics", io.BytesIO(ICS_SAMPLE.encode("utf-8")), "text/calendar")},
    )
    assert up.status_code == 200, up.text
    body = up.json()
    assert body["format"] == "ics"
    assert body["events"] == 2

    imp = await client.post(
        "/api/v1/connectors/ical/import",
        params={"filename": body["filename"], "property_id": seed_property},
    )
    assert imp.status_code == 200, imp.text
    result = imp.json()
    assert result["imported"] == 2
    assert result["skipped"] == 0
    assert result["errors"] == []

    # Re-importing the same calendar is idempotent (same UIDs → skipped).
    up2 = await client.post(
        "/api/v1/connectors/ical/upload",
        files={"file": ("calendar.ics", io.BytesIO(ICS_SAMPLE.encode("utf-8")), "text/calendar")},
    )
    imp2 = await client.post(
        "/api/v1/connectors/ical/import",
        params={"filename": up2.json()["filename"], "property_id": seed_property},
    )
    assert imp2.json()["imported"] == 0
    assert imp2.json()["skipped"] == 2


async def test_ical_import_requires_existing_property(client):
    up = await client.post(
        "/api/v1/connectors/ical/upload",
        files={"file": ("calendar.ics", io.BytesIO(ICS_SAMPLE.encode("utf-8")), "text/calendar")},
    )
    imp = await client.post(
        "/api/v1/connectors/ical/import",
        params={"filename": up.json()["filename"], "property_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert imp.status_code == 200
    assert imp.json()["errors"] == ["Property not found."]
