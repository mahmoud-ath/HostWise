"""
Analytics Module — Service

Computes KPIs dynamically from normalized data.
Never stores calculated metrics — generates them on demand.
CID (Computed Intelligence on Demand).
"""
import uuid
from datetime import date

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.finance.repository import ExpenseRepository, RevenueRepository
from app.reservations.models import ReservationStatus
from app.reservations.repository import ReservationRepository


class AnalyticsService:
    """
    Core analytics engine.

    Computes all KPIs: Occupancy, ADR, RevPAR, Booking Window,
    Cancellation Rate, Average Stay, Repeat Guest Rate, Seasonality.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.rev_repo = RevenueRepository(session)
        self.exp_repo = ExpenseRepository(session)
        self.res_repo = ReservationRepository(session)

    async def get_property_analytics(
        self,
        organization_id: uuid.UUID,
        property_id: uuid.UUID,
        year: int,
    ) -> dict:
        """Compute comprehensive property performance analytics."""
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        days_in_year = 365 if year % 4 != 0 else 366

        # Revenue
        rev = await self.rev_repo.get_total_revenue(
            organization_id, property_id, start_date, end_date
        )

        # Reservations
        from sqlalchemy import func, select

        from app.reservations.models import Reservation
        res_stmt = (
            select(
                func.count(Reservation.id).label("total"),
                func.sum(Reservation.nights).label("nights"),
                func.avg(Reservation.gross_revenue).label("avg_revenue"),
                func.avg(Reservation.nights).label("avg_nights"),
            )
            .where(
                Reservation.organization_id == organization_id,
                Reservation.property_id == property_id,
                Reservation.is_deleted == False,
                Reservation.status.in_([
                    ReservationStatus.CONFIRMED,
                    ReservationStatus.COMPLETED,
                ]),
                Reservation.check_in >= start_date,
                Reservation.check_in <= end_date,
            )
        )
        res_result = await self.session.execute(res_stmt)
        res_row = res_result.one()

        # Cancelled
        canc_stmt = (
            select(func.count(Reservation.id))
            .where(
                Reservation.organization_id == organization_id,
                Reservation.property_id == property_id,
                Reservation.status == ReservationStatus.CANCELLED,
                Reservation.is_deleted == False,
                Reservation.check_in >= start_date,
                Reservation.check_in <= end_date,
            )
        )
        canc_result = await self.session.execute(canc_stmt)
        cancelled = canc_result.scalar() or 0

        total_res = res_row.total or 0
        total_nights = res_row.nights or 0
        avg_rev = float(res_row.avg_revenue or 0)
        avg_nights = float(res_row.avg_nights or 0)

        # KPIs
        occupancy_rate = round((total_nights / days_in_year * 100), 2) if days_in_year else 0.0
        adr = round(avg_rev / avg_nights, 2) if avg_nights > 0 else 0.0
        revpar = round((rev["net"] / days_in_year), 2) if days_in_year else 0.0
        cancellation_rate = round(
            (cancelled / (total_res + cancelled) * 100), 2
        ) if (total_res + cancelled) > 0 else 0.0

        # Booking window (average days between booking and check-in)
        bw_stmt = (
            select(func.avg(
                func.extract("day", Reservation.check_in - Reservation.booked_at)
            ))
            .where(
                Reservation.organization_id == organization_id,
                Reservation.property_id == property_id,
                Reservation.is_deleted == False,
                Reservation.booked_at.isnot(None),
                Reservation.check_in >= start_date,
                Reservation.check_in <= end_date,
            )
        )
        bw_result = await self.session.execute(bw_stmt)
        avg_booking_window = round(float(bw_result.scalar() or 0), 1)

        # Monthly breakdown
        monthly = await self.res_repo.get_monthly_revenue(
            organization_id, year, property_id
        )

        # Expense ratio
        exp = await self.exp_repo.get_total_expenses(
            organization_id, property_id, start_date, end_date
        )
        expense_ratio = round(
            (exp["total"] / rev["gross"] * 100), 2
        ) if rev["gross"] > 0 else 0.0

        return {
            "property_id": str(property_id),
            "year": year,
            "gross_revenue": round(rev["gross"], 2),
            "net_revenue": round(rev["net"], 2),
            "total_expenses": round(exp["total"], 2),
            "profit": round(rev["net"] - exp["total"], 2),
            "profit_margin": round(
                ((rev["net"] - exp["total"]) / rev["net"] * 100), 2
            ) if rev["net"] > 0 else 0.0,
            "occupancy_rate": occupancy_rate,
            "adr": adr,
            "revpar": revpar,
            "total_reservations": total_res,
            "total_nights": total_nights,
            "average_stay": round(avg_nights, 1),
            "cancellation_rate": cancellation_rate,
            "cancelled_reservations": cancelled,
            "avg_booking_window_days": avg_booking_window,
            "expense_ratio": expense_ratio,
            "monthly_breakdown": [
                {
                    "month": m["month"],
                    "gross_revenue": m["gross"],
                    "net_revenue": m["net"],
                    "reservation_count": m["count"],
                    "nights": m["nights"],
                }
                for m in monthly
            ],
        }

    async def get_portfolio_analytics(
        self,
        organization_id: uuid.UUID,
        year: int,
    ) -> dict:
        """Portfolio-wide analytics — all properties aggregated."""
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)

        rev = await self.rev_repo.get_total_revenue(
            organization_id, start_date=start_date, end_date=end_date
        )
        exp = await self.exp_repo.get_total_expenses(
            organization_id, start_date=start_date, end_date=end_date
        )

        # Property ranking
        prop_data = await self.rev_repo.get_revenue_by_property(
            organization_id, start_date, end_date
        )

        from app.properties.repository import PropertyRepository
        prop_repo = PropertyRepository(self.session)
        prop_count = await prop_repo.count_by_organization(organization_id)

        # YoY growth
        prev_rev = await self.rev_repo.get_total_revenue(
            organization_id,
            start_date=date(year - 1, 1, 1),
            end_date=date(year - 1, 12, 31),
        )
        revenue_growth = round(
            ((rev["net"] - prev_rev["net"]) / prev_rev["net"] * 100), 2
        ) if prev_rev["net"] > 0 else None

        # Seasonality
        monthly = await self.rev_repo.get_monthly_revenue(organization_id, year)

        return {
            "year": year,
            "property_count": prop_count,
            "gross_revenue": round(rev["gross"], 2),
            "net_revenue": round(rev["net"], 2),
            "total_expenses": round(exp["total"], 2),
            "profit": round(rev["net"] - exp["total"], 2),
            "profit_margin": round(
                ((rev["net"] - exp["total"]) / rev["net"] * 100), 2
            ) if rev["net"] > 0 else 0.0,
            "avg_revenue_per_property": round(
                rev["net"] / prop_count, 2
            ) if prop_count > 0 else 0.0,
            "revenue_growth_yoy": revenue_growth,
            "property_ranking": [
                {
                    "property_id": p["property_id"],
                    "property_name": p["property_name"],
                    "net_revenue": round(p["net"], 2),
                    "reservation_count": p["count"],
                }
                for p in prop_data
            ],
            "seasonality": [
                {
                    "month": m["month"],
                    "gross_revenue": m["gross"],
                    "net_revenue": m["net"],
                    "reservation_count": m["count"],
                }
                for m in monthly
            ],
        }

    async def get_property_health_score(
        self,
        organization_id: uuid.UUID,
        property_id: uuid.UUID,
    ) -> dict:
        """
        Compute a Property Health Score (0-100) based on:
        - Occupancy vs target
        - Revenue trend
        - Expense ratio
        - Cancellation rate
        - Profit margin
        """
        analytics = await self.get_property_analytics(
            organization_id, property_id, date.today().year
        )

        # Fetch property target
        from app.properties.repository import PropertyRepository
        prop_repo = PropertyRepository(self.session)
        prop = await prop_repo.get_by_id(property_id)

        score = 50.0  # baseline

        # Occupancy vs target
        if prop and prop.target_occupancy and prop.target_occupancy > 0:
            occ_ratio = analytics["occupancy_rate"] / prop.target_occupancy
            score += min((occ_ratio - 0.5) * 40, 20)

        # Profit margin
        if analytics["profit_margin"] > 30:
            score += 15
        elif analytics["profit_margin"] > 15:
            score += 8
        elif analytics["profit_margin"] < 0:
            score -= 20

        # Cancellation rate
        if analytics["cancellation_rate"] < 5:
            score += 10
        elif analytics["cancellation_rate"] > 20:
            score -= 10

        # Expense ratio
        if analytics["expense_ratio"] < 30:
            score += 10
        elif analytics["expense_ratio"] > 60:
            score -= 10

        score = max(0, min(100, round(score, 1)))

        # Determine status
        if score >= 75:
            status = "healthy"
        elif score >= 50:
            status = "average"
        elif score >= 25:
            status = "concerning"
        else:
            status = "critical"

        return {
            "property_id": str(property_id),
            "property_name": prop.name if prop else "Unknown",
            "health_score": score,
            "status": status,
            "occupancy_rate": analytics["occupancy_rate"],
            "target_occupancy": prop.target_occupancy if prop else None,
            "profit_margin": analytics["profit_margin"],
            "cancellation_rate": analytics["cancellation_rate"],
            "expense_ratio": analytics["expense_ratio"],
        }


async def get_analytics_service(
    session: AsyncSession = Depends(get_db),
) -> AnalyticsService:
    return AnalyticsService(session)
