"""
Finance Module — Repository

Data access for revenue, expense, and aggregation queries.
All financial calculations happen via SQL for performance.
"""
import uuid
from collections.abc import Sequence
from datetime import date

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.finance.models import Expense, Revenue
from app.shared.base_repository import BaseRepository


class RevenueRepository(BaseRepository[Revenue]):
    def __init__(self, session: AsyncSession):
        super().__init__(Revenue, session)

    async def get_all(
        self,
        property_id: uuid.UUID | None = None,
        category_id: uuid.UUID | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Revenue]:
        stmt = select(Revenue).where(Revenue.is_deleted == False)
        if property_id:
            stmt = stmt.where(Revenue.property_id == property_id)
        if category_id:
            stmt = stmt.where(Revenue.category_id == category_id)
        if start_date:
            stmt = stmt.where(Revenue.date >= start_date)
        if end_date:
            stmt = stmt.where(Revenue.date <= end_date)

        stmt = stmt.order_by(Revenue.date.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_total_revenue(
        self,
        property_id: uuid.UUID | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict:
        """Get aggregated revenue totals."""
        stmt = (
            select(
                func.coalesce(func.sum(Revenue.gross_amount), 0.0).label("gross"),
                func.coalesce(func.sum(Revenue.net_amount), 0.0).label("net"),
                func.coalesce(func.sum(Revenue.commission_amount), 0.0).label("commission"),
                func.count(Revenue.id).label("count"),
            )
            .where(Revenue.is_deleted == False)
        )
        if property_id:
            stmt = stmt.where(Revenue.property_id == property_id)
        if start_date:
            stmt = stmt.where(Revenue.date >= start_date)
        if end_date:
            stmt = stmt.where(Revenue.date <= end_date)

        result = await self.session.execute(stmt)
        row = result.one()
        return {
            "gross": float(row.gross),
            "net": float(row.net),
            "commission": float(row.commission),
            "count": int(row.count),
        }

    async def get_monthly_revenue(
        self,
        year: int,
        property_id: uuid.UUID | None = None,
    ) -> list[dict]:
        """Revenue aggregated by month for a year."""
        stmt = (
            select(
                extract("month", Revenue.date).label("month"),
                func.coalesce(func.sum(Revenue.gross_amount), 0.0).label("gross"),
                func.coalesce(func.sum(Revenue.net_amount), 0.0).label("net"),
                func.coalesce(func.sum(Revenue.commission_amount), 0.0).label("commission"),
                func.count(Revenue.id).label("count"),
            )
            .where(
                Revenue.is_deleted == False,
                extract("year", Revenue.date) == year,
            )
            .group_by(extract("month", Revenue.date))
            .order_by(extract("month", Revenue.date))
        )
        if property_id:
            stmt = stmt.where(Revenue.property_id == property_id)

        result = await self.session.execute(stmt)
        return [
            {
                "month": int(row.month),
                "gross": float(row.gross),
                "net": float(row.net),
                "commission": float(row.commission),
                "count": int(row.count),
            }
            for row in result
        ]

    async def get_revenue_by_category(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[dict]:
        """Revenue grouped by category."""
        from app.finance.category_models import RevenueCategory
        stmt = (
            select(
                func.coalesce(RevenueCategory.name, "Uncategorized").label("name"),
                func.coalesce(func.sum(Revenue.net_amount), 0.0).label("total"),
                func.count(Revenue.id).label("count"),
            )
            .outerjoin(RevenueCategory, Revenue.category_id == RevenueCategory.id)
            .where(Revenue.is_deleted == False)
        )
        if start_date:
            stmt = stmt.where(Revenue.date >= start_date)
        if end_date:
            stmt = stmt.where(Revenue.date <= end_date)

        total_rev = await self.get_total_revenue(start_date=start_date, end_date=end_date)
        total_net = total_rev["net"] or 1.0

        stmt = stmt.group_by(RevenueCategory.name).order_by(func.sum(Revenue.net_amount).desc())
        result = await self.session.execute(stmt)
        return [
            {
                "category_name": row.name,
                "total": float(row.total),
                "percentage": round(float(row.total) / total_net * 100, 1) if total_net else 0,
                "count": int(row.count),
            }
            for row in result
        ]

    async def get_revenue_by_property(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[dict]:
        """Revenue grouped by property."""
        from app.properties.models import Property
        stmt = (
            select(
                Property.id.label("property_id"),
                Property.name.label("property_name"),
                func.coalesce(func.sum(Revenue.gross_amount), 0.0).label("gross"),
                func.coalesce(func.sum(Revenue.net_amount), 0.0).label("net"),
                func.coalesce(func.sum(Revenue.commission_amount), 0.0).label("commission"),
                func.count(Revenue.id).label("count"),
            )
            .join(Property, Revenue.property_id == Property.id)
            .where(Revenue.is_deleted == False)
        )
        if start_date:
            stmt = stmt.where(Revenue.date >= start_date)
        if end_date:
            stmt = stmt.where(Revenue.date <= end_date)

        stmt = stmt.group_by(Property.id, Property.name).order_by(func.sum(Revenue.net_amount).desc())
        result = await self.session.execute(stmt)
        return [
            {
                "property_id": str(row.property_id),
                "property_name": row.property_name,
                "gross": float(row.gross),
                "net": float(row.net),
                "commission": float(row.commission),
                "count": int(row.count),
            }
            for row in result
        ]


class ExpenseRepository(BaseRepository[Expense]):
    def __init__(self, session: AsyncSession):
        super().__init__(Expense, session)

    async def get_all(
        self,
        property_id: uuid.UUID | None = None,
        category_id: uuid.UUID | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Expense]:
        stmt = select(Expense).where(Expense.is_deleted == False)
        if property_id:
            stmt = stmt.where(Expense.property_id == property_id)
        if category_id:
            stmt = stmt.where(Expense.category_id == category_id)
        if start_date:
            stmt = stmt.where(Expense.date >= start_date)
        if end_date:
            stmt = stmt.where(Expense.date <= end_date)

        stmt = stmt.order_by(Expense.date.desc()).offset(skip).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_total_expenses(
        self,
        property_id: uuid.UUID | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict:
        stmt = (
            select(
                func.coalesce(func.sum(Expense.amount), 0.0).label("total"),
                func.count(Expense.id).label("count"),
            )
            .where(Expense.is_deleted == False)
        )
        if property_id:
            stmt = stmt.where(Expense.property_id == property_id)
        if start_date:
            stmt = stmt.where(Expense.date >= start_date)
        if end_date:
            stmt = stmt.where(Expense.date <= end_date)

        result = await self.session.execute(stmt)
        row = result.one()
        return {"total": float(row.total), "count": int(row.count)}

    async def get_monthly_expenses(
        self,
        year: int,
        property_id: uuid.UUID | None = None,
    ) -> list[dict]:
        stmt = (
            select(
                extract("month", Expense.date).label("month"),
                func.coalesce(func.sum(Expense.amount), 0.0).label("total"),
                func.count(Expense.id).label("count"),
            )
            .where(
                Expense.is_deleted == False,
                extract("year", Expense.date) == year,
            )
            .group_by(extract("month", Expense.date))
            .order_by(extract("month", Expense.date))
        )
        if property_id:
            stmt = stmt.where(Expense.property_id == property_id)

        result = await self.session.execute(stmt)
        return [
            {"month": int(row.month), "total": float(row.total), "count": int(row.count)}
            for row in result
        ]

    async def get_expenses_by_category(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[dict]:
        from app.finance.category_models import ExpenseCategory
        stmt = (
            select(
                func.coalesce(ExpenseCategory.name, "Uncategorized").label("name"),
                func.coalesce(func.sum(Expense.amount), 0.0).label("total"),
                func.count(Expense.id).label("count"),
            )
            .outerjoin(ExpenseCategory, Expense.category_id == ExpenseCategory.id)
            .where(Expense.is_deleted == False)
        )
        if start_date:
            stmt = stmt.where(Expense.date >= start_date)
        if end_date:
            stmt = stmt.where(Expense.date <= end_date)

        total_exp = await self.get_total_expenses(start_date=start_date, end_date=end_date)
        total_amt = total_exp["total"] or 1.0

        stmt = stmt.group_by(ExpenseCategory.name).order_by(func.sum(Expense.amount).desc())
        result = await self.session.execute(stmt)
        return [
            {
                "category_name": row.name,
                "total": float(row.total),
                "percentage": round(float(row.total) / total_amt * 100, 1) if total_amt else 0,
                "count": int(row.count),
            }
            for row in result
        ]

    async def get_expenses_by_property(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[dict]:
        from app.properties.models import Property
        stmt = (
            select(
                Property.id.label("property_id"),
                Property.name.label("property_name"),
                func.coalesce(func.sum(Expense.amount), 0.0).label("total"),
                func.count(Expense.id).label("count"),
            )
            .join(Property, Expense.property_id == Property.id)
            .where(Expense.is_deleted == False)
        )
        if start_date:
            stmt = stmt.where(Expense.date >= start_date)
        if end_date:
            stmt = stmt.where(Expense.date <= end_date)

        stmt = stmt.group_by(Property.id, Property.name).order_by(func.sum(Expense.amount).desc())
        result = await self.session.execute(stmt)
        return [
            {
                "property_id": str(row.property_id),
                "property_name": row.property_name,
                "total": float(row.total),
                "count": int(row.count),
            }
            for row in result
        ]
