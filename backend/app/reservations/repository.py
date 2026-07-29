"""
Reservations Module — Repository
"""
import uuid
from collections.abc import Sequence
from datetime import date

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.reservations.models import Reservation, ReservationStatus
from app.shared.base_repository import BaseRepository


class ReservationRepository(BaseRepository[Reservation]):
    def __init__(self, session: AsyncSession):
        super().__init__(Reservation, session)

    async def get_by_organization(
        self,
        organization_id: uuid.UUID,
        property_id: uuid.UUID | None = None,
        status: ReservationStatus | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Reservation]:
        stmt = select(Reservation).where(
            Reservation.organization_id == organization_id,
            Reservation.is_deleted == False,
        )
        if property_id:
            stmt = stmt.where(Reservation.property_id == property_id)
        if status:
            stmt = stmt.where(Reservation.status == status)
        if start_date:
            stmt = stmt.where(Reservation.check_in >= start_date)
        if end_date:
            stmt = stmt.where(Reservation.check_out <= end_date)

        stmt = stmt.order_by(Reservation.check_in.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_property_reservations_in_range(
        self,
        property_id: uuid.UUID,
        start_date: date,
        end_date: date,
    ) -> Sequence[Reservation]:
        """Get all reservations overlapping a date range for a property."""
        result = await self.session.execute(
            select(Reservation).where(
                Reservation.property_id == property_id,
                Reservation.is_deleted == False,
                Reservation.status.in_([
                    ReservationStatus.CONFIRMED,
                    ReservationStatus.COMPLETED,
                ]),
                Reservation.check_out > start_date,
                Reservation.check_in < end_date,
            )
        )
        return result.scalars().all()

    async def get_monthly_revenue(
        self,
        organization_id: uuid.UUID,
        year: int,
        property_id: uuid.UUID | None = None,
    ) -> list[dict]:
        """Aggregate revenue by month for a given year."""
        stmt = (
            select(
                extract("month", Reservation.check_in).label("month"),
                func.sum(Reservation.gross_revenue).label("gross"),
                func.sum(Reservation.net_revenue).label("net"),
                func.count(Reservation.id).label("count"),
                func.sum(Reservation.nights).label("nights"),
            )
            .where(
                Reservation.organization_id == organization_id,
                Reservation.is_deleted == False,
                Reservation.status.in_([
                    ReservationStatus.CONFIRMED,
                    ReservationStatus.COMPLETED,
                ]),
                extract("year", Reservation.check_in) == year,
            )
            .group_by(extract("month", Reservation.check_in))
            .order_by(extract("month", Reservation.check_in))
        )
        if property_id:
            stmt = stmt.where(Reservation.property_id == property_id)

        result = await self.session.execute(stmt)
        return [
            {
                "month": int(row.month),
                "gross_revenue": float(row.gross or 0),
                "net_revenue": float(row.net or 0),
                "reservation_count": int(row.count),
                "total_nights": int(row.nights or 0),
            }
            for row in result
        ]
