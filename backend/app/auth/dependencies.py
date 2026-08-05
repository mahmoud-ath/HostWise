"""
Auth Module — Dependencies

FastAPI dependency injection for authentication.
Every protected endpoint uses get_current_user.
"""
import uuid

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.repository import UserRepository
from app.auth.schemas import UserResponse
from app.auth.security import decode_token
from app.core.database import get_db
from app.shared.exceptions import UnauthorizedException


async def get_current_user(
    authorization: str = Header(..., description="Bearer <token>"),
    session: AsyncSession = Depends(get_db),
) -> User:
    """
    Extract and validate the JWT token from the Authorization header.
    Returns the authenticated User. Raises 401 if invalid.
    """
    if not authorization.startswith("Bearer "):
        raise UnauthorizedException("Invalid authorization header format")

    token = authorization.replace("Bearer ", "")

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise UnauthorizedException("Invalid token type")
        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedException("Invalid token payload")
    except Exception:  # noqa: BLE001 - retired auth: any decode failure → invalid token
        raise UnauthorizedException("Invalid or expired token")

    repo = UserRepository(session)
    user = await repo.get_by_id(uuid.UUID(user_id))
    if not user:
        raise UnauthorizedException("User not found")
    if not user.is_active:
        raise UnauthorizedException("Account is deactivated")

    return user


async def get_current_user_response(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Return the current user as a response schema."""
    return UserResponse.model_validate(current_user)
