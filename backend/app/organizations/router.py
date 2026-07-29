"""
Organization Module — Router
"""
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.organizations.schemas import (
    ExpenseCategoryCreate,
    ExpenseCategoryResponse,
    OrganizationCreateRequest,
    OrganizationResponse,
    OrganizationUpdateRequest,
    RevenueCategoryCreate,
    RevenueCategoryResponse,
)
from app.organizations.service import (
    ExpenseCategoryService,
    OrganizationService,
    RevenueCategoryService,
    get_exp_cat_service,
    get_org_service,
    get_rev_cat_service,
)

router = APIRouter()


@router.post("", response_model=OrganizationResponse, status_code=201)
async def create_organization(
    data: OrganizationCreateRequest,
    current_user: User = Depends(get_current_user),
    service: OrganizationService = Depends(get_org_service),
):
    """Create a new organization. The creator becomes admin."""
    return await service.create(data, current_user.id)


@router.get("", response_model=list[OrganizationResponse])
async def list_my_organizations(
    current_user: User = Depends(get_current_user),
    service: OrganizationService = Depends(get_org_service),
):
    """List all organizations the current user belongs to."""
    return await service.get_member_organizations(current_user.id)


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: str,
    service: OrganizationService = Depends(get_org_service),
):
    """Get organization details by ID."""
    import uuid
    return await service.get_by_id(uuid.UUID(org_id))


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: str,
    data: OrganizationUpdateRequest,
    current_user: User = Depends(get_current_user),
    service: OrganizationService = Depends(get_org_service),
):
    """Update organization settings."""
    import uuid
    return await service.update(uuid.UUID(org_id), data)


# Revenue Categories
@router.get("/{org_id}/revenue-categories", response_model=list[RevenueCategoryResponse])
async def list_revenue_categories(
    org_id: str,
    service: RevenueCategoryService = Depends(get_rev_cat_service),
):
    """List revenue categories for an organization."""
    import uuid
    return await service.list(uuid.UUID(org_id))


@router.post("/{org_id}/revenue-categories", response_model=RevenueCategoryResponse, status_code=201)
async def create_revenue_category(
    org_id: str,
    data: RevenueCategoryCreate,
    service: RevenueCategoryService = Depends(get_rev_cat_service),
):
    import uuid
    return await service.create(uuid.UUID(org_id), data)


# Expense Categories
@router.get("/{org_id}/expense-categories", response_model=list[ExpenseCategoryResponse])
async def list_expense_categories(
    org_id: str,
    service: ExpenseCategoryService = Depends(get_exp_cat_service),
):
    import uuid
    return await service.list(uuid.UUID(org_id))


@router.post("/{org_id}/expense-categories", response_model=ExpenseCategoryResponse, status_code=201)
async def create_expense_category(
    org_id: str,
    data: ExpenseCategoryCreate,
    service: ExpenseCategoryService = Depends(get_exp_cat_service),
):
    import uuid
    return await service.create(uuid.UUID(org_id), data)
