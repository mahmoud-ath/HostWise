"""
Properties Module — Schemas
"""
from pydantic import BaseModel, Field
from typing import Optional
from app.shared.schemas import BaseResponse
from app.properties.models import PropertyType, PropertyStatus, ListingPlatform


class PropertyCreateRequest(BaseModel):
    name: str
    type: PropertyType = PropertyType.OTHER
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    bedrooms: int = 1
    bathrooms: float = 1.0
    max_guests: int = 2
    square_meters: Optional[float] = None
    acquisition_cost: Optional[float] = None
    monthly_mortgage: Optional[float] = None
    target_occupancy: Optional[float] = None
    target_annual_revenue: Optional[float] = None
    notes: Optional[str] = None


class PropertyUpdateRequest(BaseModel):
    name: Optional[str] = None
    type: Optional[PropertyType] = None
    status: Optional[PropertyStatus] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    max_guests: Optional[int] = None
    square_meters: Optional[float] = None
    acquisition_cost: Optional[float] = None
    monthly_mortgage: Optional[float] = None
    target_occupancy: Optional[float] = None
    target_annual_revenue: Optional[float] = None
    notes: Optional[str] = None


class ListingResponse(BaseResponse):
    platform: ListingPlatform
    external_id: Optional[str] = None
    listing_url: Optional[str] = None
    is_active: bool
    base_price: Optional[float] = None
    currency: str


class PropertyResponse(BaseResponse):
    name: str
    type: PropertyType
    status: PropertyStatus
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    bedrooms: int
    bathrooms: float
    max_guests: int
    square_meters: Optional[float] = None
    acquisition_cost: Optional[float] = None
    monthly_mortgage: Optional[float] = None
    target_occupancy: Optional[float] = None
    target_annual_revenue: Optional[float] = None
    notes: Optional[str] = None


class PropertyDetailResponse(PropertyResponse):
    """Full property response with listings (eagerly loaded)."""
    listings: list[ListingResponse] = []


class PropertySummaryResponse(BaseResponse):
    """Lightweight property representation for lists."""
    name: str
    type: PropertyType
    status: PropertyStatus
    city: Optional[str] = None
    country: Optional[str] = None
    bedrooms: int
    max_guests: int
    listing_count: int = 0


class ListingCreateRequest(BaseModel):
    platform: ListingPlatform
    external_id: Optional[str] = None
    listing_url: Optional[str] = None
    base_price: Optional[float] = None
    currency: str = "USD"
    minimum_nights: int = 1
    maximum_nights: Optional[int] = None
