"""
Auth Module — Models

User model for authentication.
"""
import enum

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.base_model import BaseModel


class UserRole(str, enum.Enum):
    """Role-based access control."""
    ADMIN = "admin"
    OWNER = "owner"
    MANAGER = "manager"
    VIEWER = "viewer"


class User(BaseModel):
    """Platform user."""
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
