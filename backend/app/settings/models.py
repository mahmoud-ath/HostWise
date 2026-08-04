"""
Settings Module — Model

A simple key-value store for application settings. Local-first: all
configuration lives in the same database as the user's data.
Values are stored as JSON strings so they can hold any scalar, list,
or object without schema changes.
"""
from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Setting(Base):
    """A single application setting (key -> JSON value)."""
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="null")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
