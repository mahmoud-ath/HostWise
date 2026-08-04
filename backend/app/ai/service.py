"""
AI Module — Financial Advisor (Orchestrator)

Composes the HostWise built-in rules engine (`app/ai/rules.py`) with the
external LLM providers (`app/ai/providers.py`):

  * ai_provider == "hostwise"  → rules engine only.
  * ai_provider != "hostwise"  → the rules engine builds the base report, then
    the configured API (OpenAI / DeepSeek / Anthropic / Ollama) receives the
    real data as JSON and its response is merged into the report.
"""
from calendar import month_name
from datetime import date

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.ai.rules import HostWiseRulesEngine
from app.ai.providers import LLMProvider


class AIAdvisorService:
    """Orchestrates the rules engine + external LLM providers."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.rules = HostWiseRulesEngine(session)
        self.provider = LLMProvider(session)

    async def analyze_financial_performance(self) -> dict:
        """Rule-based financial analysis (HostWise built-in engine)."""
        return await self.rules.analyze_financial_performance()

    async def generate_advisor_report(
        self,
        year: int | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict:
        """Generate a comprehensive AI advisor report for the page.

        Pass a `year` for the classic yearly analysis, or `start_date`/
        `end_date` for a custom period.
        """
        base_report, llm_ctx = await self.rules.build_advisor_report(
            year, start_date, end_date
        )

        # ── External LLM: send the real data as JSON and let the API update the page ──
        from app.settings.service import SettingsService

        settings = await SettingsService(self.session).get_all()
        provider = settings.get("ai_provider", "hostwise")
        llm_enabled = (
            provider != "hostwise"
            and bool(settings.get("ai_api_key"))
            and settings.get("ai_enabled", True)
        )
        if llm_enabled:
            input_data = {
                "year": base_report.get("year"),
                "period": base_report.get("period"),
                "currency": settings.get("default_currency", "EUR"),
                "current_metrics": base_report["current_metrics"],
                "kpi_growth": llm_ctx["kpi_growth"],
                "monthly_breakdown": base_report["monthly_breakdown"],
                "expense_categories": base_report["expense_categories"],
                "property_ranking": llm_ctx["property_ranking"],
            }
            llm_report = await self.provider.advisor_report(settings, input_data)
            if llm_report:
                base_report = self.provider.merge_report(base_report, llm_report)
                base_report["provider"] = provider
            else:
                base_report["provider"] = "hostwise"
        else:
            base_report["provider"] = "hostwise"

        return base_report

    async def test_llm_connection(self) -> dict:
        """Validate the configured BYOK connection with a tiny prompt."""
        return await self.provider.test_connection()

    # ── AI Chat Assistant ──────────────────────────────────────────

    SUGGESTED_QUESTIONS = [
        "What is my least profitable property?",
        "Why did revenue decrease in June?",
        "How can I increase revenue?",
        "Which expenses should I reduce?",
        "What pricing strategy do you recommend?",
        "What does next month look like?",
    ]

    async def answer_question(self, question: str, year: int) -> dict:
        """Q&A over the advisor report. Uses the user's LLM (BYOK) when
        configured, otherwise falls back to the rule engine."""
        from app.settings.service import SettingsService

        report = await self.generate_advisor_report(year)
        m = report["current_metrics"]
        reviews = report["property_reviews"]
        q = question.strip().lower()

        def money(v: float) -> str:
            return f"€{v:,.0f}"

        # ── BYOK: use the owner's LLM when a key is configured ──
        settings = await SettingsService(self.session).get_all()
        if settings.get("ai_api_key") and settings.get("ai_enabled", True):
            try:
                system = (
                    "You are HostWise AI, a financial co-pilot for vacation rental hosts. "
                    "Answer concisely and actionably, grounded ONLY in the portfolio context "
                    "provided. If the context lacks the answer, say so briefly."
                )
                context = self.provider.build_chat_context(report)
                llm_answer = await self.provider.call(
                    settings,
                    system,
                    f"Portfolio context (year {report['year']}):\n{context}\n\nHost question: {question}",
                )
                if llm_answer and llm_answer.strip():
                    return {
                        "question": question,
                        "answer": llm_answer.strip(),
                        "intent": "llm",
                        "confidence": 0.9,
                        "suggested_questions": self.SUGGESTED_QUESTIONS,
                        "mode": "llm",
                    }
            except Exception:
                # Fall through to the deterministic rule engine.
                pass

        intent = "general"
        answer = ""
        confidence = 0.6

        # ── Least / most profitable property ──
        if ("least profit" in q or "least profitable" in q) and reviews:
            intent = "least_profitable"
            worst = min(reviews, key=lambda r: r["net_revenue"])
            answer = (
                f"Your least profitable property is {worst['property_name']} with "
                f"{money(worst['net_revenue'])} in net revenue and a {worst['profit_margin']:.0f}% "
                f"margin. {worst['suggested_action']}"
            )
            confidence = 0.85
        elif (
            "most profit" in q or "most profitable" in q or "best performer" in q
        ) and reviews:
            intent = "most_profitable"
            best = max(reviews, key=lambda r: r["net_revenue"])
            answer = (
                f"Your best performer is {best['property_name']} with "
                f"{money(best['net_revenue'])} in net revenue and a {best['profit_margin']:.0f}% margin. "
                f"{best['ai_summary']}"
            )
            confidence = 0.85
        # ── Why did revenue change ──
        elif "why" in q and ("revenue" in q or "income" in q):
            intent = "revenue_explanation"
            month_idx = next(
                (i for name, i in [
                    (month_name[x].lower(), x) for x in range(1, 13)
                ] if name in q),
                None,
            )
            breakdown = report["monthly_breakdown"]
            if month_idx and breakdown:
                target = next((b for b in breakdown if b["month"] == month_idx), None)
                prev = next((b for b in breakdown if b["month"] == month_idx - 1), None)
                if target and target["net_revenue"] > 0:
                    if prev and prev["net_revenue"] > 0:
                        diff = target["net_revenue"] - prev["net_revenue"]
                        dir_word = "increased" if diff >= 0 else "decreased"
                        answer = (
                            f"In {month_name[month_idx]}, revenue {dir_word} by "
                            f"{money(abs(diff))} compared to {month_name[month_idx - 1]} "
                            f"({money(target['net_revenue'])} vs {money(prev['net_revenue'])}). "
                        )
                    else:
                        answer = f"In {month_name[month_idx]}, revenue was {money(target['net_revenue'])}."
                    if report["trend_explanations"]:
                        exp = report["trend_explanations"][0]
                        answer += " The main drivers: " + "; ".join(exp["reasons"]) + "."
                else:
                    answer = f"There was no recorded revenue in {month_name[month_idx]}."
            else:
                exp = report["trend_explanations"][0] if report["trend_explanations"] else None
                if exp:
                    dir_word = "increased" if (exp["change_pct"] or 0) >= 0 else "decreased"
                    answer = (
                        f"Revenue {dir_word} {abs(exp['change_pct'] or 0):.1f}% year-over-year. "
                        "The main drivers: " + "; ".join(exp["reasons"]) + "."
                    )
                else:
                    answer = "I don't have enough history yet to explain the revenue trend."
            confidence = 0.8
        # ── Occupancy no longer tracked ──
        elif "occupancy" in q:
            intent = "revenue"
            answer = (
                "I no longer track occupancy as a headline metric. To grow revenue, focus "
                "on: 1) weekend pricing, 2) minimum-stay settings to close gaps, "
                "3) dynamic pricing around demand, and 4) cutting the largest expense "
                f"categories. Your net revenue is {money(m['net_revenue'])}."
            )
            confidence = 0.7
        # ── Increase revenue / performance ──
        elif any(w in q for w in ["increase revenue", "more revenue", "grow", "improve performance"]):
            intent = "revenue"
            opp = report["opportunities"]
            answer = (
                f"Your net revenue is {money(m['net_revenue'])}. The biggest levers are: "
                "1) Raise weekend pricing, 2) Adjust minimum stay to close gaps, "
                "3) Enable dynamic pricing around demand peaks, and 4) review your largest "
                "expense categories to protect margin. "
                f"I estimate about {money(opp['potential_revenue'])} of upside is available "
                f"({opp['confidence']}% confidence)."
            )
            confidence = 0.8
        # ── Reduce expenses ──
        elif ("expense" in q or "cost" in q) and any(
            w in q for w in ["reduce", "cut", "lower", "which", "save", "spend"]
        ):
            intent = "expenses"
            cats = report["expense_categories"]
            if cats:
                top = cats[0]
                answer = (
                    f"Your largest expense category is {top['category_name']} at "
                    f"{money(top['total'])} ({top['percentage']:.0f}% of expenses). "
                    f"Start there: re-negotiate contracts, compare suppliers, and review "
                    "recurring charges. Reducing it by 15% would save "
                    f"{money(top['total'] * 0.15)} a year."
                )
            else:
                answer = "No expense categories recorded yet — import your expenses to get advice here."
            confidence = 0.8
        # ── Pricing strategy ──
        elif "pricing" in q or ("price" in q and "strateg" in q):
            intent = "pricing"
            answer = (
                f"Your profit margin is {m['profit_margin']:.0f}% on {money(m['net_revenue'])} "
                "net revenue. I'd recommend: 1) Raise weekend rates 8-12% (weekend demand is "
                "less price-sensitive), 2) Test a 3-night minimum on high-demand weeks, "
                "3) Set a floor price on shoulder-season weekdays, "
                "4) Consider dynamic pricing ahead of local events, and 5) renegotiate your "
                "largest expense categories to protect margin."
            )
            confidence = 0.78
        # ── Forecast ──
        elif any(w in q for w in ["forecast", "predict", "next month", "future", "expect"]):
            intent = "forecast"
            f = report["forecast"]
            answer = (
                f"For the next 30 days I expect about {money(f['expected_revenue'])} in revenue "
                f"(risk level: {f['risk_level']}). "
                f"Best property: {f['best_property'] or '—'}."
            )
            confidence = 0.75
        # ── Best / worst property ──
        elif ("best" in q and "property" in q) and reviews:
            intent = "best_property"
            best = max(reviews, key=lambda r: r["net_revenue"])
            answer = (
                f"{best['property_name']} is your top property: "
                f"{money(best['net_revenue'])} revenue and {best['profit_margin']:.0f}% margin. "
                f"{best['ai_summary']}"
            )
            confidence = 0.85
        elif ("worst" in q and "property" in q) and reviews:
            intent = "worst_property"
            worst = min(reviews, key=lambda r: r["net_revenue"])
            answer = (
                f"{worst['property_name']} needs the most attention: "
                f"{money(worst['net_revenue'])} revenue at a {worst['profit_margin']:.0f}% margin. "
                f"{worst['suggested_action']}"
            )
            confidence = 0.85
        # ── Health / how am I doing ──
        elif any(w in q for w in ["health", "score", "how am i doing", "doing well", "healthy"]):
            intent = "health"
            h = report["health_score"]
            answer = (
                f"Your business health score is {h['score']:.0f}/100 ({h['status']}). "
                f"Revenue {h['components']['revenue']:.0f}/100, expenses "
                f"{h['components']['expenses']:.0f}/100, growth {h['components']['growth']:.0f}/100, "
                f"risk {h['components']['risk']:.0f}/100."
            )
            confidence = 0.8
        # ── Risk ──
        elif "risk" in q or "risky" in q or "danger" in q:
            intent = "risk"
            risks = report["risks"]
            if risks:
                top_risk = risks[0]
                answer = (
                    f"The highest risk is {top_risk['property_name']}"
                    + (
                        f" with a {top_risk['revenue_trend_pct']:.0f}% revenue trend."
                        if top_risk.get("revenue_trend_pct") is not None else "."
                    )
                    + f" Recommendation: {top_risk['recommendation']}"
                )
            else:
                answer = "No high-risk properties detected right now. Watch revenue trends and cancellation rates."
            confidence = 0.78
        # ── Cleaning / maintenance ──
        elif "clean" in q or "maintenance" in q:
            intent = "cleaning"
            cats = report["expense_categories"]
            cat = next((c for c in cats if "clean" in c["category_name"].lower()), None)
            if cat:
                answer = (
                    f"Cleaning is {money(cat['total'])} — {cat['percentage']:.0f}% of total "
                    "expenses. To reduce it: batch turnovers, negotiate volume rates with your "
                    "cleaner, and consider multi-night minimums that cut turnover frequency."
                )
            else:
                answer = "No cleaning category recorded yet."
            confidence = 0.75
        # ── Compare properties ──
        elif "compare" in q and "property" in q and reviews:
            intent = "compare"
            lines = []
            for r in reviews[:3]:
                lines.append(
                    f"{r['property_name']}: {money(r['net_revenue'])} revenue, "
                    f"{r['profit_margin']:.0f}% margin"
                )
            answer = "Here's how your top properties compare:\n" + "\n".join(lines)
            confidence = 0.8
        # ── Goals ──
        elif "goal" in q or "target" in q:
            intent = "goals"
            goals = report["recommended_goals"]
            answer = "Suggested goals for you:\n" + "\n".join(
                f"- Reach {g['target']} {g['label']} (currently {g['current']})"
                for g in goals
            )
            confidence = 0.7
        # ── Help / capabilities ──
        elif any(w in q for w in ["help", "what can you", "what do you do", "capabilities"]):
            intent = "help"
            answer = (
                "I can analyze your portfolio and answer questions like: "
                + ", ".join(self.SUGGESTED_QUESTIONS[:5])
                + "."
            )
            confidence = 0.95
        elif any(w in q for w in ["thank", "thanks", "great", "cool", "awesome"]):
            intent = "thanks"
            answer = "You're welcome! Ask me anything about your portfolio whenever you need."
            confidence = 0.9
        # ── Fallback ──
        else:
            answer = (
                f"{report['executive_summary']} "
            )
            if report["priority_actions"]["critical"]:
                top = report["priority_actions"]["critical"][0]
                answer += f"Top priority: {top['title']}. {top['suggested_action']}"
            elif report["priority_actions"]["medium"]:
                top = report["priority_actions"]["medium"][0]
                answer += f"Worth a look: {top['title']}. {top['suggested_action']}"
            else:
                answer += "No urgent actions — the portfolio is on track."
            confidence = 0.7

        return {
            "question": question,
            "answer": answer,
            "intent": intent,
            "confidence": confidence,
            "suggested_questions": self.SUGGESTED_QUESTIONS,
            "mode": "rules",
        }

    # ── Scenario Simulator ────────────────────────────────────────

    async def simulate_scenario(
        self, scenario: str, params: dict | None, year: int
    ) -> dict:
        """Estimate the financial impact of a 'what-if' scenario."""
        from app.analytics.service import AnalyticsService
        from app.finance.service import FinancialReportingService

        analytics = AnalyticsService(self.session)
        finance = FinancialReportingService(self.session)
        annual = await finance.get_annual_report(year)
        portfolio = await analytics.get_portfolio_analytics(year)
        params = params or {}

        base_rev = annual.summary.net_revenue
        base_exp = annual.summary.total_expenses
        base_profit = annual.summary.profit

        rev_delta = 0.0
        exp_delta = 0.0
        label = scenario

        if scenario == "price_increase":
            pct = float(params.get("pct", 10))
            rev_delta = round(base_rev * pct / 100, 2)
            label = f"Increase prices {pct:.0f}%"
        elif scenario == "hire_cleaner":
            cost = float(params.get("cost", 300))
            exp_delta = round(cost * 12, 2)
            gain_pct = float(params.get("revenue_gain_pct", 3))
            rev_delta = round(base_rev * gain_pct / 100, 2)
            label = "Hire additional cleaner"
        elif scenario == "expense_reduction":
            pct = float(params.get("pct", 10))
            exp_delta = -round(base_exp * pct / 100, 2)
            label = f"Reduce expenses {pct:.0f}%"
        elif scenario == "minimum_stay":
            # Fewer turnovers → lower cleaning costs; stronger weekend yield.
            exp_delta = -round(base_exp * 0.05, 2)
            rev_delta = round(base_rev * 0.03, 2)
            label = "Increase minimum stay"
        else:
            label = scenario
            raise ValueError(f"Unknown scenario: {scenario}")

        profit_delta = round(rev_delta - exp_delta, 2)

        return {
            "scenario": scenario,
            "label": label,
            "baseline": {
                "revenue": base_rev,
                "expenses": base_exp,
                "profit": base_profit,
            },
            "impact": {
                "revenue_delta": round(rev_delta, 2),
                "expenses_delta": round(exp_delta, 2),
                "profit_delta": profit_delta,
            },
            "projected": {
                "revenue": round(base_rev + rev_delta, 2),
                "expenses": round(base_exp + exp_delta, 2),
                "profit": round(base_profit + profit_delta, 2),
            },
            "confidence": 85.0,
        }


async def get_ai_advisor_service(
    session: AsyncSession = Depends(get_db),
) -> AIAdvisorService:
    return AIAdvisorService(session)
