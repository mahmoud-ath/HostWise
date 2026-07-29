"""
Reports Module — Router
"""
import uuid

from fastapi import APIRouter, Depends, Query

from app.reports.service import ReportGenerationService, get_report_service

router = APIRouter()


@router.get("/{org_id}/weekly")
async def get_weekly_report(
    org_id: str,
    service: ReportGenerationService = Depends(get_report_service),
):
    """Generate weekly financial report."""
    return await service.generate_weekly_report(uuid.UUID(org_id))


@router.get("/{org_id}/monthly")
async def get_monthly_report(
    org_id: str,
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    service: ReportGenerationService = Depends(get_report_service),
):
    """Generate monthly report with AI insights."""
    return await service.generate_monthly_report(uuid.UUID(org_id), year, month)


@router.get("/{org_id}/annual")
async def get_annual_report(
    org_id: str,
    year: int = Query(...),
    service: ReportGenerationService = Depends(get_report_service),
):
    """Generate annual report with AI insights."""
    return await service.generate_annual_report(uuid.UUID(org_id), year)


@router.get("/{org_id}/executive")
async def get_executive_summary(
    org_id: str,
    service: ReportGenerationService = Depends(get_report_service),
):
    """Generate executive summary for investors/owners."""
    return await service.generate_executive_summary(uuid.UUID(org_id))
