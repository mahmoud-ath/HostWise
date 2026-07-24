"""
HostWise Core Configuration

All settings are loaded from environment variables with sensible defaults.
Never hardcode secrets. Use .env files for local development.
"""
from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    """Application-wide settings loaded from environment."""

    # Application
    APP_NAME: str = "HostWise"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "info"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DATABASE_TYPE: str = "postgresql"  # "postgresql" or "sqlite"
    DATABASE_URL: str = "postgresql+asyncpg://hostwise:hostwise@db:5432/hostwise"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://hostwise:hostwise@db:5432/hostwise"
    SQLITE_PATH: str = "hostwise.db"  # Only used when DATABASE_TYPE=sqlite
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_ECHO: bool = False
    DB_POOL_PRE_PING: bool = True

    # JWT Authentication
    JWT_SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-64"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # CORS — in production, restrict to your actual domain
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # File Uploads
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE_MB: int = 50

    # AI (optional)
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None

    # Email (optional)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: Optional[int] = 587

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton — use this everywhere."""
    return Settings()
