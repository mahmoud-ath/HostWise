"""
Maintenance API — database status, optimization, logs, and data reset.
"""
import os
import sqlite3
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import delete, func, select

from app.backup_service import get_db_path, list_backups

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


def _integrity_check(db: Path) -> str:
    """Run SQLite quick_check; return 'ok', 'error', or 'unavailable'."""
    if not db:
        return "unavailable"
    try:
        conn = sqlite3.connect(str(db), timeout=3)
        try:
            row = conn.execute("PRAGMA quick_check").fetchone()
            return "ok" if row and row[0] == "ok" else "error"
        finally:
            conn.close()
    except sqlite3.Error:
        return "unavailable"


def _find_log_file() -> Path | None:
    """Locate the backend log file if one is being written."""
    candidates: list[str] = []
    env = os.environ.get("HOSTWISE_LOG_FILE")
    if env:
        candidates.append(env)
    backend_root = Path(__file__).resolve().parent.parent
    candidates.extend([
        "hostwise.log",
        "logs/hostwise.log",
        "log/hostwise.log",
        str(backend_root / "hostwise.log"),
        str(backend_root / "logs" / "hostwise.log"),
    ])
    for c in candidates:
        p = Path(c)
        if p.exists():
            return p
    return None


@router.get("/status")
async def maintenance_status() -> dict:
    """Database + storage overview for the Maintenance section."""
    from app.core.config import get_settings

    db = get_db_path()
    backups = list_backups()
    cfg = get_settings()
    security = {
        "environment": cfg.ENVIRONMENT,
        "cors_origins": list(cfg.CORS_ORIGINS),
        "cors_restricted": "*" not in cfg.CORS_ORIGINS,
        "default_jwt_secret": cfg.JWT_SECRET_KEY.startswith("change-me"),
    }
    # Verify the newest backup (if any) so the Maintenance screen can surface
    # a broken backup before the user needs to restore it.
    backup_verified = None
    if backups:
        backup_verified = _verify_backup_file(backups[0]["name"])
    return {
        "database_type": "sqlite",
        "database_path": str(db) if db else None,
        "database_size": db.stat().st_size if db else 0,
        "backup_count": len(backups),
        "backups_size": sum(b["size"] for b in backups),
        "log_file_available": _find_log_file() is not None,
        "integrity": _integrity_check(db),
        "security": security,
        "latest_backup_verified": backup_verified,
    }


def _verify_backup_file(name: str) -> dict:
    """Integrity-check a backup file without importing the service (no cycles)."""
    from app import backup_service

    return backup_service.verify_backup(name)


@router.post("/optimize")
async def optimize_database() -> dict:
    """Run VACUUM to reclaim disk space from deleted rows."""
    db = get_db_path()
    if not db:
        raise HTTPException(status_code=404, detail="No database found")

    import sqlite3

    before = db.stat().st_size
    try:
        conn = sqlite3.connect(str(db), timeout=5)
        try:
            conn.execute("VACUUM")
        finally:
            conn.close()
    except sqlite3.OperationalError as exc:
        return {
            "ok": False,
            "message": f"Database is busy — try again when idle. ({exc})",
            "before": before,
            "after": before,
            "freed": 0,
        }

    after = db.stat().st_size
    return {
        "ok": True,
        "message": "Database optimized",
        "before": before,
        "after": after,
        "freed": max(0, before - after),
    }


@router.get("/logs")
async def get_logs(lines: int = Query(200, ge=10, le=2000)) -> dict:
    """Return the tail of the backend log file."""
    log_file = _find_log_file()
    if not log_file:
        return {"available": False, "content": "", "path": None}
    try:
        content = log_file.read_text(errors="replace")
        tail = "\n".join(content.splitlines()[-lines:])
        return {"available": True, "content": tail, "path": str(log_file)}
    except OSError as exc:  # pragma: no cover
        return {
            "available": True,
            "content": f"Error reading log: {exc}",
            "path": str(log_file),
        }


