"""
Auth Module — Schemas

Request/Response schemas for authentication endpoints.
"""

from pydantic import BaseModel, field_validator

from app.shared.schemas import BaseResponse


class UserRegisterRequest(BaseModel):
    """Registration payload."""
    email: str
    password: str
    full_name: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v:
            raise ValueError("Invalid email address")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserLoginRequest(BaseModel):
    """Login payload."""
    email: str
    password: str


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseResponse):
    """Public user profile."""
    email: str
    full_name: str
    is_active: bool
    is_verified: bool
    avatar_url: str | None = None


class UserUpdateRequest(BaseModel):
    """Fields the user can update on their profile."""
    full_name: str | None = None
    avatar_url: str | None = None
