"""
Reports Module — Service

Generates formatted reports: daily, weekly, monthly, quarterly, annual,
executive summaries, owner reports, and the comprehensive portfolio report.
"""
from datetime import date, timedelta

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.service import AIAdvisorService
from app.core.config import get_settings
from app.core.database import get_db
from app.finance.service import FinancialReportingService


class ReportGenerationService:
    """Generates formatted business reports."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.finance = FinancialReportingService(session)
        self.ai = AIAdvisorService(session)

    async def generate_weekly_report(self) -> dict:
        """Generate a weekly financial summary."""
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())
        end_of_week = start_of_week + timedelta(days=6)

        summary = await self.finance.get_summary(start_of_week, end_of_week)

        return {
            "report_type": "weekly",
            "period_start": start_of_week.isoformat(),
            "period_end": end_of_week.isoformat(),
            "generated_at": today.isoformat(),
            "summary": summary.model_dump(),
        }

    async def generate_monthly_report(self, year: int, month: int) -> dict:
        """Generate a full monthly report with AI insights."""
        report = await self.finance.get_monthly_report(year, month)
        ai_analysis = await self.ai.generate_advisor_report(year)

        return {
            "report_type": "monthly",
            "year": year,
            "month": month,
            "financial_data": report.model_dump(),
            "ai_insights": ai_analysis.get("executive_summary"),
            "provider": ai_analysis.get("provider", "hostwise"),
            "recommendations": self._flatten_actions(ai_analysis)[:3],
        }

    async def generate_annual_report(self, year: int) -> dict:
        """Generate a full annual report."""
        report = await self.finance.get_annual_report(year)
        ai_analysis = await self.ai.generate_advisor_report(year)

        return {
            "report_type": "annual",
            "year": year,
            "financial_data": report.model_dump(),
            "ai_insights": ai_analysis.get("executive_summary"),
            "provider": ai_analysis.get("provider", "hostwise"),
            "recommendations": self._flatten_actions(ai_analysis),
        }

    async def generate_executive_summary(self) -> dict:
        """Executive-level summary for investors/owners."""
        today = date.today()
        current_year = today.year

        annual = await self.finance.get_annual_report(current_year)
        ai = await self.ai.generate_advisor_report(current_year)

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
            "provider": ai.get("provider", "hostwise"),
            "top_recommendations": [
                r for r in self._flatten_actions(ai)
                if r.get("type") in ("critical", "warning")
            ][:5],
        }

    # ── Comprehensive Portfolio Report ──────────────────────────
    # Single response powering the Reports page: executive summary,
    # AI insights, KPI comparison, property table, expense analysis,
    # risks, goals, forecast, portfolio health, and tax summary.

    @staticmethod
    def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
        return max(low, min(high, round(value, 1)))

    @staticmethod
    def _health_status(score: float) -> str:
        if score >= 75:
            return "excellent"
        if score >= 50:
            return "good"
        if score >= 25:
            return "average"
        return "poor"

    @staticmethod
    def _pct_change(previous: float | None, current: float) -> float | None:
        if previous is not None and previous > 0:
            return round((current - previous) / previous * 100, 1)
        return None

    @staticmethod
    def _property_card(p: dict) -> dict:
        return {
            "property_id": p.get("property_id"),
            "property_name": p.get("property_name", "Unknown"),
            "gross_revenue": round(p.get("gross_revenue", 0.0), 2),
            "net_revenue": round(p.get("net_revenue", 0.0), 2),
            "total_expenses": round(p.get("total_expenses", 0.0), 2),
            "profit": round(p.get("profit", 0.0), 2),
            "profit_margin": p.get("profit_margin", 0.0),
            "health_score": p.get("health_score"),
        }

    @staticmethod
    def _flatten_actions(ai: dict) -> list:
        """Flatten advisor `priority_actions` into a single recommendations list."""
        pa = ai.get("priority_actions") or {}
        return (
            list(pa.get("critical") or [])
            + list(pa.get("medium") or [])
            + list(pa.get("low") or [])
        )

    async def generate_portfolio_report(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        currency: str = "USD",
    ) -> dict:
        """
        Generate a comprehensive portfolio report aggregating financials,
        analytics, AI insights, risks, goals, forecast, and tax summary.

        Period-aware: pass `start_date`/`end_date` for a custom range, or omit
        them to default to the current calendar year.
        """
        from app.analytics.service import AnalyticsService
        from app.settings.service import SettingsService

        today = date.today()
        if start_date is None or end_date is None:
            start_date = start_date or date(today.year, 1, 1)
            end_date = end_date or date(today.year, 12, 31)

        # Equally-sized preceding period for comparisons
        prev_end = start_date - timedelta(days=1)
        prev_start = prev_end - (end_date - start_date)

        # Business settings affect the report (currency + tax rate)
        settings = await SettingsService(self.session).get_all()
        if not currency:
            currency = settings.get("default_currency", "USD")
        tax_rate = float(settings.get("tax_rate", 0) or 0)

        # Financial data (current + previous period for comparisons)
        annual = await self.finance.get_period_report(start_date, end_date)
        prev_annual = await self.finance.get_period_report(prev_start, prev_end)

        # Portfolio analytics (property ranking, health, forecast)
        analytics = AnalyticsService(self.session)
        portfolio = await analytics.get_portfolio_analytics(
            start_date=start_date, end_date=end_date
        )

        # AI insights & recommendations (rules by default, LLM when configured)
        ai = await self.ai.generate_advisor_report(
            start_date=start_date, end_date=end_date
        )

        # ── Property performance (enriched with health) ──
        ranking_map = {
            str(r["property_id"]): r for r in portfolio.get("property_ranking", [])
        }
        property_performance = []
        for p in annual.revenue_by_property:
            rank = ranking_map.get(str(p.property_id), {})
            property_performance.append({
                **p.model_dump(),
                "health_score": rank.get("health_score"),
            })
        property_performance.sort(key=lambda x: x["net_revenue"], reverse=True)

        best = property_performance[0] if property_performance else None
        worst = property_performance[-1] if property_performance else None

        # ── KPI comparison (previous vs current) ──
        kpi_comparison = {
            "revenue": {
                "previous": round(prev_annual.summary.net_revenue, 2),
                "current": round(annual.summary.net_revenue, 2),
                "change_pct": self._pct_change(
                    prev_annual.summary.net_revenue, annual.summary.net_revenue
                ),
            },
            "profit": {
                "previous": round(prev_annual.summary.profit, 2),
                "current": round(annual.summary.profit, 2),
                "change_pct": self._pct_change(
                    prev_annual.summary.profit, annual.summary.profit
                ),
            },
            "expenses": {
                "previous": round(prev_annual.summary.total_expenses, 2),
                "current": round(annual.summary.total_expenses, 2),
                "change_pct": self._pct_change(
                    prev_annual.summary.total_expenses, annual.summary.total_expenses
                ),
            },
        }

        # ── Portfolio health ──
        portfolio_health = self._compute_portfolio_health(
            portfolio, annual, kpi_comparison
        )

        # ── Executive summary ──
        executive_summary = {
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "gross_revenue": annual.summary.gross_revenue,
            "net_profit": annual.summary.profit,
            "profit_margin": annual.summary.profit_margin,
            "property_count": annual.summary.property_count,
            "best_property": self._property_card(best) if best else None,
            "worst_property": self._property_card(worst) if worst else None,
            "portfolio_health_score": portfolio_health["score"],
            "portfolio_health_status": portfolio_health["status"],
        }

        # ── Derived sections ──
        ai_insights = self._build_ai_insights(ai, kpi_comparison, annual, portfolio)
        expense_analysis = self._build_expense_analysis(annual, prev_annual)
        risks = self._build_risks(ai, kpi_comparison, annual, best)
        goals = await self._build_goals(prev_annual, portfolio)
        forecast = self._build_forecast(start_date, end_date, portfolio, annual)

        taxable_income = round(
            annual.summary.net_revenue - annual.summary.total_expenses, 2
        )
        tax_summary = {
            "rental_income": round(annual.summary.net_revenue, 2),
            "deductible_expenses": round(annual.summary.total_expenses, 2),
            "estimated_taxable_income": taxable_income,
            "tax_rate": tax_rate,
            "estimated_tax_liability": round(taxable_income * tax_rate / 100, 2),
        }

        return {
            "report_type": "portfolio",
            "year": end_date.year,
            "provider": ai.get("provider", "hostwise"),
            "generated_at": today.isoformat(),
            "organization": get_settings().APP_NAME,
            "currency": currency.upper(),
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "label": self._format_period_label(start_date, end_date),
                "days": (end_date - start_date).days + 1,
            },
            "previous_period": {
                "start": prev_start.isoformat(),
                "end": prev_end.isoformat(),
                "label": self._format_period_label(prev_start, prev_end),
                "days": (prev_end - prev_start).days + 1,
            },
            "executive_summary": executive_summary,
            "ai_insights": ai_insights,
            "kpi_comparison": kpi_comparison,
            "property_performance": property_performance,
            "monthly_breakdown": [m.model_dump() for m in annual.monthly_breakdown],
            "expense_analysis": expense_analysis,
            "best_worst_properties": {
                "best": self._property_card(best) if best else None,
                "worst": self._property_card(worst) if worst else None,
            },
            "risks": risks,
            "goals": goals,
            "forecast": forecast,
            "portfolio_health": portfolio_health,
            "tax_summary": tax_summary,
        }

    def _compute_portfolio_health(
        self,
        portfolio: dict,
        annual,
        kpi: dict,
    ) -> dict:
        """Compute a portfolio health score (0-100) + component bars."""
        # Component scores (used for the visual bars)
        rev_growth = kpi["revenue"]["change_pct"]
        revenue_score = self._clamp(50 + (rev_growth or 0) * 2.5)

        margin = annual.summary.profit_margin
        profit_score = self._clamp(margin / 50 * 100)

        net = annual.summary.net_revenue
        expense_ratio = (annual.summary.total_expenses / net * 100) if net > 0 else 0.0
        expense_score = self._clamp(100 - expense_ratio * 0.8)

        # Overall score: average property health when available,
        # otherwise a weighted blend of the component scores.
        ranking = portfolio.get("property_ranking", [])
        if ranking:
            score = round(
                sum(r.get("health_score", 50) for r in ranking) / len(ranking), 1
            )
        else:
            score = round(
                revenue_score * 0.30
                + profit_score * 0.35
                + expense_score * 0.35,
                1,
            )

        return {
            "score": score,
            "status": self._health_status(score),
            "components": {
                "revenue": revenue_score,
                "profit": profit_score,
                "expenses": expense_score,
            },
            "distribution": portfolio.get(
                "health_distribution",
                {"excellent": 0, "good": 0, "average": 0, "poor": 0},
            ),
        }

    def _build_ai_insights(
        self,
        ai: dict,
        kpi: dict,
        annual,
        portfolio: dict,
    ) -> dict:
        """Natural-language insights + drivers + top risk/recommendation."""
        drivers = []

        exp = kpi["expenses"]["change_pct"]
        if exp is not None:
            direction = "down" if exp <= 0 else "up"
            drivers.append({
                "label": "Total expenses",
                "detail": f"{direction.capitalize()} {abs(exp):.1f}%",
            })

        for c in annual.expense_by_category:
            if "maintenance" in c.category_name.lower() or "repair" in c.category_name.lower():
                drivers.append({
                    "label": "Maintenance costs",
                    "detail": f"{c.total:,.0f} ({c.percentage}% of expenses)",
                })
                break

        recs = self._flatten_actions(ai)
        critical = [r for r in recs if r.get("type") == "critical"]
        warnings = [r for r in recs if r.get("type") == "warning"]
        top = (critical or warnings or recs or [None])[0]

        biggest_risk = None
        if top:
            biggest_risk = {
                "level": top.get("type"),
                "title": top.get("title"),
                "cause": top.get("cause"),
                "suggested_action": top.get("suggested_action"),
            }

        recommendation = (
            biggest_risk["suggested_action"]
            if biggest_risk and biggest_risk.get("suggested_action")
            else "No critical actions required — the portfolio is on track."
        )

        return {
            "summary": ai.get("executive_summary", ""),
            "provider": ai.get("provider", "hostwise"),
            "revenue_change_pct": portfolio.get("revenue_growth_yoy"),
            "drivers": drivers,
            "biggest_risk": biggest_risk,
            "recommendation": recommendation,
            "recommendations": recs[:5],
        }

    def _build_expense_analysis(self, annual, prev_annual) -> dict:
        """Expense categories with biggest / smallest / fastest-growing."""
        categories = [c.model_dump() for c in annual.expense_by_category]
        prev_map = {c.category_name: c.total for c in prev_annual.expense_by_category}

        for c in categories:
            prev_total = prev_map.get(c["category_name"], 0.0)
            c["growth_pct"] = (
                round((c["total"] - prev_total) / prev_total * 100, 1)
                if prev_total > 0 else None
            )

        if not categories:
            return {"categories": [], "biggest": None, "smallest": None, "fastest_growing": None}

        biggest = max(categories, key=lambda x: x["total"])
        smallest = min(categories, key=lambda x: x["total"])
        growing = [
            c for c in categories
            if c.get("growth_pct") is not None and c["total"] > 0
        ]
        fastest_growing = max(growing, key=lambda x: x["growth_pct"]) if growing else None

        return {
            "categories": categories,
            "biggest": biggest,
            "smallest": smallest,
            "fastest_growing": fastest_growing,
        }

    def _build_risks(
        self,
        ai: dict,
        kpi: dict,
        annual,
        best: dict | None,
    ) -> list[dict]:
        """Business risks: AI recommendations + computed risk signals."""
        risks: list[dict] = []
        seen: set[str] = set()

        def add(level: str, title: str, detail: str) -> None:
            key = title.lower()
            if key in seen:
                return
            seen.add(key)
            risks.append({"level": level, "title": title, "detail": detail})

        for r in self._flatten_actions(ai):
            if r.get("type") in ("critical", "warning"):
                add(
                    "high" if r["type"] == "critical" else "medium",
                    r.get("title", "Risk"),
                    r.get("cause", ""),
                )

        if best and annual.summary.net_revenue > 0:
            share = best["net_revenue"] / annual.summary.net_revenue * 100
            if share > 50:
                add(
                    "medium",
                    "Revenue concentration",
                    f"{best['property_name']} generates {share:.0f}% of total "
                    f"revenue — heavy reliance on a single property.",
                )

        net_by_month = [
            m.net_revenue for m in annual.monthly_breakdown if m.net_revenue > 0
        ]
        if len(net_by_month) >= 4:
            peak, trough = max(net_by_month), min(net_by_month)
            if peak / trough > 3:
                add(
                    "medium",
                    "Seasonal dependency",
                    f"Revenue swings from {trough:,.0f} to {peak:,.0f} per month — "
                    f"a {peak / trough:.1f}x seasonal gap.",
                )

        if annual.summary.net_revenue > 0:
            ratio = annual.summary.total_expenses / annual.summary.net_revenue * 100
            if ratio > 60:
                add(
                    "medium",
                    "High expense ratio",
                    f"Expenses consume {ratio:.0f}% of net revenue, squeezing profitability.",
                )

        return risks

    async def _build_goals(self, prev_annual, portfolio: dict) -> dict:
        """Revenue goals with current progress."""
        from app.properties.repository import PropertyRepository

        prop_repo = PropertyRepository(self.session)
        props = await prop_repo.get_all_properties()

        revenue_goal = sum(
            p.target_annual_revenue for p in props if p.target_annual_revenue
        )
        if not revenue_goal:
            revenue_goal = (
                round(prev_annual.summary.net_revenue * 1.2, 2)
                if prev_annual.summary.net_revenue > 0 else 0.0
            )

        current_net = portfolio.get("net_revenue", 0.0)
        revenue_progress = (
            round(current_net / revenue_goal * 100, 1) if revenue_goal > 0 else 0.0
        )

        return {
            "revenue": {
                "goal": round(revenue_goal, 2),
                "current": round(current_net, 2),
                "progress": self._clamp(revenue_progress),
            },
        }

    def _build_forecast(
        self,
        start_date,
        end_date,
        portfolio: dict,
        annual,
    ) -> dict:
        """Next-quarter revenue forecast with confidence."""
        today = date.today()

        months = [
            m for m in annual.monthly_breakdown
            if m.gross_revenue > 0 or m.net_revenue > 0
        ]
        # Only count completed months when the range reaches the present
        if end_date >= today and months:
            months = [
                m for m in months
                if m.year < today.year or (m.year == today.year and m.month <= today.month)
            ]

        relevant = months[-3:] if months else []
        pool = relevant or months

        if pool:
            avg_monthly = sum(m.net_revenue for m in pool) / len(pool)
        else:
            avg_monthly = portfolio.get("net_revenue", 0.0) / max(len(annual.monthly_breakdown), 1)

        data_months = len(months)
        confidence = round(
            min(95, 45 + data_months * 3 + (12 if data_months >= 12 else 0))
        )

        return {
            "next_quarter_revenue": round(avg_monthly * 3, 2),
            "confidence": confidence,
        }

    @staticmethod
    def _format_period_label(start: date, end: date) -> str:
        return f"{start.strftime('%b %d, %Y')} – {end.strftime('%b %d, %Y')}"


async def get_report_service(
    session: AsyncSession = Depends(get_db),
) -> ReportGenerationService:
    return ReportGenerationService(session)
