"""
Finance Module — Service Layer

Business logic for revenue, expenses, cashflow, and financial reporting.
All KPI calculations happen here — never in the router.
"""
import uuid
from calendar import monthrange
from datetime import date, datetime, timezone

from fastapi import Depends
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.finance.category_models import ExpenseCategory, RevenueCategory
from app.finance.models import Expense, Revenue
from app.finance.repository import ExpenseRepository, RevenueRepository
from app.finance.schemas import (
    AnnualReport,
    CategoryBreakdown,
    CategoryCreateRequest,
    CategoryUpdateRequest,
    ExpenseCategoryResponse,
    ExpenseCreateRequest,
    ExpenseResponse,
    FinancialSummary,
    MonthlyBreakdown,
    MonthlyReport,
    PropertyFinancialSummary,
    RevenueCategoryResponse,
    RevenueCreateRequest,
    RevenueResponse,
    RevenueUpdateRequest,
)
from app.shared.exceptions import NotFoundException, ValidationException


async def _find_or_create_category(
    session: AsyncSession,
    model: type[ExpenseCategory] | type[RevenueCategory],
    name: str,
) -> uuid.UUID:
    """Find a category by name (case-insensitive) or create it.

    Mirrors the CSV importer: a record's free-text description becomes its
    category when the user didn't pick one explicitly.
    """
    cat = (await session.execute(
        select(model).where(
            model.is_deleted == False,
            func.lower(model.name) == name.lower(),
        )
    )).scalar_one_or_none()
    if not cat:
        cat = model(name=name)
        session.add(cat)
        await session.flush()
    return cat.id


