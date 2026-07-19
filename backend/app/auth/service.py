"""
Auth Module — Service Layer

Business logic for authentication: registration, login, token refresh.
"""
import uuid
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.shared.exceptions import UnauthorizedException, ValidationException
from app.auth.models import User, OrganizationMember, UserRole
from app.auth.schemas import UserRegisterRequest, UserLoginRequest, TokenResponse, UserResponse
from app.auth.repository import UserRepository
from app.auth.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.organizations.models import Organization


class AuthService:
    """Authentication business logic."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)

    async def register(self, data: UserRegisterRequest) -> UserResponse:
        """Register a new user and auto-create a default organization."""
        if await self.user_repo.email_exists(data.email):
            raise ValidationException("Email already registered")

        user = User(
            email=data.email.lower().strip(),
            hashed_password=hash_password(data.password),
            full_name=data.full_name.strip(),
        )
        user = await self.user_repo.create(user)

        # Auto-create a default organization so the user can start immediately
        org_name = data.full_name.strip().split()[0] if data.full_name else "My"
        org = Organization(
            name=f"{org_name}'s Portfolio",
            slug=f"{user.id.hex[:12]}",
            type="individual_host",
            default_currency="USD",
        )
        self.session.add(org)
        await self.session.flush()

        member = OrganizationMember(
            user_id=user.id,
            organization_id=org.id,
            role=UserRole.ADMIN,
        )
        self.session.add(member)

        return UserResponse.model_validate(user)

    async def login(self, data: UserLoginRequest) -> TokenResponse:
        """Authenticate user and return JWT tokens."""
        user = await self.user_repo.get_by_email(data.email)
        if not user or not verify_password(data.password, user.hashed_password):
            raise UnauthorizedException("Invalid email or password")

        if not user.is_active:
            raise UnauthorizedException("Account is deactivated")

        return TokenResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
        )

    async def refresh_token(self, refresh_token: str) -> TokenResponse:
        """Issue new tokens from a valid refresh token."""
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise UnauthorizedException("Invalid token type")
            user_id = payload.get("sub")
        except Exception:
            raise UnauthorizedException("Invalid refresh token")

        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise UnauthorizedException("User not found or inactive")

        return TokenResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
        )

    async def get_current_user(self, user_id: str) -> User:
        """Get the authenticated user from token sub."""
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise UnauthorizedException("User not found")
        return user


async def get_auth_service(session: AsyncSession = Depends(get_db)) -> AuthService:
    """FastAPI dependency for AuthService."""
    return AuthService(session)
