"""
Analytics Module — Service

Computes KPIs dynamically from normalized data.
Never stores calculated metrics — generates them on demand.
CID (Computed Intelligence on Demand).
"""
import uuid
from datetime import date, timedelta

from fastapi import Depends
from sqlalchemy import select
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
        property_id: uuid.UUID,
        year: int,
    ) -> dict:
        """Compute comprehensive property performance analytics."""
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)

        # Revenue
        rev = await self.rev_repo.get_total_revenue(
            property_id, start_date, end_date
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

        # KPIs (occupancy/ADR/RevPAR intentionally removed from scope)
        cancellation_rate = round(
            (cancelled / (total_res + cancelled) * 100), 2
        ) if (total_res + cancelled) > 0 else 0.0

        # Booking window (average days between booking and check-in)
        bw_stmt = (
            select(func.avg(
                func.extract("day", Reservation.check_in - Reservation.booked_at)
            ))
            .where(
                Reservation.property_id == property_id,
                Reservation.is_deleted == False,
                Reservation.booked_at.isnot(None),
                Reservation.check_in >= start_date,
                Reservation.check_in <= end_date,
            )
        )
        bw_result = await self.session.execute(bw_stmt)
        avg_booking_window = round(float(bw_result.scalar() or 0), 1)

        # Monthly breakdown (revenue + expenses per month)
        monthly = await self.res_repo.get_monthly_revenue(year, property_id)
        monthly_exp = await self.exp_repo.get_monthly_expenses(year, property_id)
        exp_by_month = {em["month"]: em["total"] for em in monthly_exp}
        rev_by_month = {m["month"]: m for m in monthly}

        breakdown = []
        for mon in sorted(set(rev_by_month) | set(exp_by_month)):
            rm = rev_by_month.get(mon)
            breakdown.append({
                "month": mon,
                "gross_revenue": round(rm["gross_revenue"], 2) if rm else 0.0,
                "net_revenue": round(rm["net_revenue"], 2) if rm else 0.0,
                "reservation_count": rm["reservation_count"] if rm else 0,
                "nights": rm["total_nights"] if rm else 0,
                "total_expenses": round(exp_by_month.get(mon, 0.0), 2),
            })

        # Expense ratio
        exp = await self.exp_repo.get_total_expenses(property_id, start_date, end_date)
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
            "cancellation_rate": cancellation_rate,
            "cancelled_reservations": cancelled,
            "avg_booking_window_days": avg_booking_window,
            "expense_ratio": expense_ratio,
            "monthly_breakdown": breakdown,
        }

    async def get_portfolio_analytics(
        self,
        year: int | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict:
        """Portfolio-wide analytics — all properties aggregated.

        Date-range aware: when `start_date`/`end_date` are omitted they default
        to the given `year` (or the current year), preserving the old behaviour.
        """
        if start_date is None or end_date is None:
            y = year or date.today().year
            start_date = start_date or date(y, 1, 1)
            end_date = end_date or date(y, 12, 31)

        rev = await self.rev_repo.get_total_revenue(start_date=start_date, end_date=end_date)
        exp = await self.exp_repo.get_total_expenses(start_date=start_date, end_date=end_date)

        # Property ranking
        prop_data = await self.rev_repo.get_revenue_by_property(start_date, end_date)

        from app.properties.repository import PropertyRepository
        prop_repo = PropertyRepository(self.session)
        prop_count = await prop_repo.count_all()

        # Growth vs the equally-sized preceding period
        prev_end = start_date - timedelta(days=1)
        prev_start = prev_end - (end_date - start_date)
        prev_rev = await self.rev_repo.get_total_revenue(
            start_date=prev_start,
            end_date=prev_end,
        )
        revenue_growth = round(
            ((rev["net"] - prev_rev["net"]) / prev_rev["net"] * 100), 2
        ) if prev_rev["net"] > 0 else None

        # Monthly revenue/expense maps for every year spanned by the range
        rev_by_month: dict[tuple[int, int], dict] = {}
        exp_by_month: dict[tuple[int, int], dict] = {}
        for y in range(start_date.year, end_date.year + 1):
            for rm in await self.rev_repo.get_monthly_revenue(y):
                rev_by_month[(y, rm["month"])] = rm
            for em in await self.exp_repo.get_monthly_expenses(y):
                exp_by_month[(y, em["month"])] = em

        # Reservation stats
        from sqlalchemy import func as sa_func

        from app.reservations.models import Reservation, ReservationStatus

        res_stmt = (
            select(
                sa_func.count(Reservation.id).label("total"),
                sa_func.avg(Reservation.nights).label("avg_nights"),
                sa_func.coalesce(sa_func.sum(Reservation.gross_revenue), 0.0).label("total_rev"),
            )
            .where(
                Reservation.is_deleted == False,
                Reservation.status.in_([ReservationStatus.CONFIRMED, ReservationStatus.COMPLETED]),
                Reservation.check_in >= start_date,
                Reservation.check_in <= end_date,
            )
        )
        res_result = await self.session.execute(res_stmt)
        res_row = res_result.one()
        total_reservations = res_row.total or 0
        avg_stay = round(float(res_row.avg_nights or 0), 1)

        # Cancellation rate
        canc_stmt = (
            select(sa_func.count(Reservation.id))
            .where(
                Reservation.is_deleted == False,
                Reservation.status == ReservationStatus.CANCELLED,
                Reservation.check_in >= start_date,
                Reservation.check_in <= end_date,
            )
        )
        canc_result = await self.session.execute(canc_stmt)
        cancelled = canc_result.scalar() or 0
        cancellation_rate = round(
            (cancelled / (total_reservations + cancelled) * 100), 2
        ) if (total_reservations + cancelled) > 0 else 0.0

        # Booking window
        bw_stmt = (
            select(sa_func.avg(
                sa_func.extract("day", Reservation.check_in - Reservation.booked_at)
            ))
            .where(
                Reservation.is_deleted == False,
                Reservation.booked_at.isnot(None),
                Reservation.check_in >= start_date,
                Reservation.check_in <= end_date,
            )
        )
        bw_result = await self.session.execute(bw_stmt)
        avg_booking_window = round(float(bw_result.scalar() or 0), 1)

        # (Occupancy / ADR / RevPAR intentionally removed from scope)

        # Expense categories
        exp_cats = await self.exp_repo.get_expenses_by_category(start_date, end_date)

        # Revenue categories
        rev_cats = await self.rev_repo.get_revenue_by_category(start_date, end_date)

        # Property health scores
        health_distribution = {"excellent": 0, "good": 0, "average": 0, "poor": 0}
        enhanced_ranking = []
        for pd in prop_data:
            pid = uuid.UUID(pd["property_id"]) if isinstance(pd["property_id"], str) else pd["property_id"]
            health = await self.get_property_health_score(pid)
            h = health["health_score"]
            if h is None:
                # No data yet — don't count it as a healthy/unhealthy property.
                pass
            elif h >= 75:
                health_distribution["excellent"] += 1
            elif h >= 50:
                health_distribution["good"] += 1
            elif h >= 25:
                health_distribution["average"] += 1
            else:
                health_distribution["poor"] += 1
            enhanced_ranking.append({
                "property_id": pd["property_id"],
                "property_name": pd["property_name"],
                "net_revenue": round(pd["net"], 2),
                "reservation_count": pd["count"],
                "health_score": h,
                "profit_margin": health.get("profit_margin", 0),
            })

        # Seasonality — every month in the range, so partial ranges stay honest
        seasonality = []
        cy, cm = start_date.year, start_date.month
        while (cy, cm) <= (end_date.year, end_date.month):
            rm = rev_by_month.get((cy, cm))
            em = exp_by_month.get((cy, cm))
            seasonality.append({
                "month": cm,
                "gross_revenue": round(rm["gross"], 2) if rm else 0.0,
                "net_revenue": round(rm["net"], 2) if rm else 0.0,
                "reservation_count": rm["count"] if rm else 0,
                "total_expenses": round(em["total"], 2) if em else 0.0,
            })
            if cm == 12:
                cy += 1
                cm = 1
            else:
                cm += 1

        return {
            "year": end_date.year,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
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
            "total_reservations": total_reservations,
            "avg_stay": avg_stay,
            "cancellation_rate": cancellation_rate,
            "avg_booking_window": avg_booking_window,
            "health_distribution": health_distribution,
            "property_ranking": enhanced_ranking,
            "expense_categories": [
                {"name": c["category_name"], "total": round(c["total"], 2), "percentage": c["percentage"]}
                for c in exp_cats
            ],
            "revenue_categories": [
                {"name": c["category_name"], "total": round(c["total"], 2), "percentage": c["percentage"]}
                for c in rev_cats
            ],
            "seasonality": seasonality,
        }

    async def get_property_health_score(
        self,
        property_id: uuid.UUID,
    ) -> dict:
        """
        Compute a Property Health Score (0-100) based on:
        - Profit margin
        - Cancellation rate
        - Expense ratio
        - Revenue vs annual target
        """
        analytics = await self.get_property_analytics(
            property_id, date.today().year
        )

        # Fetch property target
        from app.properties.repository import PropertyRepository
        prop_repo = PropertyRepository(self.session)
        prop = await prop_repo.get_by_id(property_id)

        # No financial activity → there is nothing to score yet.
        res_count = sum(
            m.get("reservation_count", 0) for m in analytics.get("monthly_breakdown", [])
        )
        if (
            analytics["net_revenue"] == 0
            and analytics["total_expenses"] == 0
            and res_count == 0
        ):
            return {
                "property_id": str(property_id),
                "property_name": prop.name if prop else "Unknown",
                "health_score": None,
                "status": "no_data",
                "target_annual_revenue": prop.target_annual_revenue if prop else None,
                "profit_margin": 0.0,
                "cancellation_rate": 0.0,
                "expense_ratio": 0.0,
                "net_revenue": 0.0,
            }

        score = 50.0  # baseline

        # Profit margin
        if analytics["profit_margin"] > 40:
            score += 20
        elif analytics["profit_margin"] > 20:
            score += 12
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

        # Revenue vs annual target (when one is set)
        target_rev = prop.target_annual_revenue if prop else None
        if target_rev and target_rev > 0:
            achieved = analytics["net_revenue"] / target_rev
            if achieved >= 0.8:
                score += 10
            elif achieved < 0.5:
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
            "target_annual_revenue": prop.target_annual_revenue if prop else None,
            "profit_margin": analytics["profit_margin"],
            "cancellation_rate": analytics["cancellation_rate"],
            "expense_ratio": analytics["expense_ratio"],
            "net_revenue": analytics["net_revenue"],
        }


async def get_analytics_service(
    session: AsyncSession = Depends(get_db),
) -> AnalyticsService:
    return AnalyticsService(session)
