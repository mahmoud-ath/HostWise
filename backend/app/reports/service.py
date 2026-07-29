"""
Reports Module — Service

Generates formatted reports: daily, weekly, monthly, quarterly, annual,
executive summaries, and owner reports.
"""
import uuid
from datetime import date, timedelta

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.service import AIAdvisorService
from app.core.database import get_db
from app.finance.service import FinancialReportingService


class ReportGenerationService:
    """Generates formatted business reports."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.finance = FinancialReportingService(session)
        self.ai = AIAdvisorService(session)

    async def generate_weekly_report(
        self, organization_id: uuid.UUID
    ) -> dict:
        """Generate a weekly financial summary."""
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())
        end_of_week = start_of_week + timedelta(days=6)

        summary = await self.finance.get_summary(
            organization_id, start_of_week, end_of_week
        )

        return {
            "report_type": "weekly",
            "period_start": start_of_week.isoformat(),
            "period_end": end_of_week.isoformat(),
            "generated_at": today.isoformat(),
            "summary": summary.model_dump(),
        }

    async def generate_monthly_report(
        self, organization_id: uuid.UUID, year: int, month: int
    ) -> dict:
        """Generate a full monthly report with AI insights."""
        report = await self.finance.get_monthly_report(organization_id, year, month)
        ai_analysis = await self.ai.analyze_financial_performance(organization_id)

        return {
            "report_type": "monthly",
            "year": year,
            "month": month,
            "financial_data": report.model_dump(),
            "ai_insights": ai_analysis.get("executive_summary"),
            "recommendations": ai_analysis.get("recommendations", [])[:3],
        }

    async def generate_annual_report(
        self, organization_id: uuid.UUID, year: int
    ) -> dict:
        """Generate a full annual report."""
        report = await self.finance.get_annual_report(organization_id, year)
        ai_analysis = await self.ai.analyze_financial_performance(organization_id)

        return {
            "report_type": "annual",
            "year": year,
            "financial_data": report.model_dump(),
            "ai_insights": ai_analysis.get("executive_summary"),
            "recommendations": ai_analysis.get("recommendations", []),
        }

    async def generate_executive_summary(
        self, organization_id: uuid.UUID
    ) -> dict:
        """Executive-level summary for investors/owners."""
        today = date.today()
        current_year = today.year

        annual = await self.finance.get_annual_report(organization_id, current_year)
        ai = await self.ai.analyze_financial_performance(organization_id)

        return {
            "report_type": "executive_summary",
            "generated_at": today.isoformat(),
            "highlights": {
                "annual_revenue": annual.summary.gross_revenue,
                "annual_profit": annual.summary.profit,
                "profit_margin": annual.summary.profit_margin,
                "yoy_growth": annual.yoy_growth,
                "property_count": annual.summary.property_count,
                "best_month": (
                    annual.best_month.model_dump() if annual.best_month else None
                ),
                "worst_month": (
                    annual.worst_month.model_dump() if annual.worst_month else None
                ),
            },
            "ai_summary": ai.get("executive_summary"),
            "top_recommendations": [
                r for r in ai.get("recommendations", [])
                if r["type"] in ("critical", "warning")
            ][:5],
        }


async def get_report_service(
    session: AsyncSession = Depends(get_db),
) -> ReportGenerationService:
    return ReportGenerationService(session)