# Models with soft-delete support (children first so FK constraints never block).
# Each table is purged defensively (per-table try/except) so a locked/referenced
# row is skipped and reported instead of failing the whole cleanup.
def _cleanup_models():
    from app.finance.category_models import ExpenseCategory, RevenueCategory
    from app.finance.models import Expense, Revenue
    from app.notifications.models import Notification
    from app.properties.models import Listing, Property
    from app.reservations.models import Guest, Reservation
    return (
        Notification, Expense, Revenue, Guest, Listing,
        Reservation, ExpenseCategory, RevenueCategory, Property,
    )


@router.post("/cleanup")
async def cleanup_soft_deleted(days: int = Query(30, ge=0, le=3650)) -> dict:
    """Permanently purge soft-deleted rows older than `days`.

    Deletes (not soft-deletes) rows whose `is_deleted` is true and whose
    `deleted_at` is older than the cutoff. Children are purged before parents;
    if a row is still referenced and the delete fails, that table is skipped
    and reported so the operation never corrupts the database.
    """
    from datetime import datetime, timedelta

    from app.core.database import async_session_factory

    cutoff = datetime.utcnow() - timedelta(days=days)
    purged: dict[str, int] = {}
    skipped: dict[str, str] = {}
    async with async_session_factory() as session:
        for model in _cleanup_models():
            table = model.__tablename__
            try:
                count = (
                    await session.execute(
                        select(func.count()).select_from(model).where(
                            model.is_deleted == True,
                            model.deleted_at < cutoff,
                        )
                    )
                ).scalar() or 0
                if not count:
                    continue
                await session.execute(
                    delete(model).where(
                        model.is_deleted == True,
                        model.deleted_at < cutoff,
                    )
                )
                purged[table] = int(count)
            except Exception as exc:  # noqa: BLE001 - a referenced row is skipped, not fatal
                skipped[table] = str(exc)[:200]
                await session.rollback()
        await session.commit()
    return {
        "purged": purged,
        "skipped": skipped,
        "cutoff": cutoff.isoformat(),
        "days": days,
    }


@router.post("/reset-demo-data")
async def reset_demo_data() -> dict:
    """Delete transactional demo data (revenues, expenses, reservations)."""
    from app.core.database import async_session_factory
    from app.finance.models import Expense, Revenue
    from app.notifications.models import Notification
    from app.reservations.models import Reservation

    deleted: dict[str, int] = {}
    async with async_session_factory() as session:
        for model in (Revenue, Expense, Reservation, Notification):
            table = model.__tablename__
            count = (await session.execute(
                select(func.count(model.id))
            )).scalar() or 0
            await session.execute(delete(model))
            deleted[table] = int(count)
        await session.commit()
    return {"deleted": deleted}


@router.post("/reset-all-data")
async def reset_all_data() -> dict:
    """Delete ALL business data (properties, reservations, revenues, expenses,
    categories) while keeping the schema, settings, and users.

    This is the scripted equivalent of `clean_db.py` (default mode) exposed as
    a maintenance action for the desktop app.
    """
    from app.core.database import async_session_factory
    from app.finance.category_models import ExpenseCategory, RevenueCategory
    from app.finance.models import Expense, Revenue
    from app.notifications.models import Notification
    from app.properties.models import Listing, Property
    from app.reservations.models import Guest, Reservation

    # Children before parents so FK constraints never block the delete.
    models = (
        Reservation, Revenue, Expense, Guest, Listing,
        Property, ExpenseCategory, RevenueCategory, Notification,
    )
    deleted: dict[str, int] = {}
    async with async_session_factory() as session:
        for model in models:
            table = model.__tablename__
            count = (await session.execute(
                select(func.count(model.id))
            )).scalar() or 0
            await session.execute(delete(model))
            deleted[table] = int(count)
        await session.commit()
    return {"deleted": deleted}
