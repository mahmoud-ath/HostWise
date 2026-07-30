"""Backup and restore API endpoints."""
import logging
from fastapi import APIRouter, HTTPException
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


@router.post("/create")
async def create_backup():
    """Create an on-demand backup."""
    backup = backup_service.create_backup("manual")
    if not backup:
        raise HTTPException(status_code=500, detail="Failed to create backup")
    return {"message": "Backup created", "path": str(backup)}


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
    backup_service._get_backup_dir()
    backup_path = backup_service._get_backup_dir() / backup_name
    if backup_path.exists():
        backup_path.unlink()
        return {"message": "Backup deleted"}
    raise HTTPException(status_code=404, detail="Backup not found")
