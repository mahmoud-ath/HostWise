"""
Analytics Module — Router
"""
import uuid

from fastapi import APIRouter, Depends, Query

from app.analytics.service import AnalyticsService, get_analytics_service

router = APIRouter()


@router.get("/property/{property_id}")
async def get_property_analytics(
    property_id: str,
    year: int = Query(..., ge=2020, le=2100),
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Get comprehensive property performance analytics."""
    return await service.get_property_analytics(
        uuid.UUID(property_id), year
    )


@router.get("/portfolio")
async def get_portfolio_analytics(
    year: int = Query(..., ge=2020, le=2100),
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Get portfolio-wide analytics (all properties)."""
    return await service.get_portfolio_analytics(year)


@router.get("/property/{property_id}/health")
async def get_property_health(
    property_id: str,
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Get property health score (0-100)."""
    return await service.get_property_health_score(
        uuid.UUID(property_id)
    )