class RevenueService:
    """Business logic for revenue records."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = RevenueRepository(session)

    async def create(
        self, data: RevenueCreateRequest
    ) -> RevenueResponse:
        """Create a revenue record. Auto-calculates net_amount."""
        net = data.gross_amount - data.commission_amount
        category_id = uuid.UUID(data.category_id) if data.category_id else None
        desc = (data.description or "").strip()
        if not category_id and desc:
            category_id = await _find_or_create_category(self.session, RevenueCategory, desc)

        revenue = Revenue(
            property_id=uuid.UUID(data.property_id),
            reservation_id=uuid.UUID(data.reservation_id) if data.reservation_id else None,
            category_id=category_id,
            date=data.date,
            gross_amount=data.gross_amount,
            commission_amount=data.commission_amount,
            net_amount=net,
            source=data.source,
            currency=data.currency,
            description=data.description,
            notes=data.notes,
        )
        revenue = await self.repo.create(revenue)
        return RevenueResponse.model_validate(revenue)

    async def get_by_id(self, revenue_id: uuid.UUID) -> RevenueResponse:
        r = await self.repo.get_by_id(revenue_id)
        if not r:
            raise NotFoundException("Revenue", str(revenue_id))
        return RevenueResponse.model_validate(r)

    async def list_all(
        self,
        property_id: uuid.UUID | None = None,
        category_id: uuid.UUID | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[RevenueResponse]:
        records = await self.repo.get_all(
            property_id=property_id,
            category_id=category_id,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
        )
        return [RevenueResponse.model_validate(r) for r in records]

    async def update(
        self, revenue_id: uuid.UUID, data: RevenueUpdateRequest
    ) -> RevenueResponse:
        r = await self.repo.get_by_id(revenue_id)
        if not r:
            raise NotFoundException("Revenue", str(revenue_id))

        if data.gross_amount is not None:
            r.gross_amount = data.gross_amount
            r.net_amount = r.gross_amount - r.commission_amount
        if data.commission_amount is not None:
            r.commission_amount = data.commission_amount
            r.net_amount = r.gross_amount - r.commission_amount
        if data.category_id is not None:
            r.category_id = uuid.UUID(data.category_id)
        if data.description is not None:
            r.description = data.description
        if data.notes is not None:
            r.notes = data.notes

        return RevenueResponse.model_validate(r)

    async def delete(self, revenue_id: uuid.UUID) -> None:
        """Soft-delete a revenue record."""
        r = await self.repo.get_by_id(revenue_id)
        if not r:
            raise NotFoundException("Revenue", str(revenue_id))
        r.is_deleted = True
        r.deleted_at = datetime.utcnow()
        await self.session.flush()


class ExpenseService:
    """Business logic for expense records."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ExpenseRepository(session)

    async def create(
        self, data: ExpenseCreateRequest
    ) -> ExpenseResponse:
        category_id = uuid.UUID(data.category_id) if data.category_id else None
        desc = (data.description or "").strip()
        if not category_id and desc:
            category_id = await _find_or_create_category(self.session, ExpenseCategory, desc)

        expense = Expense(
            property_id=uuid.UUID(data.property_id),
            category_id=category_id,
            date=data.date,
            amount=data.amount,
            currency=data.currency,
            vendor=data.vendor,
            payment_method=data.payment_method,
            description=data.description,
            notes=data.notes,
            is_recurring=data.is_recurring,
        )
        expense = await self.repo.create(expense)
        return ExpenseResponse.model_validate(expense)

    async def get_by_id(self, expense_id: uuid.UUID) -> ExpenseResponse:
        e = await self.repo.get_by_id(expense_id)
        if not e:
            raise NotFoundException("Expense", str(expense_id))
        return ExpenseResponse.model_validate(e)

    async def list_all(
        self,
        property_id: uuid.UUID | None = None,
        category_id: uuid.UUID | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ExpenseResponse]:
        records = await self.repo.get_all(
            property_id=property_id,
            category_id=category_id,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
        )
        return [ExpenseResponse.model_validate(e) for e in records]

    async def update(
        self, expense_id: uuid.UUID, data: dict
    ) -> ExpenseResponse:
        """Update an expense record with a partial set of fields."""
        e = await self.repo.get_by_id(expense_id)
        if not e:
            raise NotFoundException("Expense", str(expense_id))
        for field, value in data.items():
            if field in ("property_id", "category_id") and value:
                setattr(e, field, uuid.UUID(value))
            elif field == "is_recurring":
                setattr(e, field, bool(value))
            elif value is not None:
                setattr(e, field, value)
        return ExpenseResponse.model_validate(e)

    async def delete(self, expense_id: uuid.UUID) -> None:
        """Soft-delete an expense record."""
        e = await self.repo.get_by_id(expense_id)
        if not e:
            raise NotFoundException("Expense", str(expense_id))
        e.is_deleted = True
        e.deleted_at = datetime.utcnow()
        await self.session.flush()


class PeriodReport:
    """Lightweight date-range financial report.

    Mirrors the fields of `AnnualReport` (so report consumers can treat a
    custom period and a calendar year identically) but is bucketed to whatever
    months intersect `[start_date, end_date]`.
    """

    def __init__(
        self,
        start_date: date,
        end_date: date,
        summary: FinancialSummary,
        monthly_breakdown: list[MonthlyBreakdown],
        revenue_by_category: list[CategoryBreakdown],
        expense_by_category: list[CategoryBreakdown],
        revenue_by_property: list[PropertyFinancialSummary],
        best_month: MonthlyBreakdown | None = None,
        worst_month: MonthlyBreakdown | None = None,
    ):
        self.start_date = start_date
        self.end_date = end_date
        self.summary = summary
        self.monthly_breakdown = monthly_breakdown
        self.revenue_by_category = revenue_by_category
        self.expense_by_category = expense_by_category
        self.revenue_by_property = revenue_by_property
        self.best_month = best_month
        self.worst_month = worst_month


