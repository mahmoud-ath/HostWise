"""
Shared Pydantic Schemas

Base schemas for request/response patterns.
Every domain defines its own schemas extending these patterns.
"""
import uuid
from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    """Base schema with Pydantic v2 configuration."""
    model_config = ConfigDict(from_attributes=True)


class TimestampSchema(BaseSchema):
    """Standard timestamp fields in responses."""
    created_at: datetime
    updated_at: datetime


class BaseResponse(TimestampSchema):
    """Every entity response includes these fields."""
    id: uuid.UUID


T = TypeVar("T")


class PaginatedResponse(BaseSchema, Generic[T]):
    """Standard paginated response wrapper."""
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class ErrorResponse(BaseSchema):
    """Standard error response."""
    detail: str
    error_code: str | None = None
