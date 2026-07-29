"""
Dependency Injection Container

Centralized dependency management. Every dependency is resolved here.
This is deliberately simple for MVP — no need for a DI framework yet.
When the app grows, replace with dependency-injector or similar.
"""
from app.core.database import get_db

# Re-export for convenience
__all__ = ["get_current_user", "get_db"]


# Auth dependency — imported lazily to avoid circular imports
async def get_current_user():
    """Will be replaced with actual auth dependency."""
    from app.auth.dependencies import get_current_user as _get_current_user
    return _get_current_user
