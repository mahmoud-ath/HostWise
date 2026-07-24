"""
Finance Module — Models

Revenue and Expense records that drive the financial intelligence engine.
Every financial record is linked to a property and organization.
"""
import uuid
from datetime import date
from sqlalchemy import (
    Column, String, Float, Date, Text, ForeignKey, Enum as SAEnum, Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from app.shared.base_model import BaseModel


class RevenueSource(str, enum.Enum):
    """Where the revenue record originated."""
    MANUAL = "manual"
    CSV = "csv"
    AIRBNB = "airbnb"
    BOOKING = "booking"
    VRBO = "vrbo"
    DIRECT = "direct"
    CONNECTOR = "connector"


class Revenue(BaseModel):
    """
    Revenue record — can be linked to a reservation or standalone.
    Standalone revenue: manual entries, CSV imports, off-platform bookings.
    """
    __tablename__ = "revenues"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reservation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("reservations.id", ondelete="SET NULL"),
        nullable=True,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("revenue_categories.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Date
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Amounts
    gross_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    commission_amount: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0,
        comment="Management/concierge commission deducted",
    )
    net_amount: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0,
        comment="Gross - Commission = Net revenue to host",
    )

    # Metadata
    source: Mapped[RevenueSource] = mapped_column(
        SAEnum(RevenueSource), nullable=False, default=RevenueSource.MANUAL
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    property: Mapped["Property"] = relationship("Property", back_populates="revenues")
    reservation: Mapped["Reservation | None"] = relationship(
        "Reservation", back_populates="revenues"
    )
    category: Mapped["RevenueCategory | None"] = relationship("RevenueCategory")


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    BANK_TRANSFER = "bank_transfer"
    PAYPAL = "paypal"
    OTHER = "other"


class Expense(BaseModel):
    """
    Expense record — every cost associated with a property.
    Tracked by category, vendor, and payment method for detailed analytics.
    """
    __tablename__ = "expenses"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("expense_categories.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Date
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Amount
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    # Details
    vendor: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_method: Mapped[PaymentMethod | None] = mapped_column(
        SAEnum(PaymentMethod), nullable=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_recurring: Mapped[bool] = mapped_column(default=False, nullable=False)
    receipt_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    property: Mapped["Property"] = relationship("Property", back_populates="expenses")
    category: Mapped["ExpenseCategory | None"] = relationship("ExpenseCategory")


# Lazy imports
from app.properties.models import Property
from app.reservations.models import Reservation
from app.organizations.models import RevenueCategory, ExpenseCategory
