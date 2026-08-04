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
