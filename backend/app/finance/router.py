"""
Finance Module — Router

Endpoints for revenue, expenses, financial dashboard, and reports.
"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from app.finance.schemas import (
    AnnualReport,
    ExpenseCreateRequest,
    ExpenseResponse,
    ExpenseUpdateRequest,
    FinancialSummary,
    MonthlyReport,
    RevenueCreateRequest,
    RevenueResponse,
    RevenueUpdateRequest,
)
from app.finance.service import (
    ExpenseService,
    FinancialReportingService,
    RevenueService,
    get_expense_service,
    get_reporting_service,
    get_revenue_service,
)

router = APIRouter()


# ── Revenue Endpoints ─────────────────────────────────────

@router.post("/revenue", response_model=RevenueResponse, status_code=201)
async def create_revenue(
    data: RevenueCreateRequest,
    service: RevenueService = Depends(get_revenue_service),
):
    """Record a new revenue entry."""
    return await service.create(data)


@router.get("/revenue", response_model=list[RevenueResponse])
async def list_revenue(
    property_id: str | None = None,
    category_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: RevenueService = Depends(get_revenue_service),
):
    """List revenue entries with filtering."""
    return await service.list_all(
        property_id=uuid.UUID(property_id) if property_id else None,
        category_id=uuid.UUID(category_id) if category_id else None,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )


@router.get("/revenue/{revenue_id}", response_model=RevenueResponse)
async def get_revenue(
    revenue_id: str,
    service: RevenueService = Depends(get_revenue_service),
):
    return await service.get_by_id(uuid.UUID(revenue_id))


@router.patch("/revenue/{revenue_id}", response_model=RevenueResponse)
async def update_revenue(
    revenue_id: str,
    data: RevenueUpdateRequest,
    service: RevenueService = Depends(get_revenue_service),
):
    return await service.update(uuid.UUID(revenue_id), data)


@router.delete("/revenue/{revenue_id}", status_code=204)
async def delete_revenue(
    revenue_id: str,
    service: RevenueService = Depends(get_revenue_service),
):
    """Soft-delete a revenue record."""
    await service.delete(uuid.UUID(revenue_id))


# ── Expense Endpoints ──────────────────────────────────────

@router.post("/expense", response_model=ExpenseResponse, status_code=201)
async def create_expense(
    data: ExpenseCreateRequest,
    service: ExpenseService = Depends(get_expense_service),
):
    """Record a new expense entry."""
    return await service.create(data)


@router.get("/expense", response_model=list[ExpenseResponse])
async def list_expenses(
    property_id: str | None = None,
    category_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: ExpenseService = Depends(get_expense_service),
):
    """List expense entries with filtering."""
    return await service.list_all(
        property_id=uuid.UUID(property_id) if property_id else None,
        category_id=uuid.UUID(category_id) if category_id else None,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )


@router.get("/expense/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: str,
    service: ExpenseService = Depends(get_expense_service),
):
    return await service.get_by_id(uuid.UUID(expense_id))


@router.patch("/expense/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: str,
    data: ExpenseUpdateRequest,
    service: ExpenseService = Depends(get_expense_service),
):
    return await service.update(uuid.UUID(expense_id), data.model_dump(exclude_unset=True))


@router.delete("/expense/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: str,
    service: ExpenseService = Depends(get_expense_service),
):
    """Soft-delete an expense record."""
    await service.delete(uuid.UUID(expense_id))


# ── Financial Dashboard & Reports ──────────────────────────

@router.get("/summary", response_model=FinancialSummary)
async def get_financial_summary(
    start_date: date | None = None,
    end_date: date | None = None,
    service: FinancialReportingService = Depends(get_reporting_service),
):
    """Get the financial dashboard summary (KPIs)."""
    return await service.get_summary(start_date=start_date, end_date=end_date)


@router.get("/report/monthly", response_model=MonthlyReport)
async def get_monthly_report(
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    service: FinancialReportingService = Depends(get_reporting_service),
):
    """Generate a complete monthly financial report."""
    return await service.get_monthly_report(year, month)


@router.get("/report/annual", response_model=AnnualReport)
async def get_annual_report(
    year: int | None = Query(None, ge=2020, le=2100),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    service: FinancialReportingService = Depends(get_reporting_service),
):
    """Complete annual financial report — for a year or a custom date range."""
    if (start_date is None) != (end_date is None):
        raise HTTPException(
            status_code=422,
            detail="start_date and end_date must be provided together",
        )
    if start_date and end_date:
        return await service.get_range_annual_report(start_date, end_date)
    y = year or date.today().year
    return await service.get_annual_report(y)
