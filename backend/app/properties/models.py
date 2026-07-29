"""
Properties Module — Models

Property is the core asset — everything revolves around it.
A property can have multiple listings across different booking platforms.
"""
import enum
import uuid

from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.base_model import BaseModel


class PropertyType(enum.StrEnum):
    APARTMENT = "apartment"
    HOUSE = "house"
    CONDO = "condo"
    VILLA = "villa"
    CABIN = "cabin"
    COTTAGE = "cottage"
    TOWNHOUSE = "townhouse"
    STUDIO = "studio"
    LOFT = "loft"
    OTHER = "other"


class PropertyStatus(enum.StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    UNDER_MAINTENANCE = "under_maintenance"
    SOLD = "sold"


class Property(BaseModel):
    """A physical property — the core asset in the portfolio."""
    __tablename__ = "properties"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[PropertyType] = mapped_column(
        SAEnum(PropertyType), nullable=False, default=PropertyType.OTHER
    )
    status: Mapped[PropertyStatus] = mapped_column(
        SAEnum(PropertyStatus), nullable=False, default=PropertyStatus.ACTIVE
    )

    # Location
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    state: Mapped[str | None] = mapped_column(String(255), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Property details
    bedrooms: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    bathrooms: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    max_guests: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    square_meters: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Financial baseline
    acquisition_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    monthly_mortgage: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_occupancy: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_annual_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="properties"
    )
    listings: Mapped[list["Listing"]] = relationship(
        "Listing", back_populates="property", lazy="selectin"
    )
    reservations: Mapped[list["Reservation"]] = relationship(
        "Reservation", back_populates="property", lazy="selectin"
    )
    revenues: Mapped[list["Revenue"]] = relationship(
        "Revenue", back_populates="property", lazy="selectin"
    )
    expenses: Mapped[list["Expense"]] = relationship(
        "Expense", back_populates="property", lazy="selectin"
    )


class ListingPlatform(enum.StrEnum):
    AIRBNB = "airbnb"
    BOOKING = "booking"
    VRBO = "vrbo"
    DIRECT = "direct"
    OTHER = "other"


class Listing(BaseModel):
    """A property's listing on a specific booking platform."""
    __tablename__ = "listings"

    property_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    platform: Mapped[ListingPlatform] = mapped_column(
        SAEnum(ListingPlatform), nullable=False
    )
    external_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    listing_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Platform-specific pricing defaults
    base_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    minimum_nights: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    maximum_nights: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    property: Mapped["Property"] = relationship("Property", back_populates="listings")


# Lazy imports
from app.finance.models import Expense, Revenue
from app.organizations.models import Organization
from app.reservations.models import Reservation
