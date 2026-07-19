"""
Connectors Module — Router
"""
from fastapi import APIRouter, Depends, UploadFile, File
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.connectors.base import ConnectorRegistry

router = APIRouter()


@router.get("/available")
async def list_connectors():
    """List available data connectors."""
    return {"connectors": ConnectorRegistry.list_available()}


@router.post("/csv/upload")
async def upload_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a CSV file for import.
    Saves the file and returns a preview of detected columns.
    """
    import csv
    import io
    import os
    from app.core.config import get_settings

    settings = get_settings()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    content = await file.read()
    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)

    with open(file_path, "wb") as f:
        f.write(content)

    # Parse preview
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    columns = reader.fieldnames or []
    rows = [row for _, row in zip(range(5), reader)]

    return {
        "filename": file.filename,
        "file_path": file_path,
        "columns": columns,
        "preview_rows": rows,
        "row_count_estimate": "Preview only — run import to process all rows",
    }
