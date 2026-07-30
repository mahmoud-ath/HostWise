"""
HostWise First-Run Setup

Auto-provisions a default user and organization on first launch.
No login screen — the app just works out of the box.
"""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.auth.repository import UserRepository
from app.auth.security import hash_password
from app.auth.models import User
from app.organizations.models import Organization, OrganizationMember

log = logging.getLogger("hostwise.setup")
router = APIRouter(prefix="/setup", tags=["Setup"])


@router.post("/initialize")
async def initialize_app():
    """Create default user and organization on first run."""
    async with async_session_factory() as session:
        # Check if already initialized
        user_repo = UserRepository(session)
        existing = await session.execute(
            __import__("sqlalchemy").select(User).limit(1)
        )
        if existing.scalar_one_or_none():
            return {"status": "already_initialized"}

        # Create default user
        default_user = User(
            email="admin@hostwise.local",
            full_name="HostWise User",
            hashed_password=hash_password("hostwise_default"),
            is_active=True,
        )
        session.add(default_user)
        await session.flush()

        # Create default organization
        default_org = Organization(
            name="My Properties",
            slug="my-properties",
            type="individual_host",
            default_currency="USD",
        )
        session.add(default_org)
        await session.flush()

        # Add user as owner
        membership = OrganizationMember(
            organization_id=default_org.id,
            user_id=default_user.id,
            role="owner",
        )
        session.add(membership)
        await session.commit()

        log.info("Default user and organization created")
        return {"status": "initialized"}
