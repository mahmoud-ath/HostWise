"""
Reservations Module — Schemas
"""
from datetime import date

from pydantic import BaseModel

from app.reservations.models import ReservationSource, ReservationStatus
from app.shared.schemas import BaseResponse


class ReservationCreateRequest(BaseModel):
    property_id: str
    listing_id: str | None = None
    confirmation_code: str | None = None
    status: ReservationStatus = ReservationStatus.CONFIRMED
    source: ReservationSource = ReservationSource.MANUAL
    check_in: date
    check_out: date
    nights: int
    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    number_of_guests: int = 1
    gross_revenue: float = 0.0
    cleaning_fee: float = 0.0
    platform_fee: float = 0.0
    taxes: float = 0.0
    currency: str = "USD"
    notes: str | None = None


class ReservationResponse(BaseResponse):
    property_id: str
    listing_id: str | None = None
    confirmation_code: str | None = None
    status: ReservationStatus
    source: ReservationSource
    check_in: date
    check_out: date
    nights: int
    guest_name: str | None = None
    guest_email: str | None = None
    number_of_guests: int
    gross_revenue: float
    cleaning_fee: float
    platform_fee: float
    taxes: float
    net_revenue: float
    currency: str
    notes: str | None = None


class ReservationSummary(BaseResponse):
    """Lightweight reservation for lists."""
    property_id: str
    confirmation_code: str | None = None
    status: ReservationStatus
    check_in: date
    check_out: date
    nights: int
    guest_name: str | None = None
    gross_revenue: float
    currency: str