class FinancialReportingService:
    """
    Core financial analytics engine.

    Generates dashboards, monthly reports, annual reports, and all KPIs.
    All calculations are query-driven — never stored as pre-calculated fields.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.rev_repo = RevenueRepository(session)
        self.exp_repo = ExpenseRepository(session)

    async def get_summary(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> FinancialSummary:
        """Dashboard-level financial summary."""
        from app.properties.repository import PropertyRepository
        prop_repo = PropertyRepository(self.session)

        rev = await self.rev_repo.get_total_revenue(start_date=start_date, end_date=end_date)
        exp = await self.exp_repo.get_total_expenses(start_date=start_date, end_date=end_date)
        prop_count = await prop_repo.count_all()

        gross = rev["gross"]
        net = rev["net"]
        expenses = exp["total"]
        cashflow = net - expenses
        profit = net - expenses
        margin = (profit / net * 100) if net > 0 else 0.0
        avg_per_prop = (net / prop_count) if prop_count > 0 else 0.0

        return FinancialSummary(
            gross_revenue=round(gross, 2),
            net_revenue=round(net, 2),
            total_expenses=round(expenses, 2),
            cashflow=round(cashflow, 2),
            profit=round(profit, 2),
            profit_margin=round(margin, 2),
            property_count=prop_count,
            avg_revenue_per_property=round(avg_per_prop, 2),
        )

    async def get_period_report(
        self,
        start_date: date,
        end_date: date,
    ) -> PeriodReport:
        """Complete financial report for an arbitrary date range.

        Composes the same primitives as `get_annual_report` but bucketed to
        whatever months intersect `[start_date, end_date]`, so a custom period
        (a quarter, a season, a partial year) yields identical report sections
        without pretending to be a calendar year.
        """
        summary = await self.get_summary(start_date, end_date)
        monthly_breakdown = await self._get_monthly_buckets(start_date, end_date)

        rev_cats = await self.rev_repo.get_revenue_by_category(start_date, end_date)
        exp_cats = await self.exp_repo.get_expenses_by_category(start_date, end_date)

        rev_props = await self.rev_repo.get_revenue_by_property(start_date, end_date)
        exp_props = await self.exp_repo.get_expenses_by_property(start_date, end_date)

        best_month = max(monthly_breakdown, key=lambda m: m.profit) if monthly_breakdown else None
        worst_month = min(monthly_breakdown, key=lambda m: m.profit) if monthly_breakdown else None

        return PeriodReport(
            start_date=start_date,
            end_date=end_date,
            summary=summary,
            monthly_breakdown=monthly_breakdown,
            revenue_by_category=[CategoryBreakdown(**c) for c in rev_cats],
            expense_by_category=[CategoryBreakdown(**c) for c in exp_cats],
            revenue_by_property=self._merge_property_breakdown(rev_props, exp_props),
            best_month=best_month,
            worst_month=worst_month,
        )

    async def _get_monthly_buckets(
        self,
        start_date: date,
        end_date: date,
    ) -> list[MonthlyBreakdown]:
        """Revenue/expense per month for every month in the range.

        Uses the per-year aggregation queries (which only return months that
        have data) and walks the calendar from `start_date` to `end_date`, so a
        partial month is represented by the records that actually fall in the
        range rather than an assumed full month.
        """
        rev_by_key: dict[tuple[int, int], dict] = {}
        exp_by_key: dict[tuple[int, int], dict] = {}
        for y in range(start_date.year, end_date.year + 1):
            for rm in await self.rev_repo.get_monthly_revenue(y):
                rev_by_key[(y, rm["month"])] = rm
            for em in await self.exp_repo.get_monthly_expenses(y):
                exp_by_key[(y, em["month"])] = em

        buckets: list[MonthlyBreakdown] = []
        y, m = start_date.year, start_date.month
        while (y, m) <= (end_date.year, end_date.month):
            rm = rev_by_key.get((y, m))
            em = exp_by_key.get((y, m))
            gross = rm["gross"] if rm else 0.0
            net = rm["net"] if rm else 0.0
            expenses = em["total"] if em else 0.0
            profit = net - expenses
            buckets.append(MonthlyBreakdown(
                month=m, year=y,
                gross_revenue=round(gross, 2),
                net_revenue=round(net, 2),
                total_expenses=round(expenses, 2),
                cashflow=round(profit, 2),
                profit=round(profit, 2),
                reservation_count=rm["count"] if rm else 0,
            ))
            if m == 12:
                y += 1
                m = 1
            else:
                m += 1
        return buckets

    @staticmethod
    def _merge_property_breakdown(
        rev_props: list[dict],
        exp_props: list[dict],
    ) -> list[PropertyFinancialSummary]:
        """Merge per-property revenue & expenses into one ranked list."""
        prop_map: dict[str, dict] = {}
        for rp in rev_props:
            prop_map[rp["property_id"]] = {
                "property_id": rp["property_id"],
                "property_name": rp["property_name"],
                "gross_revenue": rp["gross"],
                "net_revenue": rp["net"],
                "total_expenses": 0.0,
                "reservation_count": rp["count"],
            }
        for ep in exp_props:
            if ep["property_id"] in prop_map:
                prop_map[ep["property_id"]]["total_expenses"] = ep["total"]
            else:
                prop_map[ep["property_id"]] = {
                    "property_id": ep["property_id"],
                    "property_name": ep["property_name"],
                    "gross_revenue": 0.0,
                    "net_revenue": 0.0,
                    "total_expenses": ep["total"],
                    "reservation_count": 0,
                }

        result = []
        for p in prop_map.values():
            profit_val = p["net_revenue"] - p["total_expenses"]
            margin_val = (profit_val / p["net_revenue"] * 100) if p["net_revenue"] > 0 else 0.0
            result.append(PropertyFinancialSummary(
                property_id=p["property_id"],
                property_name=p["property_name"],
                gross_revenue=round(p["gross_revenue"], 2),
                net_revenue=round(p["net_revenue"], 2),
                total_expenses=round(p["total_expenses"], 2),
                profit=round(profit_val, 2),
                profit_margin=round(margin_val, 2),
                reservation_count=p["reservation_count"],
            ))
        result.sort(key=lambda x: x.net_revenue, reverse=True)
        return result

    async def get_monthly_report(
        self,
        year: int,
        month: int,
    ) -> MonthlyReport:
        """Complete monthly financial report."""
        # Month range
        start_date = date(year, month, 1)
        _, last_day = monthrange(year, month)
        end_date = date(year, month, last_day)

        summary = await self.get_summary(start_date, end_date)

        # Year-to-date monthly trend
        rev_monthly = await self.rev_repo.get_monthly_revenue(year)
        exp_monthly = await self.exp_repo.get_monthly_expenses(year)

        monthly_trend = []
        for m in range(1, 13):
            rev_m = next((r for r in rev_monthly if r["month"] == m), None)
            exp_m = next((e for e in exp_monthly if e["month"] == m), None)
            gross = rev_m["gross"] if rev_m else 0.0
            net = rev_m["net"] if rev_m else 0.0
            expenses = exp_m["total"] if exp_m else 0.0
            monthly_trend.append(MonthlyBreakdown(
                month=m,
                year=year,
                gross_revenue=round(gross, 2),
                net_revenue=round(net, 2),
                total_expenses=round(expenses, 2),
                cashflow=round(net - expenses, 2),
                profit=round(net - expenses, 2),
                reservation_count=rev_m["count"] if rev_m else 0,
            ))

        # Category breakdowns
        rev_cats = await self.rev_repo.get_revenue_by_category(start_date, end_date)
        exp_cats = await self.exp_repo.get_expenses_by_category(start_date, end_date)

        # Property breakdown
        rev_props = await self.rev_repo.get_revenue_by_property(start_date, end_date)
        exp_props = await self.exp_repo.get_expenses_by_property(start_date, end_date)

        # Merge property revenue & expenses
        prop_map: dict[str, dict] = {}
        for rp in rev_props:
            prop_map[rp["property_id"]] = {
                "property_id": rp["property_id"],
                "property_name": rp["property_name"],
                "gross_revenue": rp["gross"],
                "net_revenue": rp["net"],
                "total_expenses": 0.0,
                "reservation_count": rp["count"],
            }
        for ep in exp_props:
            if ep["property_id"] in prop_map:
                prop_map[ep["property_id"]]["total_expenses"] = ep["total"]
            else:
                prop_map[ep["property_id"]] = {
                    "property_id": ep["property_id"],
                    "property_name": ep["property_name"],
                    "gross_revenue": 0.0,
                    "net_revenue": 0.0,
                    "total_expenses": ep["total"],
                    "reservation_count": 0,
                }

        props_breakdown = []
        for p in prop_map.values():
            profit = p["net_revenue"] - p["total_expenses"]
            margin = (profit / p["net_revenue"] * 100) if p["net_revenue"] > 0 else 0.0
            props_breakdown.append(PropertyFinancialSummary(
                property_id=p["property_id"],
                property_name=p["property_name"],
                gross_revenue=round(p["gross_revenue"], 2),
                net_revenue=round(p["net_revenue"], 2),
                total_expenses=round(p["total_expenses"], 2),
                profit=round(profit, 2),
                profit_margin=round(margin, 2),
                reservation_count=p["reservation_count"],
            ))

        return MonthlyReport(
            month=month,
            year=year,
            summary=summary,
            monthly_trend=monthly_trend,
            revenue_by_category=[
                CategoryBreakdown(**c) for c in rev_cats
            ],
            expense_by_category=[
                CategoryBreakdown(**c) for c in exp_cats
            ],
            revenue_by_property=props_breakdown,
        )

    async def get_annual_report(
        self,
        year: int,
    ) -> AnnualReport:
        """Complete annual financial report with YoY comparison."""
        summary = await self.get_summary(
            start_date=date(year, 1, 1),
            end_date=date(year, 12, 31),
        )

        rev_monthly = await self.rev_repo.get_monthly_revenue(year)
        exp_monthly = await self.exp_repo.get_monthly_expenses(year)

        monthly_breakdown = []
        best_month = None
        worst_month = None

        for m in range(1, 13):
            rev_m = next((r for r in rev_monthly if r["month"] == m), None)
            exp_m = next((e for e in exp_monthly if e["month"] == m), None)
            gross = rev_m["gross"] if rev_m else 0.0
            net = rev_m["net"] if rev_m else 0.0
            expenses = exp_m["total"] if exp_m else 0.0
            profit = net - expenses
            mb = MonthlyBreakdown(
                month=m, year=year,
                gross_revenue=round(gross, 2),
                net_revenue=round(net, 2),
                total_expenses=round(expenses, 2),
                cashflow=round(profit, 2),
                profit=round(profit, 2),
                reservation_count=rev_m["count"] if rev_m else 0,
            )
            monthly_breakdown.append(mb)
            if best_month is None or profit > best_month.profit:
                best_month = mb
            if worst_month is None or profit < worst_month.profit:
                worst_month = mb

        # YoY growth — compare with previous year
        prev_summary = await self.get_summary(
            start_date=date(year - 1, 1, 1),
            end_date=date(year - 1, 12, 31),
        )
        yoy_growth = None
        if prev_summary.net_revenue > 0:
            yoy_growth = round(
                (summary.net_revenue - prev_summary.net_revenue) / prev_summary.net_revenue * 100, 2
            )

        rev_cats = await self.rev_repo.get_revenue_by_category(date(year, 1, 1), date(year, 12, 31))
        exp_cats = await self.exp_repo.get_expenses_by_category(date(year, 1, 1), date(year, 12, 31))

        # Property breakdown
        rev_props = await self.rev_repo.get_revenue_by_property(date(year, 1, 1), date(year, 12, 31))
        exp_props = await self.exp_repo.get_expenses_by_property(date(year, 1, 1), date(year, 12, 31))

        prop_map = {}
        for rp in rev_props:
            prop_map[rp["property_id"]] = {
                "property_id": rp["property_id"],
                "property_name": rp["property_name"],
                "gross_revenue": rp["gross"],
                "net_revenue": rp["net"],
                "total_expenses": 0.0,
                "reservation_count": rp["count"],
            }
        for ep in exp_props:
            if ep["property_id"] in prop_map:
                prop_map[ep["property_id"]]["total_expenses"] = ep["total"]
            else:
                prop_map[ep["property_id"]] = {
                    "property_id": ep["property_id"],
                    "property_name": ep["property_name"],
                    "gross_revenue": 0.0,
                    "net_revenue": 0.0,
                    "total_expenses": ep["total"],
                    "reservation_count": 0,
                }

        props_breakdown = []
        for p in prop_map.values():
            profit_val = p["net_revenue"] - p["total_expenses"]
            margin_val = (profit_val / p["net_revenue"] * 100) if p["net_revenue"] > 0 else 0.0
            props_breakdown.append(PropertyFinancialSummary(
                property_id=p["property_id"],
                property_name=p["property_name"],
                gross_revenue=round(p["gross_revenue"], 2),
                net_revenue=round(p["net_revenue"], 2),
                total_expenses=round(p["total_expenses"], 2),
                profit=round(profit_val, 2),
                profit_margin=round(margin_val, 2),
                reservation_count=p["reservation_count"],
            ))

        return AnnualReport(
            year=year,
            summary=summary,
            monthly_breakdown=monthly_breakdown,
            revenue_by_category=[CategoryBreakdown(**c) for c in rev_cats],
            expense_by_category=[CategoryBreakdown(**c) for c in exp_cats],
            revenue_by_property=props_breakdown,
            best_month=best_month,
            worst_month=worst_month,
            yoy_growth=yoy_growth,
        )

    async def get_range_annual_report(
        self,
        start_date: date,
        end_date: date,
    ) -> AnnualReport:
        """Annual-report shaped data for an arbitrary date range.

        Lets the dashboard render the same sections for a custom period as it
        does for a calendar year (charts, expense breakdown, latest report).
        """
        pr = await self.get_period_report(start_date, end_date)
        return AnnualReport(
            year=end_date.year,
            summary=pr.summary,
            monthly_breakdown=pr.monthly_breakdown,
            revenue_by_category=pr.revenue_by_category,
            expense_by_category=pr.expense_by_category,
            revenue_by_property=pr.revenue_by_property,
            best_month=pr.best_month,
            worst_month=pr.worst_month,
            yoy_growth=None,
        )


class CategoryService:
    """Business logic for expense & revenue categories
    (create / rename / merge / delete).
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    # ── Helpers ──────────────────────────────────────────────

    async def _get_expense_category(self, category_id: uuid.UUID) -> ExpenseCategory:
        cat = (await self.session.execute(
            select(ExpenseCategory).where(
                ExpenseCategory.id == category_id,
                ExpenseCategory.is_deleted == False,
            )
        )).scalar_one_or_none()
        if not cat:
            raise NotFoundException("Expense category", str(category_id))
        return cat

    async def _get_revenue_category(self, category_id: uuid.UUID) -> RevenueCategory:
        cat = (await self.session.execute(
            select(RevenueCategory).where(
                RevenueCategory.id == category_id,
                RevenueCategory.is_deleted == False,
            )
        )).scalar_one_or_none()
        if not cat:
            raise NotFoundException("Revenue category", str(category_id))
        return cat

    async def _expense_counts(self) -> dict[uuid.UUID, int]:
        rows = await self.session.execute(
            select(Expense.category_id, func.count(Expense.id))
            .where(Expense.is_deleted == False, Expense.category_id.is_not(None))
            .group_by(Expense.category_id)
        )
        return {cid: int(n) for cid, n in rows.all()}

    async def _revenue_counts(self) -> dict[uuid.UUID, int]:
        rows = await self.session.execute(
            select(Revenue.category_id, func.count(Revenue.id))
            .where(Revenue.is_deleted == False, Revenue.category_id.is_not(None))
            .group_by(Revenue.category_id)
        )
        return {cid: int(n) for cid, n in rows.all()}

    async def _expense_name_exists(self, name: str, exclude_id: uuid.UUID | None = None) -> bool:
        stmt = select(ExpenseCategory.id).where(
            ExpenseCategory.is_deleted == False,
            func.lower(ExpenseCategory.name) == name.lower(),
        )
        if exclude_id:
            stmt = stmt.where(ExpenseCategory.id != exclude_id)
        return (await self.session.execute(stmt)).scalar_one_or_none() is not None

    async def _revenue_name_exists(self, name: str, exclude_id: uuid.UUID | None = None) -> bool:
        stmt = select(RevenueCategory.id).where(
            RevenueCategory.is_deleted == False,
            func.lower(RevenueCategory.name) == name.lower(),
        )
        if exclude_id:
            stmt = stmt.where(RevenueCategory.id != exclude_id)
        return (await self.session.execute(stmt)).scalar_one_or_none() is not None

    # ── Expense categories ───────────────────────────────────

    async def list_expense_categories(self) -> list[ExpenseCategoryResponse]:
        cats = (await self.session.execute(
            select(ExpenseCategory)
            .where(ExpenseCategory.is_deleted == False)
            .order_by(ExpenseCategory.sort_order, ExpenseCategory.name)
        )).scalars().all()
        counts = await self._expense_counts()
        result = []
        for cat in cats:
            resp = ExpenseCategoryResponse.model_validate(cat)
            resp.expense_count = counts.get(cat.id, 0)
            result.append(resp)
        return result

    async def create_expense_category(self, data: CategoryCreateRequest) -> ExpenseCategoryResponse:
        name = data.name.strip()
        if not name:
            raise ValidationException("Category name is required")
        if await self._expense_name_exists(name):
            raise ValidationException(f"A category named '{name}' already exists")
        cat = ExpenseCategory(
            name=name,
            description=(data.description or "").strip() or None,
        )
        self.session.add(cat)
        await self.session.flush()
        return ExpenseCategoryResponse.model_validate(cat)

    async def update_expense_category(
        self, category_id: uuid.UUID, data: CategoryUpdateRequest
    ) -> ExpenseCategoryResponse:
        cat = await self._get_expense_category(category_id)
        if data.name is not None:
            name = data.name.strip()
            if not name:
                raise ValidationException("Category name cannot be empty")
            if await self._expense_name_exists(name, exclude_id=category_id):
                raise ValidationException(f"A category named '{name}' already exists")
            cat.name = name
        if data.description is not None:
            cat.description = data.description.strip() or None
        await self.session.flush()
        resp = ExpenseCategoryResponse.model_validate(cat)
        resp.expense_count = (await self._expense_counts()).get(category_id, 0)
        return resp

    async def merge_expense_category(
        self, category_id: uuid.UUID, target_id: uuid.UUID
    ) -> ExpenseCategoryResponse:
        if category_id == target_id:
            raise ValidationException("Cannot merge a category into itself")
        await self._get_expense_category(category_id)
        target = await self._get_expense_category(target_id)
        await self.session.execute(
            update(Expense)
            .where(Expense.category_id == category_id, Expense.is_deleted == False)
            .values(category_id=target_id)
        )
        await self.session.execute(
            update(ExpenseCategory)
            .where(ExpenseCategory.id == category_id)
            .values(is_deleted=True, deleted_at=datetime.now(timezone.utc))
        )
        await self.session.flush()
        resp = ExpenseCategoryResponse.model_validate(target)
        resp.expense_count = (await self._expense_counts()).get(target_id, 0)
        return resp

    async def delete_expense_category(self, category_id: uuid.UUID) -> dict:
        cat = await self._get_expense_category(category_id)
        if cat.is_default:
            raise ValidationException("Default categories cannot be deleted — merge them instead.")
        await self.session.execute(
            update(Expense)
            .where(Expense.category_id == category_id, Expense.is_deleted == False)
            .values(category_id=None)
        )
        await self.session.execute(
            update(ExpenseCategory)
            .where(ExpenseCategory.id == category_id)
            .values(is_deleted=True, deleted_at=datetime.now(timezone.utc))
        )
        await self.session.flush()
        return {"deleted": True, "name": cat.name}

    # ── Revenue categories ───────────────────────────────────

    async def list_revenue_categories(self) -> list[RevenueCategoryResponse]:
        cats = (await self.session.execute(
            select(RevenueCategory)
            .where(RevenueCategory.is_deleted == False)
            .order_by(RevenueCategory.sort_order, RevenueCategory.name)
        )).scalars().all()
        counts = await self._revenue_counts()
        result = []
        for cat in cats:
            resp = RevenueCategoryResponse.model_validate(cat)
            resp.revenue_count = counts.get(cat.id, 0)
            result.append(resp)
        return result

    async def create_revenue_category(self, data: CategoryCreateRequest) -> RevenueCategoryResponse:
        name = data.name.strip()
        if not name:
            raise ValidationException("Category name is required")
        if await self._revenue_name_exists(name):
            raise ValidationException(f"A category named '{name}' already exists")
        cat = RevenueCategory(
            name=name,
            description=(data.description or "").strip() or None,
        )
        self.session.add(cat)
        await self.session.flush()
        return RevenueCategoryResponse.model_validate(cat)

    async def update_revenue_category(
        self, category_id: uuid.UUID, data: CategoryUpdateRequest
    ) -> RevenueCategoryResponse:
        cat = await self._get_revenue_category(category_id)
        if data.name is not None:
            name = data.name.strip()
            if not name:
                raise ValidationException("Category name cannot be empty")
            if await self._revenue_name_exists(name, exclude_id=category_id):
                raise ValidationException(f"A category named '{name}' already exists")
            cat.name = name
        if data.description is not None:
            cat.description = data.description.strip() or None
        await self.session.flush()
        resp = RevenueCategoryResponse.model_validate(cat)
        resp.revenue_count = (await self._revenue_counts()).get(category_id, 0)
        return resp

    async def merge_revenue_category(
        self, category_id: uuid.UUID, target_id: uuid.UUID
    ) -> RevenueCategoryResponse:
        if category_id == target_id:
            raise ValidationException("Cannot merge a category into itself")
        await self._get_revenue_category(category_id)
        target = await self._get_revenue_category(target_id)
        await self.session.execute(
            update(Revenue)
            .where(Revenue.category_id == category_id, Revenue.is_deleted == False)
            .values(category_id=target_id)
        )
        await self.session.execute(
            update(RevenueCategory)
            .where(RevenueCategory.id == category_id)
            .values(is_deleted=True, deleted_at=datetime.now(timezone.utc))
        )
        await self.session.flush()
        resp = RevenueCategoryResponse.model_validate(target)
        resp.revenue_count = (await self._revenue_counts()).get(target_id, 0)
        return resp

    async def delete_revenue_category(self, category_id: uuid.UUID) -> dict:
        cat = await self._get_revenue_category(category_id)
        if cat.is_default:
            raise ValidationException("Default categories cannot be deleted — merge them instead.")
        await self.session.execute(
            update(Revenue)
            .where(Revenue.category_id == category_id, Revenue.is_deleted == False)
            .values(category_id=None)
        )
        await self.session.execute(
            update(RevenueCategory)
            .where(RevenueCategory.id == category_id)
            .values(is_deleted=True, deleted_at=datetime.now(timezone.utc))
        )
        await self.session.flush()
        return {"deleted": True, "name": cat.name}


# FastAPI dependencies
async def get_revenue_service(
    session: AsyncSession = Depends(get_db),
) -> RevenueService:
    return RevenueService(session)


async def get_expense_service(
    session: AsyncSession = Depends(get_db),
) -> ExpenseService:
    return ExpenseService(session)


async def get_reporting_service(
    session: AsyncSession = Depends(get_db),
) -> FinancialReportingService:
    return FinancialReportingService(session)


async def get_category_service(
    session: AsyncSession = Depends(get_db),
) -> CategoryService:
    return CategoryService(session)
