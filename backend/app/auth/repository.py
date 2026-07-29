"""
Auth Module — Repository

Data access for User and OrganizationMember entities.
"""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import OrganizationMember, User
from app.shared.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for User entities."""

    def __init__(self, session: AsyncSession):
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> User | None:
        """Find user by email (case-insensitive)."""
        result = await self.session.execute(
            select(User).where(
                User.email == email.lower().strip(),
                User.is_deleted == False,
            )
        )
        return result.scalar_one_or_none()

    async def email_exists(self, email: str) -> bool:
        """Check if an email is already registered."""
        user = await self.get_by_email(email)
        return user is not None


class OrganizationMemberRepository(BaseRepository[OrganizationMember]):
    """Repository for OrganizationMember junction."""

    def __init__(self, session: AsyncSession):
        super().__init__(OrganizationMember, session)

    async def get_membership(
        self, user_id: uuid.UUID, organization_id: uuid.UUID
    ) -> OrganizationMember | None:
        """Get a user's membership in a specific organization."""
        result = await self.session.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user_id,
                OrganizationMember.organization_id == organization_id,
                OrganizationMember.is_deleted == False,
            )
        )
        return result.scalar_one_or_none()
