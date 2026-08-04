"""
Reports Module — Router
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from app.reports.service import ReportGenerationService, get_report_service

router = APIRouter()


@router.get("/weekly")
async def get_weekly_report(
    service: ReportGenerationService = Depends(get_report_service),
):
    """Generate weekly financial report."""
    return await service.generate_weekly_report()


@router.get("/monthly")
async def get_monthly_report(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    service: ReportGenerationService = Depends(get_report_service),
):
    """Generate monthly report with AI insights."""
    return await service.generate_monthly_report(year, month)


@router.get("/annual")
async def get_annual_report(
    year: int = Query(...),
    service: ReportGenerationService = Depends(get_report_service),
):
    """Generate annual report with AI insights."""
    return await service.generate_annual_report(year)


@router.get("/executive")
async def get_executive_summary(
    service: ReportGenerationService = Depends(get_report_service),
):
    """Generate executive summary for investors/owners."""
    return await service.generate_executive_summary()


@router.get("/portfolio")
async def get_portfolio_report(
    year: int | None = Query(None, ge=2020, le=2100),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    currency: str | None = Query(None, min_length=3, max_length=3),
    service: ReportGenerationService = Depends(get_report_service),
):
    """
    Generate a comprehensive portfolio report:
    executive summary, AI insights, KPI comparison, property table,
    expense analysis, risks, goals, forecast, health, and tax summary.

    Either `year` (defaults to the current year) or a `start_date`/`end_date`
    pair selects the reporting period.
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

    if start_date and end_date:
        return await service.generate_portfolio_report(start_date, end_date, currency)

    if year is None:
        year = date.today().year
    return await service.generate_portfolio_report(
        date(year, 1, 1), date(year, 12, 31), currency
    )
