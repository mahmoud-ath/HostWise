"""
Auth Module — Models

User & Role models for authentication and authorization.
"""
import enum
import typing
import uuid

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_model import BaseModel

if typing.TYPE_CHECKING:
    from app.organizations.models import Organization


class UserRole(enum.StrEnum):
    """Role-based access control."""
    ADMIN = "admin"
    OWNER = "owner"
    MANAGER = "manager"
    VIEWER = "viewer"


class User(BaseModel):
    """Platform user — can belong to multiple organizations."""
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    memberships: Mapped[list["OrganizationMember"]] = relationship(
        "OrganizationMember", back_populates="user", lazy="selectin"
    )


class OrganizationMember(BaseModel):
    """Junction between User and Organization with role assignment."""
    __tablename__ = "organization_members"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole), default=UserRole.VIEWER, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="memberships")
    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="members"
    )
