"""
AI Module — Financial Advisor

Rule-based AI for MVP. Analyzes financial data and generates
actionable business recommendations.

Future: Replace with LLM-based analysis when volume justifies it.
The interface stays the same — swap the implementation.
"""
import uuid
from datetime import date
from typing import Optional
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db


class AIAdvisorService:
    """
    AI-powered financial advisor.

    For MVP, uses rule-based analysis with statistical thresholds.
    When the business grows, this becomes an LLM-powered engine.
    The interface (input: org_id, output: recommendations) doesn't change.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def analyze_financial_performance(
        self, organization_id: uuid.UUID
    ) -> dict:
        """
        Analyze financial performance and generate recommendations.

        Returns:
            - Summary of findings
            - List of recommendations with confidence scores
            - Supporting metrics
        """
        from app.finance.service import FinancialReportingService
        from app.analytics.service import AnalyticsService

        report_service = FinancialReportingService(self.session)
        analytics_service = AnalyticsService(self.session)

        today = date.today()
        current_year = today.year

        # Gather data
        portfolio = await analytics_service.get_portfolio_analytics(
            organization_id, current_year
        )
        summary = await report_service.get_summary(organization_id)

        recommendations = []

        # 1. Profit margin analysis
        if summary.profit_margin < 0:
            recommendations.append({
                "type": "critical",
                "title": "Negative Profit Margin Detected",
                "cause": f"Profit margin is {summary.profit_margin}%. Expenses exceed net revenue.",
                "business_impact": "Portfolio is losing money. Unsustainable trajectory.",
                "suggested_action": "Immediately review top expense categories. Consider reducing non-essential spending and adjusting pricing.",
                "expected_improvement": "Target: Return to positive margin within 2 months.",
                "confidence_score": 0.95,
                "supporting_metrics": {
                    "profit_margin": summary.profit_margin,
                    "total_expenses": summary.total_expenses,
                    "net_revenue": summary.net_revenue,
                },
            })
        elif summary.profit_margin < 15:
            recommendations.append({
                "type": "warning",
                "title": "Low Profit Margin",
                "cause": f"Profit margin is only {summary.profit_margin}%.",
                "business_impact": "Limited profitability reduces ability to reinvest and handle unexpected costs.",
                "suggested_action": "Analyze expense categories for savings. Consider 3-5% price adjustment on low-occupancy days.",
                "expected_improvement": "Potential margin improvement of 5-8%.",
                "confidence_score": 0.82,
                "supporting_metrics": {
                    "profit_margin": summary.profit_margin,
                    "avg_revenue_per_property": summary.avg_revenue_per_property,
                },
            })

        # 2. Revenue growth analysis
        if portfolio.get("revenue_growth_yoy") is not None:
            growth = portfolio["revenue_growth_yoy"]
            if growth < -10:
                recommendations.append({
                    "type": "critical",
                    "title": "Revenue Declining Significantly",
                    "cause": f"Year-over-year revenue decreased by {abs(growth)}%.",
                    "business_impact": f"At current trajectory, annual revenue could drop by ~${abs(summary.net_revenue * growth / 100):,.0f}.",
                    "suggested_action": "Investigate: Has occupancy dropped? Are competitors lowering prices? Review listing quality and pricing strategy.",
                    "expected_improvement": "Reversing trend could recover ${abs(growth):.0f}% of lost revenue.",
                    "confidence_score": 0.88,
                    "supporting_metrics": {
                        "revenue_growth_yoy": growth,
                        "current_net_revenue": summary.net_revenue,
                    },
                })
            elif growth < 0:
                recommendations.append({
                    "type": "warning",
                    "title": "Revenue Growth Slowing",
                    "cause": f"Year-over-year revenue decreased by {abs(growth)}%.",
                    "business_impact": "Portfolio is underperforming compared to previous year.",
                    "suggested_action": "Check seasonal trends. Consider promotional pricing for shoulder seasons.",
                    "expected_improvement": "Small adjustments could bring growth back to flat or positive.",
                    "confidence_score": 0.75,
                    "supporting_metrics": {
                        "revenue_growth_yoy": growth,
                    },
                })
            elif growth > 10:
                recommendations.append({
                    "type": "positive",
                    "title": "Strong Revenue Growth",
                    "cause": f"Revenue grew {growth}% year-over-year.",
                    "business_impact": "Portfolio is performing well. Opportunity to reinvest or expand.",
                    "suggested_action": "Consider adding properties. Reinvest profits into property upgrades.",
                    "expected_improvement": "Sustained growth could compound significantly.",
                    "confidence_score": 0.90,
                    "supporting_metrics": {
                        "revenue_growth_yoy": growth,
                    },
                })

        # 3. Expense ratio analysis
        from app.finance.repository import ExpenseRepository
        exp_repo = ExpenseRepository(self.session)
        exp_cats = await exp_repo.get_expenses_by_category(
            organization_id,
            start_date=date(current_year, 1, 1),
            end_date=date(current_year, 12, 31),
        )

        for cat in exp_cats:
            if cat["percentage"] > 25:
                recommendations.append({
                    "type": "warning",
                    "title": f"High {cat['category_name']} Costs",
                    "cause": f"{cat['category_name']} represents {cat['percentage']}% of total expenses (${cat['total']:,.2f}).",
                    "business_impact": "This expense category is disproportionately high.",
                    "suggested_action": f"Review {cat['category_name'].lower()} providers. Get competing quotes. Check for waste or overcharging.",
                    "expected_improvement": "Reducing by 20% would save ${cat['total'] * 0.20:,.2f} annually.",
                    "confidence_score": 0.80,
                    "supporting_metrics": {
                        "category": cat["category_name"],
                        "total": cat["total"],
                        "percentage": cat["percentage"],
                    },
                })

        # 4. Commission analysis
        from app.organizations.repository import OrganizationRepository
        org_repo = OrganizationRepository(self.session)
        org = await org_repo.get_by_id(organization_id)
        if org and org.commission_percentage > 20:
            recommendations.append({
                "type": "info",
                "title": "High Concierge Commission Rate",
                "cause": f"Concierge commission is set at {org.commission_percentage}%.",
                "business_impact": "Higher-than-average commission eats into margins.",
                "suggested_action": "Benchmark against industry average (15-20%). Negotiate or consider self-management.",
                "expected_improvement": "Reducing commission by 5% would add ${summary.net_revenue * 0.05:,.2f} to bottom line.",
                "confidence_score": 0.85,
                "supporting_metrics": {
                    "commission_percentage": org.commission_percentage,
                    "annual_net_revenue": summary.net_revenue,
                },
            })

        # 5. Property ranking insights
        ranking = portfolio.get("property_ranking", [])
        if len(ranking) >= 2:
            best = ranking[0]
            worst = ranking[-1]
            if best["net_revenue"] > worst["net_revenue"] * 3:
                recommendations.append({
                    "type": "warning",
                    "title": "Large Revenue Gap Between Properties",
                    "cause": f"Top property ({best['property_name']}) generates {best['net_revenue']/max(worst['net_revenue'],1):.1f}x more than bottom property ({worst['property_name']}).",
                    "business_impact": "Underperforming property is dragging down portfolio average.",
                    "suggested_action": f"Deep-dive analysis on {worst['property_name']}. Check listing quality, pricing, and occupancy.",
                    "expected_improvement": "Bringing bottom property to 50% of top would add significant revenue.",
                    "confidence_score": 0.78,
                    "supporting_metrics": {
                        "best_property": best["property_name"],
                        "worst_property": worst["property_name"],
                        "gap_multiple": round(best["net_revenue"] / max(worst["net_revenue"], 1), 1),
                    },
                })

        # Executive summary
        summary_text = self._generate_executive_summary(
            summary, portfolio, recommendations
        )

        return {
            "organization_id": str(organization_id),
            "analysis_date": today.isoformat(),
            "executive_summary": summary_text,
            "key_metrics": {
                "gross_revenue": summary.gross_revenue,
                "net_revenue": summary.net_revenue,
                "total_expenses": summary.total_expenses,
                "profit_margin": summary.profit_margin,
                "revenue_growth_yoy": portfolio.get("revenue_growth_yoy"),
                "property_count": summary.property_count,
            },
            "recommendations": recommendations,
            "recommendation_count": len(recommendations),
            "critical_count": sum(1 for r in recommendations if r["type"] == "critical"),
            "warning_count": sum(1 for r in recommendations if r["type"] == "warning"),
        }

    def _generate_executive_summary(
        self, summary, portfolio, recommendations
    ) -> str:
        """Generate natural language executive summary."""
        parts = []

        if summary.profit_margin >= 0:
            parts.append(
                f"Your portfolio generated ${summary.net_revenue:,.2f} in net revenue "
                f"with a profit margin of {summary.profit_margin}%."
            )
        else:
            parts.append(
                f"Your portfolio shows a negative profit margin of {abs(summary.profit_margin)}%. "
                f"Expenses (${summary.total_expenses:,.2f}) exceed net revenue (${summary.net_revenue:,.2f})."
            )

        growth = portfolio.get("revenue_growth_yoy")
        if growth is not None:
            direction = "increased" if growth >= 0 else "decreased"
            parts.append(
                f"Revenue {direction} by {abs(growth)}% compared to last year."
            )

        critical = [r for r in recommendations if r["type"] == "critical"]
        warnings = [r for r in recommendations if r["type"] == "warning"]
        positives = [r for r in recommendations if r["type"] == "positive"]

        if critical:
            parts.append(
                f"⚠️ {len(critical)} critical issue(s) need immediate attention."
            )
        if warnings:
            parts.append(
                f"There are {len(warnings)} area(s) that could be improved."
            )
        if positives:
            parts.append(
                f"✅ {len(positives)} positive trend(s) identified."
            )

        return " ".join(parts)


async def get_ai_advisor_service(
    session: AsyncSession = Depends(get_db),
) -> AIAdvisorService:
    return AIAdvisorService(session)
