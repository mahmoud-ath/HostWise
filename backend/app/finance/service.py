"""
Finance Module — Service Layer

Business logic for revenue, expenses, cashflow, and financial reporting.
All KPI calculations happen here — never in the router.
"""
import uuid
from datetime import date
from calendar import monthrange
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.shared.exceptions import NotFoundException, ValidationException
from app.finance.models import Revenue, Expense
from app.finance.schemas import (
    RevenueCreateRequest,
    RevenueUpdateRequest,
    RevenueResponse,
    ExpenseCreateRequest,
    ExpenseResponse,
    FinancialSummary,
    MonthlyBreakdown,
    CategoryBreakdown,
    PropertyFinancialSummary,
    MonthlyReport,
    AnnualReport,
)
from app.finance.repository import RevenueRepository, ExpenseRepository


class RevenueService:
    """Business logic for revenue records."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = RevenueRepository(session)

    async def create(
        self, organization_id: uuid.UUID, data: RevenueCreateRequest
    ) -> RevenueResponse:
        """Create a revenue record. Auto-calculates net_amount."""
        net = data.gross_amount - data.commission_amount

        revenue = Revenue(
            organization_id=organization_id,
            property_id=uuid.UUID(data.property_id),
            reservation_id=uuid.UUID(data.reservation_id) if data.reservation_id else None,
            category_id=uuid.UUID(data.category_id) if data.category_id else None,
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

    async def list_organization(
        self,
        organization_id: uuid.UUID,
        property_id: uuid.UUID | None = None,
        category_id: uuid.UUID | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[RevenueResponse]:
        records = await self.repo.get_by_organization(
            organization_id,
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


class ExpenseService:
    """Business logic for expense records."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ExpenseRepository(session)

    async def create(
        self, organization_id: uuid.UUID, data: ExpenseCreateRequest
    ) -> ExpenseResponse:
        expense = Expense(
            organization_id=organization_id,
            property_id=uuid.UUID(data.property_id),
            category_id=uuid.UUID(data.category_id) if data.category_id else None,
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

    async def list_organization(
        self,
        organization_id: uuid.UUID,
        property_id: uuid.UUID | None = None,
        category_id: uuid.UUID | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ExpenseResponse]:
        records = await self.repo.get_by_organization(
            organization_id,
            property_id=property_id,
            category_id=category_id,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
        )
        return [ExpenseResponse.model_validate(e) for e in records]


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
        organization_id: uuid.UUID,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> FinancialSummary:
        """Dashboard-level financial summary."""
        from app.properties.repository import PropertyRepository
        prop_repo = PropertyRepository(self.session)

        rev = await self.rev_repo.get_total_revenue(
            organization_id, start_date=start_date, end_date=end_date
        )
        exp = await self.exp_repo.get_total_expenses(
            organization_id, start_date=start_date, end_date=end_date
        )
        prop_count = await prop_repo.count_by_organization(organization_id)

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

    async def get_monthly_report(
        self,
        organization_id: uuid.UUID,
        year: int,
        month: int,
    ) -> MonthlyReport:
        """Complete monthly financial report."""
        # Month range
        start_date = date(year, month, 1)
        _, last_day = monthrange(year, month)
        end_date = date(year, month, last_day)

        summary = await self.get_summary(organization_id, start_date, end_date)

        # Year-to-date monthly trend
        rev_monthly = await self.rev_repo.get_monthly_revenue(organization_id, year)
        exp_monthly = await self.exp_repo.get_monthly_expenses(organization_id, year)

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
        rev_cats = await self.rev_repo.get_revenue_by_category(
            organization_id, start_date, end_date
        )
        exp_cats = await self.exp_repo.get_expenses_by_category(
            organization_id, start_date, end_date
        )

        # Property breakdown
        rev_props = await self.rev_repo.get_revenue_by_property(
            organization_id, start_date, end_date
        )
        exp_props = await self.exp_repo.get_expenses_by_property(
            organization_id, start_date, end_date
        )

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
        organization_id: uuid.UUID,
        year: int,
    ) -> AnnualReport:
        """Complete annual financial report with YoY comparison."""
        summary = await self.get_summary(
            organization_id,
            start_date=date(year, 1, 1),
            end_date=date(year, 12, 31),
        )

        rev_monthly = await self.rev_repo.get_monthly_revenue(organization_id, year)
        exp_monthly = await self.exp_repo.get_monthly_expenses(organization_id, year)

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
            organization_id,
            start_date=date(year - 1, 1, 1),
            end_date=date(year - 1, 12, 31),
        )
        yoy_growth = None
        if prev_summary.net_revenue > 0:
            yoy_growth = round(
                (summary.net_revenue - prev_summary.net_revenue) / prev_summary.net_revenue * 100, 2
            )

        rev_cats = await self.rev_repo.get_revenue_by_category(
            organization_id, date(year, 1, 1), date(year, 12, 31)
        )
        exp_cats = await self.exp_repo.get_expenses_by_category(
            organization_id, date(year, 1, 1), date(year, 12, 31)
        )

        # Property breakdown
        rev_props = await self.rev_repo.get_revenue_by_property(
            organization_id, date(year, 1, 1), date(year, 12, 31)
        )
        exp_props = await self.exp_repo.get_expenses_by_property(
            organization_id, date(year, 1, 1), date(year, 12, 31)
        )

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
