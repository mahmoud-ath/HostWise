"""
Auth Module — Router

Authentication endpoints: register, login, refresh, profile.
"""
from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user, get_current_user_response
from app.auth.models import User
from app.auth.schemas import (
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
    UserUpdateRequest,
)
from app.auth.service import AuthService, get_auth_service

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    data: UserRegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Register a new user account."""
    return await auth_service.register(data)


@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Login and receive JWT tokens."""
    return await auth_service.login(data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Refresh an expired access token."""
    return await auth_service.refresh_token(refresh_token)


@router.get("/me", response_model=UserResponse)
async def get_me(user: UserResponse = Depends(get_current_user_response)):
    """Get the currently authenticated user's profile."""
    return user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Update the current user's profile."""
    if data.full_name is not None:
        current_user.full_name = data.full_name.strip()
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url
    return UserResponse.model_validate(current_user)
