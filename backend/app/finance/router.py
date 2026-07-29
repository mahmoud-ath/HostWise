"""
Finance Module — Router

Endpoints for revenue, expenses, financial dashboard, and reports.
"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.finance.schemas import (
    AnnualReport,
    ExpenseCreateRequest,
    ExpenseResponse,
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

@router.post("/{org_id}/revenue", response_model=RevenueResponse, status_code=201)
async def create_revenue(
    org_id: str,
    data: RevenueCreateRequest,
    current_user: User = Depends(get_current_user),
    service: RevenueService = Depends(get_revenue_service),
):
    """Record a new revenue entry."""
    return await service.create(uuid.UUID(org_id), data)


@router.get("/{org_id}/revenue", response_model=list[RevenueResponse])
async def list_revenue(
    org_id: str,
    property_id: str | None = None,
    category_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: RevenueService = Depends(get_revenue_service),
):
    """List revenue entries with filtering."""
    return await service.list_organization(
        uuid.UUID(org_id),
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


# ── Expense Endpoints ──────────────────────────────────────

@router.post("/{org_id}/expense", response_model=ExpenseResponse, status_code=201)
async def create_expense(
    org_id: str,
    data: ExpenseCreateRequest,
    current_user: User = Depends(get_current_user),
    service: ExpenseService = Depends(get_expense_service),
):
    """Record a new expense entry."""
    return await service.create(uuid.UUID(org_id), data)


@router.get("/{org_id}/expense", response_model=list[ExpenseResponse])
async def list_expenses(
    org_id: str,
    property_id: str | None = None,
    category_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    service: ExpenseService = Depends(get_expense_service),
):
    """List expense entries with filtering."""
    return await service.list_organization(
        uuid.UUID(org_id),
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


# ── Financial Dashboard & Reports ──────────────────────────

@router.get("/{org_id}/summary", response_model=FinancialSummary)
async def get_financial_summary(
    org_id: str,
    start_date: date | None = None,
    end_date: date | None = None,
    service: FinancialReportingService = Depends(get_reporting_service),
):
    """Get the financial dashboard summary (KPIs)."""
    return await service.get_summary(
        uuid.UUID(org_id), start_date=start_date, end_date=end_date
    )


@router.get("/{org_id}/report/monthly", response_model=MonthlyReport)
async def get_monthly_report(
    org_id: str,
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    service: FinancialReportingService = Depends(get_reporting_service),
):
    """Generate a complete monthly financial report."""
    return await service.get_monthly_report(uuid.UUID(org_id), year, month)


@router.get("/{org_id}/report/annual", response_model=AnnualReport)
async def get_annual_report(
    org_id: str,
    year: int = Query(..., ge=2020, le=2100),
    service: FinancialReportingService = Depends(get_reporting_service),
):
    """Generate a complete annual financial report."""
    return await service.get_annual_report(uuid.UUID(org_id), year)
