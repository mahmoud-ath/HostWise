"""
Connectors Module — Router
"""
import asyncio
import os
import uuid

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.base import ConnectorRegistry
from app.connectors.ical import parse_ics
from app.connectors.service import ConnectorService
from app.core.config import get_settings
from app.core.database import get_db

router = APIRouter()

# Guide describing expected columns per import type (also used by the UI).
IMPORT_GUIDE = {
    "reservations": {
        "required": ["property_name", "check_in", "check_out"],
        "optional": ["property_id", "guest_name", "nights", "gross_amount", "status"],
        "notes": "check_in / check_out use the configured date format (default DD/MM/YYYY). Missing properties are created automatically.",
    },
    "revenues": {
        "required": ["property_name", "date", "gross_revenue"],
        "optional": ["property_id", "commission_amount", "net_revenue", "source"],
        "notes": "source can be airbnb, booking, direct or csv. net_revenue defaults to gross minus commission.",
    },
    "expenses": {
        "required": ["property_name", "date", "amount"],
        "optional": ["property_id", "category", "vendor"],
        "notes": "category is stored as the expense description.",
    },
    "ical": {
        "required": ["property_id (in the import request)", ".ics calendar file"],
        "optional": [],
        "notes": "Airbnb / Booking calendar export (.ics). Each VEVENT becomes a reservation: guest name from SUMMARY, check-in/check-out from DTSTART/DTEND. Imported with source 'ical' and zero amounts (link revenue separately via CSV). Re-imports are safe — already-known UIDs are skipped.",
    },
}


@router.get("/guide")
async def get_import_guide():
    """Return the import guide (expected columns per type)."""
    return IMPORT_GUIDE


@router.get("/available")
async def list_connectors():
    """List available data connectors."""
    return {"connectors": ConnectorRegistry.list_available()}


@router.post("/csv/upload")
async def upload_csv(file: UploadFile = File(...)):
    """
    Upload a CSV or JSON file for import.
    Saves the file and returns a preview of detected columns.
    """
    settings = get_settings()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    content = await file.read()
    safe_name = os.path.basename(file.filename or "upload.csv")
    file_path = os.path.join(settings.UPLOAD_DIR, safe_name)

    def _write_file():
        with open(file_path, "wb") as f:
            f.write(content)

    await asyncio.to_thread(_write_file)

    fmt, columns, rows = await asyncio.to_thread(ConnectorService.read_file, file_path)
    return {
        "filename": safe_name,
        "file_path": file_path,
        "format": fmt,
        "columns": columns,
        "preview_rows": rows[:5],
        "row_count_estimate": len(rows),
    }


@router.post("/csv/import")
async def import_csv_data(
    filename: str = Query(..., description="Uploaded filename to import"),
    import_type: str = Query("auto", description="auto, reservations, revenues, or expenses"),
    session: AsyncSession = Depends(get_db),
):
    """
    Import a previously uploaded CSV or JSON file into the database.
    Auto-detects the file type from column names.
    Returns counts of imported rows.
    """
    settings = get_settings()
    file_path = os.path.join(settings.UPLOAD_DIR, os.path.basename(filename))

    if not os.path.exists(file_path):
        return {"error": f"File '{filename}' not found. Upload it first.", "imported": 0}

    service = ConnectorService(session)
    result = await service.import_file(file_path, import_type)

    # Clean up the uploaded file after import
    try:
        os.remove(file_path)
    except OSError:
        pass

    return result


@router.post("/ical/upload")
async def upload_ical(file: UploadFile = File(...)):
    """
    Upload an .ics calendar export (Airbnb / Booking calendar URL, or a
    downloaded .ics file). Saves the file and returns a preview of the
    VEVENT entries it contains.
    """
    settings = get_settings()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    content = await file.read()
    safe_name = os.path.basename(file.filename or "calendar.ics")
    file_path = os.path.join(settings.UPLOAD_DIR, safe_name)

    def _write_file():
        with open(file_path, "wb") as f:
            f.write(content)

    await asyncio.to_thread(_write_file)

    try:
        events = parse_ics(content.decode("utf-8", errors="replace"))
    except Exception as exc:  # noqa: BLE001 - surface parse failures to the UI
        return {
            "filename": safe_name,
            "file_path": file_path,
            "error": f"Could not parse iCal file: {exc}",
            "events": 0,
            "preview_rows": [],
        }
    return {
        "filename": safe_name,
        "file_path": file_path,
        "format": "ics",
        "events": len(events),
        "preview_rows": events[:5],
    }


@router.post("/ical/import")
async def import_ical_data(
    filename: str = Query(..., description="Uploaded .ics filename to import"),
    property_id: uuid.UUID = Query(..., description="Property the calendar belongs to"),
    session: AsyncSession = Depends(get_db),
):
    """
    Import a previously uploaded .ics calendar into reservations for a property.

    Re-importing the same calendar is safe: VEVENTs whose UID already exists
    for that property are skipped.
    """
    settings = get_settings()
    file_path = os.path.join(settings.UPLOAD_DIR, os.path.basename(filename))

    if not os.path.exists(file_path):
        return {"error": f"File '{filename}' not found. Upload it first.", "imported": 0}

    service = ConnectorService(session)
    result = await service.import_ical(file_path, property_id)

    # Clean up the uploaded file after import
    try:
        os.remove(file_path)
    except OSError:
        pass

    return result
