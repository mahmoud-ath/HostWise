"""
HostWise First-Run Setup

On first launch, the app "just works" — there is no login screen and no
hardcoded default credentials. The owner simply provides their name and
email, which are stored as application settings (local-first, single-user).
"""
import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.settings.service import SettingsService

log = logging.getLogger("hostwise.setup")
router = APIRouter(prefix="/setup", tags=["Setup"])


class ProfileRequest(BaseModel):
    name: str | None = None
    email: str | None = None


@router.post("/initialize")
async def initialize_app(
    data: ProfileRequest | None = None,
    session: AsyncSession = Depends(get_db),
):
    """
    First-run setup: store the owner's profile (name/email).
    No authentication is involved — this is a local, single-user app.
    """
    service = SettingsService(session)
    updates: dict = {}
    if data is not None:
        if data.name:
            updates["profile_name"] = data.name.strip()
        if data.email:
            updates["profile_email"] = data.email.strip()
    if updates:
        await service.update(updates)
        log.info("Profile saved: %s", updates.get("profile_name", "?"))
    return {
        "status": "initialized",
        "profile": {
            "name": (await service.get("profile_name")) or "",
            "email": (await service.get("profile_email")) or "",
        },
    }
