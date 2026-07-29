"""
Database Engine & Session Configuration

Supports both PostgreSQL (via asyncpg) and SQLite (via aiosqlite).
Set DATABASE_TYPE in config to switch. SQLite is used for standalone desktop builds.
Session management via dependency injection.
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()


def _build_db_url() -> str:
    """Build the appropriate database URL based on DATABASE_TYPE."""
    if settings.DATABASE_TYPE == "sqlite":
        path = settings.SQLITE_PATH
        # Normalize Windows backslashes to forward slashes for SQLAlchemy URL
        path = path.replace("\\", "/")
        return f"sqlite+aiosqlite:///{path}"
    return settings.DATABASE_URL


def _build_engine_kwargs() -> dict:
    """Build engine kwargs based on database type."""
    if settings.DATABASE_TYPE == "sqlite":
        return {
            "echo": settings.DB_ECHO,
            "future": True,
        }
    return {
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "echo": settings.DB_ECHO,
        "future": True,
    }


# Async engine
engine = create_async_engine(
    _build_db_url(),
    **_build_engine_kwargs(),
)

# Session factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all database models."""


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields a database session per request."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
