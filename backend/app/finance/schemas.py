"""
Finance Module — Schemas

Request/Response schemas for revenue, expense, and financial KPIs.
"""
from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.finance.models import PaymentMethod, RevenueSource
from app.shared.schemas import BaseResponse

# ── Revenue ──────────────────────────────────────────────

class RevenueCreateRequest(BaseModel):
    property_id: str
    reservation_id: str | None = None
    category_id: str | None = None
    date: date
    gross_amount: float = Field(..., ge=0, description="Total revenue before commission")
    commission_amount: float = Field(0.0, ge=0, description="Management/concierge commission")
    source: RevenueSource = RevenueSource.MANUAL
    currency: str = "USD"
    description: str | None = None
    notes: str | None = None


class RevenueUpdateRequest(BaseModel):
    category_id: str | None = None
    gross_amount: float | None = None
    commission_amount: float | None = None
    description: str | None = None
    notes: str | None = None


class RevenueResponse(BaseResponse):
    property_id: str
    reservation_id: str | None = None
    category_id: str | None = None
    date: date
    gross_amount: float
    commission_amount: float
    net_amount: float
    source: RevenueSource
    currency: str
    description: str | None = None
    notes: str | None = None

    @field_validator("property_id", "reservation_id", "category_id", mode="before")
    @classmethod
    def uuid_to_str(cls, v):
        return str(v) if isinstance(v, UUID) else v


# ── Expense ──────────────────────────────────────────────

class ExpenseCreateRequest(BaseModel):
    property_id: str
    category_id: str | None = None
    date: date
    amount: float = Field(..., ge=0)
    currency: str = "USD"
    vendor: str | None = None
    payment_method: PaymentMethod | None = None
    description: str | None = None
    notes: str | None = None
    is_recurring: bool = False


class ExpenseResponse(BaseResponse):
    property_id: str
    category_id: str | None = None
    date: date
    amount: float
    currency: str
    vendor: str | None = None
    payment_method: PaymentMethod | None = None
    description: str | None = None
    is_recurring: bool

    @field_validator("property_id", "category_id", mode="before")
    @classmethod
    def uuid_to_str(cls, v):
        return str(v) if isinstance(v, UUID) else v


# ── Financial KPI Schemas ─────────────────────────────────

class FinancialSummary(BaseModel):
    """Dashboard-level financial summary."""
    gross_revenue: float = 0.0
    net_revenue: float = 0.0
    total_expenses: float = 0.0
    cashflow: float = 0.0
    profit: float = 0.0
    profit_margin: float = 0.0
    property_count: int = 0
    avg_revenue_per_property: float = 0.0


class MonthlyBreakdown(BaseModel):
    """Revenue & expense breakdown for a single month."""
    month: int
    year: int
    gross_revenue: float = 0.0
    net_revenue: float = 0.0
    total_expenses: float = 0.0
    cashflow: float = 0.0
    profit: float = 0.0
    reservation_count: int = 0


class CategoryBreakdown(BaseModel):
    """Expense/revenue breakdown by category."""
    category_name: str
    total: float
    percentage: float
    count: int


class PropertyFinancialSummary(BaseModel):
    """Per-property financial breakdown."""
    property_id: str
    property_name: str
    gross_revenue: float = 0.0
    net_revenue: float = 0.0
    total_expenses: float = 0.0
    profit: float = 0.0
    profit_margin: float = 0.0
    reservation_count: int = 0


class MonthlyReport(BaseModel):
    """Complete monthly financial report."""
    month: int
    year: int
    summary: FinancialSummary
    monthly_trend: list[MonthlyBreakdown]
    revenue_by_category: list[CategoryBreakdown]
    expense_by_category: list[CategoryBreakdown]
    revenue_by_property: list[PropertyFinancialSummary]


class AnnualReport(BaseModel):
    """Complete annual financial report."""
    year: int
    summary: FinancialSummary
    monthly_breakdown: list[MonthlyBreakdown]
    revenue_by_category: list[CategoryBreakdown]
    expense_by_category: list[CategoryBreakdown]
    revenue_by_property: list[PropertyFinancialSummary]
    best_month: MonthlyBreakdown | None = None
    worst_month: MonthlyBreakdown | None = None
    yoy_growth: float | None = None
