"""
Organization Module — Schemas
"""

from pydantic import BaseModel

from app.organizations.models import OrganizationType
from app.shared.schemas import BaseResponse


class OrganizationCreateRequest(BaseModel):
    """Create a new organization (tenant)."""
    name: str
    type: OrganizationType = OrganizationType.INDIVIDUAL_HOST
    description: str | None = None
    default_currency: str = "USD"
    fiscal_year_start_month: int = 1
    commission_percentage: float = 0.0
    concierge_percentage: float = 0.0


class OrganizationUpdateRequest(BaseModel):
    """Update organization settings."""
    name: str | None = None
    description: str | None = None
    logo_url: str | None = None
    default_currency: str | None = None
    fiscal_year_start_month: int | None = None
    commission_percentage: float | None = None
    concierge_percentage: float | None = None


class OrganizationResponse(BaseResponse):
    """Organization public response."""
    name: str
    slug: str
    type: OrganizationType
    description: str | None = None
    logo_url: str | None = None
    default_currency: str
    fiscal_year_start_month: int
    commission_percentage: float
    concierge_percentage: float


class RevenueCategoryCreate(BaseModel):
    name: str
    description: str | None = None
    sort_order: int = 0


class RevenueCategoryResponse(BaseResponse):
    name: str
    description: str | None = None
    is_default: bool
    sort_order: int


class ExpenseCategoryCreate(BaseModel):
    name: str
    description: str | None = None
    sort_order: int = 0


class ExpenseCategoryResponse(BaseResponse):
    name: str
    description: str | None = None
    is_default: bool
    sort_order: int
