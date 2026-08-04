"""
HostWise Automatic Backup Service

Creates automatic SQLite backups with rotation.
- Daily backups (keep 7)
- Weekly backups (keep 4)
- Monthly backups (keep 3)
- On-demand backup/restore API
"""
import os
import shutil
import time
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

log = logging.getLogger("hostwise.backup")


def _get_backup_dir() -> Path:
    """Get the backup directory (next to the database)."""
    data_dir = os.environ.get(
        "HOSTWISE_DATA_DIR",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"),
    )
    backup_dir = Path(data_dir) / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


def get_db_path() -> Optional[Path]:
    """Get the active database path."""
    db_path = os.environ.get("SQLITE_PATH", "")
    if db_path:
        p = Path(db_path)
        if not p.is_absolute():
            p = Path.cwd() / db_path
        if p.exists():
            return p
    # Fallback: check config default
    from app.core.config import get_settings
    settings = get_settings()
    p = Path(settings.SQLITE_PATH)
    if not p.is_absolute():
        p = Path.cwd() / settings.SQLITE_PATH
    if p.exists():
        return p
    return None


def create_backup(label: str = "manual") -> Optional[Path]:
    """Create a backup of the current database."""
    db_path = get_db_path()
    if not db_path:
        log.warning("No database found, skipping backup")
        return None

    backup_dir = _get_backup_dir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"hostwise_{label}_{timestamp}.db"
    backup_path = backup_dir / backup_name

    try:
        # Use shutil.copy2 to preserve metadata
        shutil.copy2(str(db_path), str(backup_path))
        # Vacuum the backup to ensure it's a clean copy
        import sqlite3
        conn = sqlite3.connect(str(backup_path))
        conn.execute("VACUUM")
        conn.close()
        log.info("Backup created: %s (%d bytes)", backup_path, backup_path.stat().st_size)
        return backup_path
    except Exception as e:
        log.error("Failed to create backup: %s", e)
        return None


def list_backups() -> list[dict]:
    """List all available backups."""
    backup_dir = _get_backup_dir()
    backups = []
    for f in sorted(backup_dir.glob("hostwise_*.db"), reverse=True):
        backups.append({
            "name": f.name,
            "size": f.stat().st_size,
            "created": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            "path": str(f),
        })
    return backups


def restore_backup(backup_name: str) -> bool:
    """Restore a backup by name."""
    backup_dir = _get_backup_dir()
    backup_path = backup_dir / backup_name
    if not backup_path.exists():
        log.error("Backup not found: %s", backup_name)
        return False

    db_path = get_db_path()
    if not db_path:
        log.error("No active database to restore to")
        return False

    try:
        # Create a safety backup of current db before restoring
        safety_backup = create_backup("pre_restore")
        log.info("Safety backup created: %s", safety_backup)

        # Restore the backup
        shutil.copy2(str(backup_path), str(db_path))
        log.info("Database restored from: %s", backup_name)
        return True
    except Exception as e:
        log.error("Failed to restore backup: %s", e)
        return False


def rotate_backups():
    """Remove old backups beyond retention limits."""
    backup_dir = _get_backup_dir()
    now = datetime.now()

    daily_keep = 7
    weekly_keep = 4
    monthly_keep = 3

    all_backups = sorted(backup_dir.glob("hostwise_*.db"))

    # Categorize by age
    for backup in all_backups:
        mtime = datetime.fromtimestamp(backup.stat().st_mtime)
        age_days = (now - mtime).days

        # Keep monthly backups (older than 90 days, keep 3)
        if age_days > 90:
            monthly_backups = [b for b in all_backups
                               if datetime.fromtimestamp(b.stat().st_mtime) < (now - timedelta(days=90))]
            monthly_backups.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            for b in monthly_backups[monthly_keep:]:
                b.unlink()
                log.info("Removed old monthly backup: %s", b.name)
            break

        # Keep weekly backups (older than 14 days, keep 4)
        if age_days > 14:
            weekly_backups = [b for b in all_backups
                              if (now - timedelta(days=14)) >= datetime.fromtimestamp(b.stat().st_mtime) >= (now - timedelta(days=90))]
            weekly_backups.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            for b in weekly_backups[weekly_keep:]:
                b.unlink()
                log.info("Removed old weekly backup: %s", b.name)
            break

    # Keep daily backups (last 7 days)
    daily_backups = [b for b in all_backups
                     if datetime.fromtimestamp(b.stat().st_mtime) >= (now - timedelta(days=14))]
    daily_backups.sort(key=lambda x: x.stat().st_mtime, reverse=True)
    for b in daily_backups[daily_keep:]:
        b.unlink()
        log.info("Removed old daily backup: %s", b.name)


def schedule_backup():
    """Create a scheduled backup (called periodically)."""
    backup = create_backup("daily")
    if backup:
        rotate_backups()
    return backup
