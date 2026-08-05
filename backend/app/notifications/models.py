"""
Notifications Module — Model
"""
from sqlalchemy import Boolean, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.base_model import BaseModel


class Notification(BaseModel):
    """An in-app notification generated from analytics/backup/report events."""
    __tablename__ = "notifications"
    __table_args__ = (
        # One live notification per fingerprint — guards against two
        # concurrent refresh() calls racing past the app-level dedupe.
        Index(
            "uq_notifications_fingerprint_active",
            "fingerprint",
            unique=True,
            sqlite_where=text("is_deleted = 0"),
        ),
    )

    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # info | success | warning | error
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="info")
    # Dedupe key so refresh() never creates duplicates (e.g. "profit:2026-08").
    fingerprint: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
