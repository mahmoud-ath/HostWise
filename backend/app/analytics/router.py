"""
Analytics Module — Router
"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from app.analytics.service import AnalyticsService, get_analytics_service

router = APIRouter()


@router.get("/property/{property_id}")
async def get_property_analytics(
    property_id: str,
    year: int = Query(..., ge=2020, le=2100),
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Get comprehensive property performance analytics (short-TTL cached)."""
    from app.ai.cache import analytics_cache, data_fingerprint

    fp = await data_fingerprint(service.session)
    key = f"prop:{property_id}:{year}:{fp}"
    cached = analytics_cache.get(key)
    if cached is not None:
        return cached
    result = await service.get_property_analytics(uuid.UUID(property_id), year)
    analytics_cache.set(key, result)
    return result


@router.get("/portfolio")
async def get_portfolio_analytics(
    year: int | None = Query(None, ge=2020, le=2100),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Get portfolio-wide analytics (all properties).

    Either `year` (defaults to the current year) or a `start_date`/`end_date`
    pair selects the period.
    """
    if (start_date is None) != (end_date is None):
        raise HTTPException(
            status_code=422,
            detail="start_date and end_date must be provided together",
        )
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=422,
            detail="start_date must not be after end_date",
        )
    from app.ai.cache import analytics_cache, data_fingerprint

    fp = await data_fingerprint(service.session)
    key = f"portfolio:{year}:{start_date}:{end_date}:{fp}"
    cached = analytics_cache.get(key)
    if cached is not None:
        return cached
    result = await service.get_portfolio_analytics(
        year=year, start_date=start_date, end_date=end_date
    )
    analytics_cache.set(key, result)
    return result


@router.get("/property/{property_id}/health")
async def get_property_health(
    property_id: str,
    service: AnalyticsService = Depends(get_analytics_service),
):
    """Get property health score (0-100)."""
    return await service.get_property_health_score(
        uuid.UUID(property_id)
    )
