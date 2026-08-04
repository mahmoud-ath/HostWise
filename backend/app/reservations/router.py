"""
Reservations Module — Router
"""
import uuid

from fastapi import APIRouter, Depends, Query

from app.reservations.schemas import ReservationCreateRequest, ReservationResponse
from app.reservations.service import ReservationService, get_reservation_service

router = APIRouter()


@router.post("", response_model=ReservationResponse, status_code=201)
async def create_reservation(
    data: ReservationCreateRequest,
    service: ReservationService = Depends(get_reservation_service),
):
    return await service.create(data)


@router.get("", response_model=list[ReservationResponse])
async def list_reservations(
    property_id: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: ReservationService = Depends(get_reservation_service),
):
    pid = uuid.UUID(property_id) if property_id else None
    return await service.list_all(property_id=pid, skip=skip, limit=limit)


@router.get("/detail/{reservation_id}", response_model=ReservationResponse)
async def get_reservation(
    reservation_id: str,
    service: ReservationService = Depends(get_reservation_service),
):
    return await service.get_by_id(uuid.UUID(reservation_id))
