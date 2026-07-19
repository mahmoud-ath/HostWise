"""
Organization Module — Schemas
"""
from pydantic import BaseModel
from typing import Optional
from app.shared.schemas import BaseResponse
from app.organizations.models import OrganizationType


class OrganizationCreateRequest(BaseModel):
    """Create a new organization (tenant)."""
    name: str
    type: OrganizationType = OrganizationType.INDIVIDUAL_HOST
    description: Optional[str] = None
    default_currency: str = "USD"
    fiscal_year_start_month: int = 1
    commission_percentage: float = 0.0
    concierge_percentage: float = 0.0


class OrganizationUpdateRequest(BaseModel):
    """Update organization settings."""
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    default_currency: Optional[str] = None
    fiscal_year_start_month: Optional[int] = None
    commission_percentage: Optional[float] = None
    concierge_percentage: Optional[float] = None


class OrganizationResponse(BaseResponse):
    """Organization public response."""
    name: str
    slug: str
    type: OrganizationType
    description: Optional[str] = None
    logo_url: Optional[str] = None
    default_currency: str
    fiscal_year_start_month: int
    commission_percentage: float
    concierge_percentage: float


class RevenueCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class RevenueCategoryResponse(BaseResponse):
    name: str
    description: Optional[str] = None
    is_default: bool
    sort_order: int


class ExpenseCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0


class ExpenseCategoryResponse(BaseResponse):
    name: str
    description: Optional[str] = None
    is_default: bool
    sort_order: int
