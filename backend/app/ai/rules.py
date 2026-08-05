"""
HostWise Built-in Rules Engine

Deterministic, rule-based financial analysis for the AI advisor.
Used when the user selects "HostWise AI (built-in rules)" (ai_provider=hostwise).

External API providers (OpenAI / DeepSeek / Anthropic / Ollama) live in
`app/ai/providers.py`; the orchestrator in `app/ai/service.py` composes the two.
"""
from calendar import month_name
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

CURRENCY_SYMBOL = {
    "USD": "$", "EUR": "€", "GBP": "£",
    "MAD": "MAD ", "AED": "AED ", "CAD": "C$", "AUD": "A$", "CHF": "CHF ",
}


class HostWiseRulesEngine:
    """Pure rule-based analysis — no external API calls."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def analyze_financial_performance(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict:
        """
        Analyze financial performance and generate recommendations (rules).

        Accepts an optional date range; when omitted, defaults to the current
        calendar year (the pre-existing behaviour).

        Returns:
            - Summary of findings
            - List of recommendations with confidence scores
            - Supporting metrics
        """
        from app.analytics.service import AnalyticsService
        from app.finance.service import FinancialReportingService

        report_service = FinancialReportingService(self.session)
        analytics_service = AnalyticsService(self.session)

        today = date.today()
        if start_date is None or end_date is None:
            start_date = start_date or date(today.year, 1, 1)
            end_date = end_date or date(today.year, 12, 31)

        # Currency symbol (used across all generated text)
        from app.settings.service import SettingsService
        settings = await SettingsService(self.session).get_all()
        cur = settings.get("default_currency", "EUR")
        symbol = CURRENCY_SYMBOL.get(cur, f"{cur} ")

        # Gather data
        portfolio = await analytics_service.get_portfolio_analytics(
            start_date=start_date, end_date=end_date
        )
        summary = await report_service.get_summary(start_date=start_date, end_date=end_date)

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
                    "business_impact": f"At current trajectory, annual revenue could drop by ~{symbol}{abs(summary.net_revenue * growth / 100):,.0f}.",
                    "suggested_action": "Investigate: Has occupancy dropped? Are competitors lowering prices? Review listing quality and pricing strategy.",
                    "expected_improvement": f"Reversing trend could recover {symbol}{abs(growth):.0f}% of lost revenue.",
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
            start_date=start_date,
            end_date=end_date,
        )

        for cat in exp_cats:
            if cat["percentage"] > 25:
                recommendations.append({
                    "type": "warning",
                    "title": f"High {cat['category_name']} Costs",
                    "cause": f"{cat['category_name']} represents {cat['percentage']}% of total expenses ({symbol}{cat['total']:,.2f}).",
                    "business_impact": "This expense category is disproportionately high.",
                    "suggested_action": f"Review {cat['category_name'].lower()} providers. Get competing quotes. Check for waste or overcharging.",
                    "expected_improvement": f"Reducing by 20% would save {symbol}{cat['total'] * 0.20:,.2f} annually.",
                    "confidence_score": 0.80,
                    "supporting_metrics": {
                        "category": cat["category_name"],
                        "total": cat["total"],
                        "percentage": cat["percentage"],
                    },
                })

        # 4. Property ranking insights
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
            summary, portfolio, recommendations, symbol
        )

        return {
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
        self, summary, portfolio, recommendations, symbol: str = "$"
    ) -> str:
        """Generate natural language executive summary."""
        parts = []

        if summary.profit_margin >= 0:
            parts.append(
                f"Your portfolio generated {symbol}{summary.net_revenue:,.2f} in net revenue "
                f"with a profit margin of {summary.profit_margin}%."
            )
        else:
            parts.append(
                f"Your portfolio shows a negative profit margin of {abs(summary.profit_margin)}%. "
                f"Expenses ({symbol}{summary.total_expenses:,.2f}) exceed net revenue "
                f"({symbol}{summary.net_revenue:,.2f})."
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

    # ── Advisor Dashboard ───────────────────────────────────────────
    # Powers the AI Advisor page: executive summary, business health,
    # priority actions, opportunities, lost revenue, risks, property
    # reviews, 30-day forecast, achievements, goals, trend explanations.

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
    def _format_period_label(start: date, end: date) -> str:
        return f"{start.strftime('%b %d, %Y')} – {end.strftime('%b %d, %Y')}"

    async def build_advisor_report(
        self,
        year: int | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        analysis_level: str = "detailed",
    ) -> tuple[dict, dict]:
        """
        Build the rule-based advisor report (no LLM).

        Returns a tuple of (report, llm_context) where llm_context holds the
        internal data (kpi growth, property ranking) the orchestrator sends to
        an external LLM when one is configured.

        `analysis_level` (summary | detailed | expert) trims how much of the
        report is populated. Sections are truncated (never emptied to an
        incompatible shape) so the UI can never break.
        """
        from app.analytics.service import AnalyticsService
        from app.finance.service import FinancialReportingService

        today = date.today()
        if start_date is None or end_date is None:
            if year is None:
                year = today.year
            start_date = start_date or date(year, 1, 1)
            end_date = end_date or date(year, 12, 31)
        prev_end = start_date - timedelta(days=1)
        prev_start = prev_end - (end_date - start_date)

        analytics = AnalyticsService(self.session)
        finance = FinancialReportingService(self.session)

        ai = await self.analyze_financial_performance(start_date=start_date, end_date=end_date)
        portfolio = await analytics.get_portfolio_analytics(start_date=start_date, end_date=end_date)
        prev_portfolio = await analytics.get_portfolio_analytics(start_date=prev_start, end_date=prev_end)
        annual = await finance.get_period_report(start_date, end_date)
        prev_annual = await finance.get_period_report(prev_start, prev_end)

        def pct(prev_val: float, cur_val: float) -> float | None:
            if prev_val and prev_val > 0:
                return round((cur_val - prev_val) / prev_val * 100, 1)
            return None

        ranking = portfolio.get("property_ranking", [])
        prev_ranking_map = {
            str(r["property_id"]): r
            for r in prev_portfolio.get("property_ranking", [])
        }
        fin_map = {str(p.property_id): p for p in annual.revenue_by_property}

        kpi = {
            "revenue": pct(prev_annual.summary.net_revenue, annual.summary.net_revenue),
            "profit": pct(prev_annual.summary.profit, annual.summary.profit),
            "expenses": pct(
                prev_annual.summary.total_expenses, annual.summary.total_expenses
            ),
        }

        base_report = {
            "year": end_date.year,
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "label": self._format_period_label(start_date, end_date),
                "days": (end_date - start_date).days + 1,
            },
            "generated_at": today.isoformat(),
            "executive_summary": ai.get("executive_summary", ""),
            "key_metrics": ai.get("key_metrics", {}),
            "current_metrics": {
                "net_revenue": annual.summary.net_revenue,
                "gross_revenue": annual.summary.gross_revenue,
                "total_expenses": annual.summary.total_expenses,
                "profit": annual.summary.profit,
                "profit_margin": annual.summary.profit_margin,
                "cancellation_rate": portfolio.get("cancellation_rate", 0),
                "revenue_growth_yoy": portfolio.get("revenue_growth_yoy"),
                "property_count": portfolio.get("property_count", 0),
            },
            "health_score": self._build_health_score(ai, portfolio, annual, kpi),
            "priority_actions": self._build_priority_actions(ai, annual),
            "opportunities": self._build_opportunities(portfolio, annual),
            "lost_revenue": self._build_lost_revenue(portfolio, annual),
            "risks": self._build_property_risks(ranking, prev_ranking_map),
            "property_reviews": self._build_property_reviews(ranking, fin_map),
            "forecast": self._build_30day_forecast(start_date, end_date, portfolio, annual, ranking),
            "achievements": self._build_achievements(annual, prev_annual, portfolio),
            "recommended_goals": await self._build_recommended_goals(
                annual, prev_annual, portfolio
            ),
            "trend_explanations": self._build_trend_explanations(kpi, annual),
            "monthly_breakdown": [m.model_dump() for m in annual.monthly_breakdown],
            "expense_categories": [
                c.model_dump() for c in annual.expense_by_category
            ],
        }

        # Analysis level trims depth without changing the report shape.
        if analysis_level == "summary":
            actions = base_report.get("priority_actions", {})
            base_report["priority_actions"] = {
                "critical": actions.get("critical", [])[:2],
                "medium": [],
                "low": [],
            }
            base_report["property_reviews"] = base_report["property_reviews"][:1]
            base_report["risks"] = base_report["risks"][:1]
            base_report["achievements"] = base_report["achievements"][:1]
            base_report["recommended_goals"] = base_report["recommended_goals"][:1]
            base_report["trend_explanations"] = base_report["trend_explanations"][:1]
        base_report["analysis_level"] = analysis_level

        return base_report, {
            "kpi_growth": kpi,
            "property_ranking": [
                {
                    "property_id": r["property_id"],
                    "property_name": r["property_name"],
                    "net_revenue": r["net_revenue"],
                    "reservation_count": r["reservation_count"],
                    "profit_margin": r.get("profit_margin"),
                }
                for r in ranking
            ],
        }

    def _build_health_score(self, ai, portfolio, annual, kpi) -> dict:
        growth = kpi["revenue"] or 0
        net = annual.summary.net_revenue
        expense_ratio = (annual.summary.total_expenses / net * 100) if net > 0 else 0

        revenue_score = self._clamp(50 + growth * 2.5)
        expenses_score = self._clamp(100 - expense_ratio * 0.8)
        growth_score = self._clamp(50 + growth * 3)
        risk_count = ai.get("critical_count", 0) * 15 + ai.get("warning_count", 0) * 8
        risk_score = self._clamp(100 - risk_count)

        ranking = portfolio.get("property_ranking", [])
        if ranking:
            overall = round(
                sum(r.get("health_score", 50) for r in ranking) / len(ranking), 1
            )
        else:
            overall = round(
                revenue_score * 0.25
                + expenses_score * 0.20
                + growth_score * 0.25
                + risk_score * 0.30,
                1,
            )

        return {
            "score": overall,
            "status": self._health_status(overall),
            "components": {
                "revenue": revenue_score,
                "expenses": expenses_score,
                "growth": growth_score,
                "risk": risk_score,
            },
        }

    def _build_priority_actions(self, ai, annual) -> dict:
        recs = ai.get("recommendations", [])
        critical = [r for r in recs if r.get("type") == "critical"]
        medium = [r for r in recs if r.get("type") == "warning"]
        low = [r for r in recs if r.get("type") == "positive"]
        low_titles = {r.get("title", "").lower() for r in low}

        if annual.summary.net_revenue > 0 and "export monthly report" not in low_titles:
            low.append({
                "type": "info",
                "title": "Export monthly report",
                "cause": "Keep a record for tax season and owner reporting.",
                "business_impact": "Better documentation and easier annual filing.",
                "suggested_action": "Open Reports and export to Excel or PDF.",
                "expected_improvement": "Saved time at year end.",
                "confidence_score": 0.9,
            })
        if "review pricing strategy" not in low_titles:
            low.append({
                "type": "info",
                "title": "Review pricing strategy",
                "cause": "Pricing directly drives revenue and profitability.",
                "business_impact": "Optimized rates improve profit margins.",
                "suggested_action": "Compare weekend vs midweek rates; test seasonal pricing.",
                "expected_improvement": "2-5% revenue uplift.",
                "confidence_score": 0.75,
            })

        return {"critical": critical, "medium": medium, "low": low}

    def _build_opportunities(self, portfolio, annual) -> dict:
        gross = portfolio.get("gross_revenue", 0)

        actions = []
        actions.append({
            "title": "Increase weekend pricing",
            "detail": "Weekend demand is less price-sensitive",
            "gain": round(gross * 0.05, 2),
        })
        actions.append({
            "title": "Adjust minimum stay",
            "detail": "Reduce gaps between bookings",
            "gain": round(gross * 0.03, 2),
        })
        actions.append({
            "title": "Enable dynamic pricing",
            "detail": "Match rates to demand peaks",
            "gain": round(gross * 0.04, 2),
        })

        data_months = sum(1 for m in annual.monthly_breakdown if m.net_revenue > 0)
        return {
            "potential_revenue": round(sum(a["gain"] for a in actions), 2),
            "confidence": round(min(95, 60 + data_months * 2)),
            "actions": actions,
        }

    def _build_lost_revenue(self, portfolio, annual) -> dict:
        gross = portfolio.get("gross_revenue", 0)
        cancel_rate = portfolio.get("cancellation_rate", 0)

        reasons = []
        amount = 0.0

        lost_weekend = round(gross * 0.04, 2)
        reasons.append({
            "reason": "Cheap weekends",
            "detail": "Weekend rates below demand",
            "amount": lost_weekend,
        })
        amount += lost_weekend

        if cancel_rate > 5:
            lost_cancel = round(gross * (cancel_rate / 100) * 0.5, 2)
            reasons.append({
                "reason": "High cancellations",
                "detail": f"{cancel_rate:.0f}% cancellation rate",
                "amount": lost_cancel,
            })
            amount += lost_cancel

        return {
            "estimated_lost_revenue": round(amount, 2),
            "reasons": reasons,
        }

    def _build_property_risks(self, ranking, prev_ranking_map) -> list[dict]:
        risks = []
        for r in ranking:
            prev = prev_ranking_map.get(str(r.get("property_id")), {})
            prev_rev = prev.get("net_revenue", 0) or 0
            trend = (
                round((r["net_revenue"] - prev_rev) / prev_rev * 100, 1)
                if prev_rev > 0 else None
            )
            margin = r.get("profit_margin", 0)
            health = r.get("health_score")
            if (trend is not None and trend < -10) or margin < 0 or (health is not None and health < 40):
                level = "high" if (trend is not None and trend < -20) or margin < 0 else "medium"
                if margin < 0:
                    recommendation = "The property is unprofitable — review pricing and cut discretionary costs."
                elif trend is not None and trend < -20:
                    recommendation = "Investigate the decline; review listing quality and competition."
                else:
                    recommendation = "Monitor momentum and adjust marketing spend."
                risks.append({
                    "level": level,
                    "property_name": r.get("property_name", "Unknown"),
                    "revenue_trend_pct": trend,
                    "profit_margin": margin,
                    "health_score": health,
                    "recommendation": recommendation,
                })
        risks.sort(key=lambda x: (x["level"] != "high", x.get("profit_margin", 0)))
        return risks

    def _build_property_reviews(self, ranking, fin_map) -> list[dict]:
        reviews = []
        for r in ranking:
            pid = str(r.get("property_id"))
            fin = fin_map.get(pid)
            margin = r.get("profit_margin", 0)
            health = r.get("health_score")
            total_exp = fin.total_expenses if fin else 0
            net_rev = r.get("net_revenue", 0)
            expense_ratio = (total_exp / net_rev * 100) if net_rev > 0 else 0

            strengths, weaknesses = [], []
            if margin >= 60:
                strengths.append("Highest profit margin")
            elif margin < 0:
                weaknesses.append("Negative profit margin")
            if health is not None and health >= 75:
                strengths.append("Healthy overall score")
            elif health is not None and health < 50:
                weaknesses.append("Below-average health score")
            if expense_ratio < 30:
                strengths.append("Efficient expense management")
            elif expense_ratio > 60:
                weaknesses.append("Expenses above average")

            if not strengths:
                strengths.append("Stable performance")
            if not weaknesses:
                weaknesses.append("No major concerns")

            w_first = weaknesses[0].lower()
            if "margin" in w_first:
                suggested = "Review rates and reduce discretionary expenses."
            elif "expense" in w_first:
                suggested = "Re-negotiate supplier contracts and audit recurring costs."
            elif "health" in w_first:
                suggested = "Deep-dive into KPIs and fix the weakest metric first."
            else:
                suggested = "Maintain the strategy and reinvest profits into upgrades."

            ai_summary_parts = [strengths[0].capitalize()] + strengths[1:] + weaknesses
            ai_summary = ". ".join(p for p in ai_summary_parts) + "."

            reviews.append({
                "property_id": pid,
                "property_name": r.get("property_name", "Unknown"),
                "health_score": health,
                "status": self._health_status(health) if health is not None else "unknown",
                "net_revenue": round(net_rev, 2),
                "profit_margin": margin,
                "expense_ratio": round(expense_ratio, 1),
                "ai_summary": ai_summary,
                "strengths": strengths,
                "weaknesses": weaknesses,
                "suggested_action": suggested,
            })
        reviews.sort(key=lambda x: -(x["net_revenue"] or 0))
        return reviews

    def _build_30day_forecast(self, start_date, end_date, portfolio, annual, ranking) -> dict:
        today = date.today()
        months = [m for m in annual.monthly_breakdown if m.net_revenue > 0]
        # Only use completed months when the range reaches the present
        if end_date >= today and months:
            months = [
                m for m in months
                if m.year < today.year or (m.year == today.year and m.month <= today.month)
            ]
        pool = months[-1:] or months
        if pool:
            expected_revenue = round(sum(m.net_revenue for m in pool) / len(pool), 2)
        else:
            expected_revenue = round(portfolio.get("net_revenue", 0) / 12, 2)

        cancel = portfolio.get("cancellation_rate", 0)
        growth = portfolio.get("revenue_growth_yoy")

        if cancel > 15 or (growth is not None and growth < -10):
            risk_level = "high"
        elif cancel > 8 or (growth is not None and growth < 0):
            risk_level = "medium"
        else:
            risk_level = "low"

        best = ranking[0] if ranking else None
        return {
            "expected_revenue": expected_revenue,
            "risk_level": risk_level,
            "best_property": best.get("property_name") if best else None,
            "confidence": round(min(95, 55 + len(months) * 3)),
        }

    def _build_achievements(self, annual, prev_annual, portfolio) -> list[dict]:
        achievements = []
        if (
            annual.best_month
            and prev_annual.best_month
            and annual.best_month.profit > prev_annual.best_month.profit
        ):
            achievements.append({
                "icon": "trophy",
                "title": f"Best month ever — {month_name[annual.best_month.month]}",
                "detail": f"€{annual.best_month.profit:,.0f} profit that month",
            })
        if annual.summary.profit_margin > 60:
            achievements.append({
                "icon": "trending-up",
                "title": "Profit margin exceeded 60%",
                "detail": f"{annual.summary.profit_margin:.0f}% margin achieved",
            })
        if (
            prev_annual.summary.total_expenses > 0
            and annual.summary.total_expenses < prev_annual.summary.total_expenses * 0.92
        ):
            drop = round(
                (1 - annual.summary.total_expenses / prev_annual.summary.total_expenses)
                * 100, 1,
            )
            achievements.append({
                "icon": "piggy-bank",
                "title": f"Expenses reduced {drop:.0f}%",
                "detail": "Cost control is working",
            })
        growth = portfolio.get("revenue_growth_yoy")
        if growth is not None and growth > 10:
            achievements.append({
                "icon": "rocket",
                "title": f"Revenue grew {growth:.0f}%",
                "detail": "Strong demand vs the previous period",
            })
        if not achievements:
            achievements.append({
                "icon": "sparkles",
                "title": "Portfolio is active",
                "detail": "Keep monitoring and acting on insights",
            })
        return achievements

    async def _build_recommended_goals(
        self, annual, prev_annual, portfolio
    ) -> list[dict]:
        from app.properties.repository import PropertyRepository

        prop_repo = PropertyRepository(self.session)
        props = await prop_repo.get_all_properties()

        rev_goals = [p.target_annual_revenue for p in props if p.target_annual_revenue]
        rev_target = (
            sum(rev_goals)
            if rev_goals
            else round(prev_annual.summary.net_revenue * 1.2, 2)
        )

        goals = []

        cleaning = next(
            (c for c in annual.expense_by_category if "clean" in c.category_name.lower()),
            None,
        )
        if cleaning:
            goals.append({
                "label": "Reduce Cleaning",
                "target": "-12%",
                "current": f"€{cleaning.total:,.0f}",
                "progress": self._clamp(88),
            })

        if rev_target > 0:
            goals.append({
                "label": "Target Revenue",
                "target": f"€{rev_target:,.0f}",
                "current": f"€{annual.summary.net_revenue:,.0f}",
                "progress": self._clamp(annual.summary.net_revenue / rev_target * 100),
            })
        return goals

    def _build_trend_explanations(self, kpi, annual) -> list[dict]:
        explanations = []

        revenue_reasons = []
        if kpi["revenue"] is not None and kpi["revenue"] > 0:
            revenue_reasons.append("Booking volume increased")
        if kpi["expenses"] is not None and kpi["expenses"] < 0:
            revenue_reasons.append(
                f"Cleaning and operating costs {abs(kpi['expenses']):.1f}% lower"
            )
        if revenue_reasons:
            explanations.append({
                "metric": "Revenue",
                "direction": "up" if (kpi["revenue"] or 0) >= 0 else "down",
                "change_pct": kpi["revenue"],
                "reasons": revenue_reasons,
            })

        expense_reasons = []
        cats = annual.expense_by_category
        if cats:
            top = max(cats, key=lambda c: c.percentage)
            expense_reasons.append(
                f"{top.category_name} is the largest category ({top.percentage:.0f}% of expenses)"
            )
        if kpi["revenue"] is not None and kpi["revenue"] > 0:
            expense_reasons.append("Higher booking activity increases variable costs")
        if expense_reasons:
            explanations.append({
                "metric": "Expenses",
                "direction": "up" if (kpi["expenses"] or 0) >= 0 else "down",
                "change_pct": kpi["expenses"],
                "reasons": expense_reasons,
            })

        profit_reasons = []
        if kpi["revenue"] is not None:
            d = "grew" if kpi["revenue"] >= 0 else "fell"
            profit_reasons.append(f"Revenue {d} {abs(kpi['revenue']):.1f}%")
        if kpi["expenses"] is not None:
            d = "rose" if kpi["expenses"] >= 0 else "fell"
            profit_reasons.append(f"Expenses {d} {abs(kpi['expenses']):.1f}%")
        if profit_reasons:
            explanations.append({
                "metric": "Profit",
                "direction": "up" if (kpi["profit"] or 0) >= 0 else "down",
                "change_pct": kpi["profit"],
                "reasons": profit_reasons,
            })

        return explanations
