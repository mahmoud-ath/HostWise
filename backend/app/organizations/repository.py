"""
Organization Module — Repository
"""
import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.organizations.models import (
    ExpenseCategory,
    Organization,
    RevenueCategory,
)
from app.shared.base_repository import BaseRepository


class OrganizationRepository(BaseRepository[Organization]):
    def __init__(self, session: AsyncSession):
        super().__init__(Organization, session)

    async def get_by_slug(self, slug: str) -> Organization | None:
        result = await self.session.execute(
            select(Organization).where(
                Organization.slug == slug,
                Organization.is_deleted == False,
            )
        )
        return result.scalar_one_or_none()

    async def slug_exists(self, slug: str) -> bool:
        org = await self.get_by_slug(slug)
        return org is not None

    async def get_user_organizations(
        self, user_id: uuid.UUID
    ) -> Sequence[Organization]:
        """Get all organizations a user belongs to."""
        from app.auth.models import OrganizationMember
        result = await self.session.execute(
            select(Organization)
            .join(OrganizationMember)
            .where(
                OrganizationMember.user_id == user_id,
                Organization.is_deleted == False,
            )
        )
        return result.scalars().all()


class RevenueCategoryRepository(BaseRepository[RevenueCategory]):
    def __init__(self, session: AsyncSession):
        super().__init__(RevenueCategory, session)

    async def get_by_organization(
        self, organization_id: uuid.UUID
    ) -> Sequence[RevenueCategory]:
        result = await self.session.execute(
            select(RevenueCategory)
            .where(
                RevenueCategory.organization_id == organization_id,
                RevenueCategory.is_deleted == False,
            )
            .order_by(RevenueCategory.sort_order)
        )
        return result.scalars().all()


class ExpenseCategoryRepository(BaseRepository[ExpenseCategory]):
    def __init__(self, session: AsyncSession):
        super().__init__(ExpenseCategory, session)

    async def get_by_organization(
        self, organization_id: uuid.UUID
    ) -> Sequence[ExpenseCategory]:
        result = await self.session.execute(
            select(ExpenseCategory)
            .where(
                ExpenseCategory.organization_id == organization_id,
                ExpenseCategory.is_deleted == False,
            )
            .order_by(ExpenseCategory.sort_order)
        )
        return result.scalars().all()
