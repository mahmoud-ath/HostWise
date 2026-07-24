"""
Shared Base Model

Every domain model inherits from this.
Provides UUID primary keys, timestamps, and soft-delete support.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, Boolean, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class TimestampMixin:
    """Adds created_at and updated_at to any model."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class SoftDeleteMixin:
    """Soft-delete support — never actually delete rows."""
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )


class BaseModel(Base, TimestampMixin, SoftDeleteMixin):
    """
    Every domain entity inherits from this.
    Provides UUID PK, sync_id (for future cloud sync), timestamps, and soft-delete.
    """
    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    sync_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        default=uuid.uuid4,
        nullable=False,
        unique=True,
        comment="Global sync identifier — survives across database instances",
    )
