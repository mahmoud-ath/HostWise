"""
HostWise — Vacation Rental Intelligence Platform

A modular monolith built with FastAPI + Domain-Driven Design.
The platform is NOT a PMS. It's an analytics & AI layer on top of booking data.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import get_settings
from app.core.database import engine, Base

settings = get_settings()


import logging

logger = logging.getLogger("hostwise")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    # Startup: create tables (MVP — use Alembic migrations in production)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified successfully.")
    except Exception as e:
        logger.warning(f"Database unavailable — running without persistence: {e}")
    yield
    # Shutdown: dispose engine
    await engine.dispose()


def create_app() -> FastAPI:
    """Application factory — creates and configures the FastAPI app."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Vacation Rental Intelligence Platform — Analytics & AI for hosts",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    from app.auth.router import router as auth_router
    from app.organizations.router import router as org_router
    from app.properties.router import router as property_router
    from app.finance.router import router as finance_router
    from app.analytics.router import router as analytics_router
    from app.ai.router import router as ai_router
    from app.reports.router import router as reports_router
    from app.connectors.router import router as connectors_router

    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
    app.include_router(org_router, prefix="/api/v1/organizations", tags=["Organizations"])
    app.include_router(property_router, prefix="/api/v1/properties", tags=["Properties"])
    app.include_router(finance_router, prefix="/api/v1/finance", tags=["Finance"])
    app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])
    app.include_router(ai_router, prefix="/api/v1/ai", tags=["AI Advisor"])
    app.include_router(reports_router, prefix="/api/v1/reports", tags=["Reports"])
    app.include_router(connectors_router, prefix="/api/v1/connectors", tags=["Connectors"])

    # Health check
    @app.get("/api/health")
    async def health_check():
        return {"status": "healthy", "app": settings.APP_NAME, "version": settings.APP_VERSION}

    # Serve frontend static files (for non-Tauri production mode)
    frontend_dist = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "out")
    if os.path.isdir(frontend_dist):
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
        logger.info(f"Serving frontend from: {frontend_dist}")

    return app


app = create_app()
