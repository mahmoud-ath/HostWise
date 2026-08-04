"""
Connectors Module — Router
"""
import asyncio
import os

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.connectors.base import ConnectorRegistry
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
