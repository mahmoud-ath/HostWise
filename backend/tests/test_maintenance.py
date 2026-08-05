"""Tests for maintenance operations: soft-delete cleanup and backup verify."""
import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, select, update


async def _add_and_soft_delete(client, property_id, amount, day):
    resp = await client.post(
        "/api/v1/finance/revenue",
        json={"property_id": property_id, "date": f"2025-06-{day:02d}",
              "gross_amount": amount, "commission_amount": amount * 0.1,
              "source": "airbnb"},
    )
    assert resp.status_code == 201, resp.text
    rev_id = resp.json()["id"]
    del_resp = await client.delete(f"/api/v1/finance/revenue/{rev_id}")
    assert del_resp.status_code == 204
    return rev_id


async def test_cleanup_purges_old_soft_deleted(client, seed_property):
    from app.core.database import async_session_factory
    from app.finance.models import Revenue

    rev_id = await _add_and_soft_delete(client, seed_property, 500.0, 10)

    # Backdate its deleted_at so it's older than the retention window.
    old = datetime.utcnow() - timedelta(days=60)
    async with async_session_factory() as session:
        await session.execute(
            update(Revenue).where(Revenue.id == uuid.UUID(rev_id)).values(deleted_at=old)
        )
        await session.commit()

    resp = await client.post("/api/v1/maintenance/cleanup?days=30")
    assert resp.status_code == 200, resp.text
    assert resp.json()["purged"].get("revenues", 0) >= 1

    # The row is permanently gone (not just soft-deleted).
    async with async_session_factory() as session:
        count = (await session.execute(
            select(func.count()).select_from(Revenue).where(Revenue.id == uuid.UUID(rev_id))
        )).scalar()
    assert count == 0


async def test_cleanup_keeps_recent_soft_deleted(client, seed_property):
    from app.core.database import async_session_factory
    from app.finance.models import Revenue

    rev_id = await _add_and_soft_delete(client, seed_property, 300.0, 12)

    resp = await client.post("/api/v1/maintenance/cleanup?days=30")
    assert resp.status_code == 200

    # A freshly soft-deleted row is within retention → kept.
    async with async_session_factory() as session:
        count = (await session.execute(
            select(func.count()).select_from(Revenue).where(Revenue.id == uuid.UUID(rev_id))
        )).scalar()
    assert count == 1


async def test_backup_verify_missing_returns_404(client):
    resp = await client.post("/api/v1/backups/does-not-exist.db/verify")
    assert resp.status_code == 404


async def test_maintenance_status_reports_integrity(client):
    resp = await client.get("/api/v1/maintenance/status")
    assert resp.status_code == 200
    body = resp.json()
    assert "integrity" in body
