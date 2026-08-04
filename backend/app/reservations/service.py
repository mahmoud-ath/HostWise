"""
Reservations Module — Service Layer
"""
import uuid

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.reservations.models import Reservation
from app.reservations.repository import ReservationRepository
from app.reservations.schemas import ReservationCreateRequest, ReservationResponse
from app.shared.exceptions import NotFoundException


class ReservationService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ReservationRepository(session)

    async def create(
        self, data: ReservationCreateRequest
    ) -> ReservationResponse:
        net = data.gross_revenue - data.platform_fee - data.taxes
        reservation = Reservation(
            property_id=uuid.UUID(data.property_id),
            listing_id=uuid.UUID(data.listing_id) if data.listing_id else None,
            **{k: v for k, v in data.model_dump().items()
               if k not in ("property_id", "listing_id")},
            net_revenue=net,
        )
        reservation = await self.repo.create(reservation)
        return ReservationResponse.model_validate(reservation)

    async def get_by_id(self, reservation_id: uuid.UUID) -> ReservationResponse:
        r = await self.repo.get_by_id(reservation_id)
        if not r:
            raise NotFoundException("Reservation", str(reservation_id))
        return ReservationResponse.model_validate(r)

    async def list_all(
        self,
        property_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ReservationResponse]:
        reservations = await self.repo.get_by_organization(
            property_id=property_id, skip=skip, limit=limit
        )
        return [ReservationResponse.model_validate(r) for r in reservations]


async def get_reservation_service(
    session: AsyncSession = Depends(get_db),
) -> ReservationService:
    return ReservationService(session)
