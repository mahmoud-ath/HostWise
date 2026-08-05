"""
HostWise — Vacation Rental Intelligence Platform

A modular monolith built with FastAPI + Domain-Driven Design.
"""
import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.database import Base, async_session_factory, engine
from app.shared.exceptions import AppException

settings = get_settings()

# ── Structured Logging Setup ────────────────────────────
logger = logging.getLogger("hostwise")


def setup_logging() -> None:
    """Configure structured JSON logging for production, pretty for dev."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    if settings.ENVIRONMENT == "production":
        # Structured logging with JSON output
        try:
            from pythonjsonlogger import jsonlogger

            handler = logging.StreamHandler()
            formatter = jsonlogger.JsonFormatter(
                fmt="%(asctime)s %(name)s %(levelname)s %(message)s",
                datefmt="%Y-%m-%dT%H:%M:%S%z",
            )
            handler.setFormatter(formatter)
            logging.basicConfig(level=log_level, handlers=[handler])
        except ImportError:
            # Fallback to plain logging
            logging.basicConfig(
                level=log_level,
                format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
    else:
        # Dev: human-readable
        logging.basicConfig(
            level=log_level,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    logger.info("Logging configured at %s level", settings.LOG_LEVEL)


# ── Request ID & Timing Middleware ───────────────────────
import uuid


class RequestLogMiddleware(BaseHTTPMiddleware):
    """Add request ID and timing to every request."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        start = time.perf_counter()

        response = await call_next(request)

        elapsed = time.perf_counter() - start
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-Ms"] = str(round(elapsed * 1000))

        # Log every request (skip static files)
        if not request.url.path.startswith("/static"):
            logger.info(
                "%s %s %s [%.0fms] id=%s",
                request.method,
                request.url.path,
                response.status_code,
                elapsed * 1000,
                request_id,
            )
        return response


# ── Lifespan ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    setup_logging()
    logger.info(
        "Starting %s v%s (%s)",
        settings.APP_NAME,
        settings.APP_VERSION,
        settings.ENVIRONMENT,
    )
    # Security audit on startup (roadmap 5.3) — warn, never fail.
    if settings.ENVIRONMENT == "production":
        if settings.JWT_SECRET_KEY.startswith("change-me"):
            logger.warning(
                "SECURITY: JWT_SECRET_KEY is the default value — set a strong "
                "secret in your environment before shipping."
            )
        if "*" in settings.CORS_ORIGINS:
            logger.warning(
                "SECURITY: CORS_ORIGINS contains '*' — restrict it to your "
                "actual frontend origin(s) in production."
            )
        elif not any("localhost" in o for o in settings.CORS_ORIGINS):
            logger.info("CORS origins: %s", settings.CORS_ORIGINS)
    # Startup: create tables if using SQLite (desktop mode)
    if settings.DATABASE_TYPE == "sqlite":
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                # WAL journal improves read concurrency and backup consistency.
                await conn.execute(__import__("sqlalchemy").text("PRAGMA journal_mode=WAL"))
            # Record/apply versioned migrations (non-fatal — falls back to create_all).
            from app.core.migrations import run_migrations
            run_migrations()
            logger.info("Database tables verified.")
        except Exception as e:  # noqa: BLE001 - intentional: degrade startup gracefully when DB is down
            logger.warning("Database unavailable: %s", e)
    yield
    # Shutdown
    await engine.dispose()
    logger.info("Shutdown complete.")


# ── Exception Handlers ──────────────────────────────────
def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", "unknown")
        logger.exception("Unhandled exception [req=%s]: %s", request_id, exc)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "request_id": request_id,
            },
        )


# ── Application Factory ──────────────────────────────────
def create_app() -> FastAPI:
    """Application factory — creates and configures the FastAPI app."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Vacation Rental Intelligence Platform — Analytics & AI for hosts",
        docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/api/redoc" if settings.ENVIRONMENT != "production" else None,
        openapi_url="/api/openapi.json" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # Middleware (order matters: outermost first)
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(RequestLogMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    # Register routers
    from app.ai.router import router as ai_router
    from app.analytics.router import router as analytics_router
    from app.auth.router import router as auth_router
    from app.backup_router import router as backup_router
    from app.connectors.router import router as connectors_router
    from app.finance.router import router as finance_router
    from app.maintenance_router import router as maintenance_router
    from app.notifications.router import router as notifications_router
    from app.properties.router import router as property_router
    from app.reports.router import router as reports_router
    from app.settings.router import router as settings_router
    from app.setup_router import router as setup_router

    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])

    app.include_router(property_router, prefix="/api/v1/properties", tags=["Properties"])
    app.include_router(finance_router, prefix="/api/v1/finance", tags=["Finance"])
    app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])
    app.include_router(ai_router, prefix="/api/v1/ai", tags=["AI Advisor"])
    app.include_router(reports_router, prefix="/api/v1/reports", tags=["Reports"])
    app.include_router(connectors_router, prefix="/api/v1/connectors", tags=["Connectors"])
    app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["Notifications"])
    app.include_router(backup_router, prefix="/api/v1", tags=["Backups"])
    app.include_router(maintenance_router, prefix="/api/v1", tags=["Maintenance"])
    app.include_router(settings_router, prefix="/api/v1/settings", tags=["Settings"])
    app.include_router(setup_router, prefix="/api/v1", tags=["Setup"])

    # Health check with DB status
    @app.get("/api/health")
    async def health_check():
        db_status = "unknown"
        try:
            async with async_session_factory() as session:
                await session.execute(
                    __import__("sqlalchemy").text("SELECT 1")
                )
            db_status = "connected"
        except Exception:  # noqa: BLE001 - intentional: health check reports disconnected on any error
            db_status = "disconnected"

        return {
            "status": "healthy" if db_status == "connected" else "degraded",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "database": db_status,
        }

    # Serve frontend static files (for standalone production mode)
    frontend_dist = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "out")
    if os.path.isdir(frontend_dist):
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
        logger.info("Serving frontend from: %s", frontend_dist)

    return app


app = create_app()
