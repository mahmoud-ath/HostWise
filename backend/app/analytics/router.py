"""
Analytics Module — Router
"""
import uuid
from fastapi import APIRouter, Depends, Query
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.analytics.service import AnalyticsService, get_analytics_service

router = APIRouter()


@router.get("/{org_id}/property/{property_id}")
async def get_property_analytics(
    org_id: str,
    property_id: str,
    year: int = Query(..., ge=2020, le=2100),
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Get comprehensive property performance analytics."""
    return await service.get_property_analytics(
        uuid.UUID(org_id), uuid.UUID(property_id), year
    )


@router.get("/{org_id}/portfolio")
async def get_portfolio_analytics(
    org_id: str,
    year: int = Query(..., ge=2020, le=2100),
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Get portfolio-wide analytics (all properties)."""
    return await service.get_portfolio_analytics(uuid.UUID(org_id), year)


@router.get("/{org_id}/property/{property_id}/health")
async def get_property_health(
    org_id: str,
    property_id: str,
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Get property health score (0-100)."""
    return await service.get_property_health_score(
        uuid.UUID(org_id), uuid.UUID(property_id)
    )
