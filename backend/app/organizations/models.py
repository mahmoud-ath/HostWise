"""
Organization Module — Models

Organization is the tenant boundary. Every entity belongs to an organization.
Supports: Individual Host, Property Manager, Agency, Investment Company.
"""
import enum
import uuid

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_model import BaseModel


class OrganizationType(enum.StrEnum):
    """Types of organizations using the platform."""
    INDIVIDUAL_HOST = "individual_host"
    PROFESSIONAL_HOST = "professional_host"
    PROPERTY_MANAGER = "property_manager"
    AGENCY = "agency"
    INVESTMENT_COMPANY = "investment_company"
    MULTI_PROPERTY_OPERATOR = "multi_property_operator"


class Organization(BaseModel):
    """Tenant boundary — all data is scoped to an organization."""
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    type: Mapped[OrganizationType] = mapped_column(
        SAEnum(OrganizationType), nullable=False, default=OrganizationType.INDIVIDUAL_HOST
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Financial settings
    default_currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="USD"
    )
    fiscal_year_start_month: Mapped[int] = mapped_column(
        default=1, nullable=False
    )
    commission_percentage: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    concierge_percentage: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )

    # Relationships
    members: Mapped[list["OrganizationMember"]] = relationship(
        "OrganizationMember", back_populates="organization", lazy="selectin"
    )
    properties: Mapped[list["Property"]] = relationship(
        "Property", back_populates="organization", lazy="selectin"
    )

    # Import deferred to avoid circular imports
    # These are configured in the respective modules


class RevenueCategory(BaseModel):
    """Configurable revenue categories per organization."""
    __tablename__ = "revenue_categories"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)


class ExpenseCategory(BaseModel):
    """Configurable expense categories per organization."""
    __tablename__ = "expense_categories"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)


# Lazy imports to resolve circular dependencies
from app.auth.models import OrganizationMember
from app.properties.models import Property
