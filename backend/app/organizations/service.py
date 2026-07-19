"""
Organization Module — Service Layer
"""
import uuid
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.shared.exceptions import NotFoundException, ValidationException
from app.organizations.models import Organization, OrganizationMember, RevenueCategory, ExpenseCategory
from app.auth.models import UserRole
from app.organizations.schemas import (
    OrganizationCreateRequest,
    OrganizationUpdateRequest,
    OrganizationResponse,
    RevenueCategoryCreate,
    RevenueCategoryResponse,
    ExpenseCategoryCreate,
    ExpenseCategoryResponse,
)
from app.organizations.repository import (
    OrganizationRepository,
    RevenueCategoryRepository,
    ExpenseCategoryRepository,
)


def _generate_slug(name: str) -> str:
    """Generate URL-safe slug from organization name."""
    import re
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug.strip("-")


class OrganizationService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = OrganizationRepository(session)

    async def create(
        self, data: OrganizationCreateRequest, user_id: uuid.UUID
    ) -> OrganizationResponse:
        slug = _generate_slug(data.name)
        base_slug = slug
        counter = 1
        while await self.repo.slug_exists(slug):
            slug = f"{base_slug}-{counter}"
            counter += 1

        org = Organization(
            name=data.name.strip(),
            slug=slug,
            type=data.type,
            description=data.description,
            default_currency=data.default_currency,
            fiscal_year_start_month=data.fiscal_year_start_month,
            commission_percentage=data.commission_percentage,
            concierge_percentage=data.concierge_percentage,
        )
        org = await self.repo.create(org)

        # Creator becomes admin
        from app.auth.models import OrganizationMember
        member = OrganizationMember(
            user_id=user_id,
            organization_id=org.id,
            role=UserRole.ADMIN,
        )
        self.session.add(member)
        await self.session.flush()

        # Seed default categories
        await self._seed_default_categories(org.id)

        return OrganizationResponse.model_validate(org)

    async def get_by_id(self, org_id: uuid.UUID) -> OrganizationResponse:
        org = await self.repo.get_by_id(org_id)
        if not org:
            raise NotFoundException("Organization", str(org_id))
        return OrganizationResponse.model_validate(org)

    async def update(
        self, org_id: uuid.UUID, data: OrganizationUpdateRequest
    ) -> OrganizationResponse:
        org = await self.repo.get_by_id(org_id)
        if not org:
            raise NotFoundException("Organization", str(org_id))

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(org, field, value)

        return OrganizationResponse.model_validate(org)

    async def get_member_organizations(
        self, user_id: uuid.UUID
    ) -> list[OrganizationResponse]:
        orgs = await self.repo.get_user_organizations(user_id)
        return [OrganizationResponse.model_validate(o) for o in orgs]

    async def _seed_default_categories(self, org_id: uuid.UUID):
        """Seed default revenue and expense categories for a new organization."""
        default_revenue = [
            ("Accommodation", "Direct booking revenue"),
            ("Cleaning Fee", "Guest cleaning fees"),
            ("Extra Guest Fee", "Additional guest charges"),
            ("Pet Fee", "Pet-related charges"),
            ("Late Checkout", "Late checkout fees"),
            ("Other Revenue", "Miscellaneous revenue"),
        ]
        default_expenses = [
            ("Cleaning", "Property cleaning costs"),
            ("Maintenance", "General maintenance"),
            ("Repairs", "Property repairs"),
            ("Utilities", "Electricity, water, gas"),
            ("Internet", "Internet & WiFi"),
            ("Taxes", "Property taxes"),
            ("Insurance", "Property insurance"),
            ("Supplies", "Guest supplies & amenities"),
            ("Furniture", "Furniture & appliances"),
            ("Platform Fees", "Airbnb/Booking.com fees"),
            ("Concierge Fees", "Concierge service fees"),
            ("Marketing", "Advertising & marketing"),
            ("Other", "Miscellaneous expenses"),
        ]

        rc_repo = RevenueCategoryRepository(self.session)
        ec_repo = ExpenseCategoryRepository(self.session)

        for idx, (name, desc) in enumerate(default_revenue):
            cat = RevenueCategory(
                organization_id=org_id,
                name=name,
                description=desc,
                is_default=True,
                sort_order=idx,
            )
            self.session.add(cat)

        for idx, (name, desc) in enumerate(default_expenses):
            cat = ExpenseCategory(
                organization_id=org_id,
                name=name,
                description=desc,
                is_default=True,
                sort_order=idx,
            )
            self.session.add(cat)

        await self.session.flush()


# Revenue Category Service
class RevenueCategoryService:
    def __init__(self, session: AsyncSession):
        self.repo = RevenueCategoryRepository(session)

    async def list(
        self, organization_id: uuid.UUID
    ) -> list[RevenueCategoryResponse]:
        cats = await self.repo.get_by_organization(organization_id)
        return [RevenueCategoryResponse.model_validate(c) for c in cats]

    async def create(
        self, organization_id: uuid.UUID, data: RevenueCategoryCreate
    ) -> RevenueCategoryResponse:
        from app.organizations.models import RevenueCategory
        cat = RevenueCategory(
            organization_id=organization_id,
            name=data.name,
            description=data.description,
            sort_order=data.sort_order,
        )
        cat = await self.repo.create(cat)
        return RevenueCategoryResponse.model_validate(cat)


# Expense Category Service
class ExpenseCategoryService:
    def __init__(self, session: AsyncSession):
        self.repo = ExpenseCategoryRepository(session)

    async def list(
        self, organization_id: uuid.UUID
    ) -> list[ExpenseCategoryResponse]:
        cats = await self.repo.get_by_organization(organization_id)
        return [ExpenseCategoryResponse.model_validate(c) for c in cats]

    async def create(
        self, organization_id: uuid.UUID, data: ExpenseCategoryCreate
    ) -> ExpenseCategoryResponse:
        from app.organizations.models import ExpenseCategory
        cat = ExpenseCategory(
            organization_id=organization_id,
            name=data.name,
            description=data.description,
            sort_order=data.sort_order,
        )
        cat = await self.repo.create(cat)
        return ExpenseCategoryResponse.model_validate(cat)


# FastAPI dependencies
async def get_org_service(session: AsyncSession = Depends(get_db)) -> OrganizationService:
    return OrganizationService(session)


async def get_rev_cat_service(session: AsyncSession = Depends(get_db)) -> RevenueCategoryService:
    return RevenueCategoryService(session)


async def get_exp_cat_service(session: AsyncSession = Depends(get_db)) -> ExpenseCategoryService:
    return ExpenseCategoryService(session)
