"""
Properties Module — Schemas
"""

from pydantic import BaseModel, Field

from app.properties.models import ListingPlatform, PropertyStatus, PropertyType
from app.shared.schemas import BaseResponse


class PropertyCreateRequest(BaseModel):
    name: str
    type: PropertyType = PropertyType.OTHER
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None
    bedrooms: int = 1
    bathrooms: float = 1.0
    max_guests: int = 2
    square_meters: float | None = None
    acquisition_cost: float | None = None
    monthly_mortgage: float | None = None
    target_occupancy: float | None = None
    target_annual_revenue: float | None = None
    notes: str | None = None


class PropertyUpdateRequest(BaseModel):
    name: str | None = None
    type: PropertyType | None = None
    status: PropertyStatus | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None
    bedrooms: int | None = None
    bathrooms: float | None = None
    max_guests: int | None = None
    square_meters: float | None = None
    acquisition_cost: float | None = None
    monthly_mortgage: float | None = None
    target_occupancy: float | None = None
    target_annual_revenue: float | None = None
    notes: str | None = None


class ListingResponse(BaseResponse):
    platform: ListingPlatform
    external_id: str | None = None
    listing_url: str | None = None
    is_active: bool
    base_price: float | None = None
    currency: str


class PropertyResponse(BaseResponse):
    name: str
    type: PropertyType
    status: PropertyStatus
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None
    bedrooms: int
    bathrooms: float
    max_guests: int
    square_meters: float | None = None
    acquisition_cost: float | None = None
    monthly_mortgage: float | None = None
    target_occupancy: float | None = None
    target_annual_revenue: float | None = None
    notes: str | None = None


class PropertyDetailResponse(PropertyResponse):
    """Full property response with listings (eagerly loaded)."""
    listings: list[ListingResponse] = Field(default_factory=list)


class PropertySummaryResponse(BaseResponse):
    """Lightweight property representation for lists."""
    name: str
    type: PropertyType
    status: PropertyStatus
    city: str | None = None
    country: str | None = None
    bedrooms: int
    max_guests: int
    listing_count: int = 0


class ListingCreateRequest(BaseModel):
    platform: ListingPlatform
    external_id: str | None = None
    listing_url: str | None = None
    base_price: float | None = None
    currency: str = "USD"
    minimum_nights: int = 1
    maximum_nights: int | None = None
