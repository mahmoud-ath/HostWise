"""
Reservations Module — Schemas
"""
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from app.shared.schemas import BaseResponse
from app.reservations.models import ReservationStatus, ReservationSource


class ReservationCreateRequest(BaseModel):
    property_id: str
    listing_id: Optional[str] = None
    confirmation_code: Optional[str] = None
    status: ReservationStatus = ReservationStatus.CONFIRMED
    source: ReservationSource = ReservationSource.MANUAL
    check_in: date
    check_out: date
    nights: int
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None
    number_of_guests: int = 1
    gross_revenue: float = 0.0
    cleaning_fee: float = 0.0
    platform_fee: float = 0.0
    taxes: float = 0.0
    currency: str = "USD"
    notes: Optional[str] = None


class ReservationResponse(BaseResponse):
    property_id: str
    listing_id: Optional[str] = None
    confirmation_code: Optional[str] = None
    status: ReservationStatus
    source: ReservationSource
    check_in: date
    check_out: date
    nights: int
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    number_of_guests: int
    gross_revenue: float
    cleaning_fee: float
    platform_fee: float
    taxes: float
    net_revenue: float
    currency: str
    notes: Optional[str] = None


class ReservationSummary(BaseResponse):
    """Lightweight reservation for lists."""
    property_id: str
    confirmation_code: Optional[str] = None
    status: ReservationStatus
    check_in: date
    check_out: date
    nights: int
    guest_name: Optional[str] = None
    gross_revenue: float
    currency: str
