"""
Maintenance API — database status, optimization, logs, and demo data reset.
"""
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import delete, func, select

from app.backup_service import get_db_path, list_backups

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


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
    db = get_db_path()
    backups = list_backups()
    return {
        "database_type": "sqlite",
        "database_path": str(db) if db else None,
        "database_size": db.stat().st_size if db else 0,
        "backup_count": len(backups),
        "backups_size": sum(b["size"] for b in backups),
        "log_file_available": _find_log_file() is not None,
    }


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
    except Exception as exc:  # pragma: no cover
        return {
            "available": True,
            "content": f"Error reading log: {exc}",
            "path": str(log_file),
        }


@router.post("/reset-demo-data")
async def reset_demo_data() -> dict:
    """Delete transactional demo data (revenues, expenses, reservations)."""
    from app.core.database import async_session_factory
    from app.finance.models import Expense, Revenue
    from app.reservations.models import Reservation

    deleted: dict[str, int] = {}
    async with async_session_factory() as session:
        for model in (Revenue, Expense, Reservation):
            table = model.__tablename__
            count = (await session.execute(
                select(func.count(model.id))
            )).scalar() or 0
            await session.execute(delete(model))
            deleted[table] = int(count)
        await session.commit()
    return {"deleted": deleted}
