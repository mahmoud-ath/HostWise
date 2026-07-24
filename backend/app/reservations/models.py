"""
Reservations Module — Models

A Reservation is a guest booking. Linked to property, listing, and revenue.
The core domain event that drives all analytics.
"""
import uuid
from datetime import date, datetime
from sqlalchemy import (
    Column, String, Integer, Float, Date, DateTime, Text,
    Enum as SAEnum, ForeignKey, Boolean, Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from app.shared.base_model import BaseModel


class ReservationStatus(str, enum.Enum):
    """
    Normalized reservation status — provider-agnostic.
    Airbnb 'confirmed' and Booking 'reserved' both map to CONFIRMED.
    """
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
    INQUIRY = "inquiry"
    BLOCKED = "blocked"


class ReservationSource(str, enum.Enum):
    """Source of the reservation data."""
    AIRBNB = "airbnb"
    BOOKING = "booking"
    VRBO = "vrbo"
    DIRECT = "direct"
    MANUAL = "manual"
    CSV = "csv"
    ICAL = "ical"


class Reservation(BaseModel):
    """A guest reservation — the atomic unit of revenue generation."""
    __tablename__ = "reservations"

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
    listing_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("listings.id", ondelete="SET NULL"),
        nullable=True,
    )

    # External reference
    external_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    confirmation_code: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Status
    status: Mapped[ReservationStatus] = mapped_column(
        SAEnum(ReservationStatus), nullable=False, default=ReservationStatus.CONFIRMED
    )
    source: Mapped[ReservationSource] = mapped_column(
        SAEnum(ReservationSource), nullable=False, default=ReservationSource.MANUAL
    )

    # Dates
    check_in: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    check_out: Mapped[date] = mapped_column(Date, nullable=False)
    booked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Nights (derived but stored for query performance)
    nights: Mapped[int] = mapped_column(Integer, nullable=False)

    # Guests
    guest_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    guest_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    guest_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    number_of_guests: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Financial breakdown (normalized)
    gross_revenue: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    cleaning_fee: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    platform_fee: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    taxes: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    net_revenue: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0,
        comment="Net after platform fees, before commission"
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    # Property info (denormalized for analytics)
    property_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    property_city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    property_country: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    property: Mapped["Property"] = relationship("Property", back_populates="reservations")
    listing: Mapped["Listing | None"] = relationship("Listing")
    revenues: Mapped[list["Revenue"]] = relationship(
        "Revenue", back_populates="reservation", lazy="selectin"
    )


class Guest(BaseModel):
    """Guest profile — built up over time across reservations."""
    __tablename__ = "guests"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Derived stats
    total_stays: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_revenue: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    first_stay: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_stay: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Tags
    is_vip: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


# Lazy imports
from app.properties.models import Property, Listing
from app.finance.models import Revenue
