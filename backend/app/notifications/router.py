"""
Notifications Module — Router
"""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.notifications.service import NotificationService

router = APIRouter()


def _serialize(notifications) -> list[dict]:
    return [
        {
            "id": str(n.id),
            "type": n.type,
            "title": n.title,
            "message": n.message,
            "severity": n.severity,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifications
    ]


@router.get("")
async def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_db),
):
    """List in-app notifications (unread first, newest first)."""
    service = NotificationService(session)
    return {
        "notifications": _serialize(await service.list_notifications(limit)),
        "unread": await service.unread_count(),
    }


@router.get("/summary")
async def notification_summary(session: AsyncSession = Depends(get_db)):
    """Unread count for the bell badge."""
    return {"unread": await NotificationService(session).unread_count()}


@router.post("/refresh")
async def refresh_notifications(session: AsyncSession = Depends(get_db)):
    """Recompute notifications from current data + enabled settings.

    Idempotent — deduped by fingerprint, safe to call on every app load.
    """
    return await NotificationService(session).refresh()


@router.post("/read-all")
async def mark_all_read(session: AsyncSession = Depends(get_db)):
    return {"updated": await NotificationService(session).mark_all_read()}


@router.delete("")
async def clear_notifications(session: AsyncSession = Depends(get_db)):
    """Archive all notifications."""
    return {"deleted": await NotificationService(session).clear_all()}


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
):
    return {"updated": await NotificationService(session).mark_read(notification_id)}
