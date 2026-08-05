"""Backup and restore API endpoints."""
import logging
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from . import backup_service

log = logging.getLogger("hostwise.backup")
router = APIRouter(prefix="/backups", tags=["backups"])


class BackupResponse(BaseModel):
    name: str
    size: int
    created: str
    path: str


@router.get("/")
async def list_backups() -> list[BackupResponse]:
    """List all available backups."""
    return backup_service.list_backups()


@router.get("/status")
async def backup_status() -> dict:
    """Backup schedule overview: last backup, next backup, storage."""
    from datetime import datetime, timedelta

    backups = backup_service.list_backups()
    last_backup = None
    if backups:
        last_backup = {
            "name": backups[0]["name"],
            "created": backups[0]["created"],
        }
        next_backup = (
            datetime.fromisoformat(backups[0]["created"]) + timedelta(days=1)
        ).isoformat()
    else:
        next_backup = (datetime.now() + timedelta(days=1)).isoformat()

    return {
        "schedule": "daily",
        "last_backup": last_backup,
        "next_backup": next_backup,
        "backup_count": len(backups),
        "total_size": sum(b["size"] for b in backups),
        "retention": {"daily": 7, "weekly": 4, "monthly": 3},
    }


@router.post("/create")
async def create_backup():
    """Create an on-demand backup."""
    backup = backup_service.create_backup("manual")
    if not backup:
        raise HTTPException(status_code=500, detail="Failed to create backup")
    return {"message": "Backup created", "path": str(backup)}


@router.post("/upload")
async def upload_backup(file: UploadFile = File(...)):
    """Upload a backup file so it can be restored later."""
    if not file.filename or not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="Please upload a .db backup file")
    backup_dir = backup_service._get_backup_dir()
    name = f"hostwise_uploaded_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    content = await file.read()
    (backup_dir / name).write_bytes(content)
    log.info("Backup uploaded: %s", name)
    return {"message": "Backup uploaded", "name": name}


@router.get("/download/{backup_name}")
async def download_backup(backup_name: str):
    """Download a backup file."""
    backup_path = backup_service._get_backup_dir() / backup_name
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="Backup not found")
    return FileResponse(
        path=str(backup_path),
        filename=backup_name,
        media_type="application/octet-stream",
    )


@router.post("/{backup_name}/verify")
async def verify_backup(backup_name: str):
    """Verify a backup file's integrity (SQLite quick_check)."""
    result = backup_service.verify_backup(backup_name)
    if result.get("error") == "Backup not found":
        raise HTTPException(status_code=404, detail="Backup not found")
    return result


@router.post("/restore/{backup_name}")
async def restore_backup(backup_name: str):
    """Restore a backup by filename."""
    success = backup_service.restore_backup(backup_name)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to restore backup")
    return {"message": f"Database restored from {backup_name}"}


@router.delete("/{backup_name}")
async def delete_backup(backup_name: str):
    """Delete a backup by filename."""
    backup_dir = backup_service._get_backup_dir()
    backup_path = backup_dir / backup_name
    if backup_path.exists():
        backup_path.unlink()
        return {"message": "Backup deleted"}
    raise HTTPException(status_code=404, detail="Backup not found")
