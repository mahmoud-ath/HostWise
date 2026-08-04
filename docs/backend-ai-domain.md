# Backend — AI Domain (`app/ai/`)

## Purpose

The AI domain is the **financial co-pilot**. It converts raw financial and
operational data into *structured, actionable guidance*: recommendations,
business health, priorities, opportunities, lost revenue, property reviews,
30-day forecasts, trend explanations, natural-language chat answers, and
what-if scenario projections.

> **v2 update:** Chat now supports **BYOK** — when the user configures
> `ai_api_key`/`ai_base_url`/`ai_model` in settings, `answer_question` proxies the
> question (with a compact portfolio context) to an OpenAI-compatible or Ollama
> endpoint via httpx and returns `mode: "llm"`; otherwise the rules engine answers
> (`mode: "rules"`). `POST /ai/test-connection` validates the configuration.
> Occupancy/ADR/RevPAR were removed from all advisor output (health, priorities,
> opportunities, lost-revenue, risks, property reviews, forecast, goals,
> scenarios); the scenario allowlist is `price_increase`, `hire_cleaner`,
> `expense_reduction`, `minimum_stay`.

It exists because the product's differentiation is **advice, not charts**. The
domain is **rule-based by default with a BYOK LLM proxy** (see Decision Log #0.4).

## Architecture

```
ai/
  service.py   # AIAdvisorService (the whole engine)
  router.py    # /ai/*
```

## The four capabilities

### 1. `analyze_financial_performance()` — classic analysis
Rule engine over portfolio analytics + summary:
- Profit-margin analysis (negative / low / healthy).
- Revenue-growth analysis (YoY via portfolio analytics).
- High-expense-category detection (percentage thresholds).
- Property-ranking gap detection (top vs bottom multiple).
- Produces **structured recommendations**:
  `{type: critical|warning|positive, title, cause, business_impact,
  suggested_action, expected_improvement, confidence_score}` plus a
  natural-language `executive_summary`.

### 2. `generate_advisor_report(year)` — the Advisor page dashboard
Composes: executive summary, current metrics, **business health score** with
component bars (revenue/expenses/growth/risk), **priority actions**
(critical/medium/low), **opportunities** (potential revenue + actions),
**lost revenue** (reasons with amounts), **per-property risks**,
**property AI reviews** (strengths/weaknesses/suggested action),
**30-day forecast**, **trend explanations** ("why it happened"),
**recommended goals**, **achievements** (wins), monthly breakdown, expense
categories.

### 3. `answer_question(question, year)` — chat
A rule-based intent router over the advisor report:
- intents: least/most profitable, revenue-change explanation (optional month),
  improve occupancy, reduce expenses, pricing strategy, forecast, best/worst
  property, health, risk, cleaning, compare, goals, help, thanks, fallback.
- Returns `{question, answer, intent, confidence, suggested_questions}` —
  a shape an LLM can fill identically later.

### 4. `simulate_scenario(scenario, params, year)` — what-if simulator
Estimates impact of: `price_increase` (price-elasticity model:
occupancy −0.4 × price%), `hire_cleaner`, `occupancy_increase`,
`expense_reduction`, `minimum_stay`.
Returns `baseline → impact → projected` with confidence.

## Business rules (examples)

- Health components: revenue/growth scores scale with YoY growth; risk score
  decreases with critical/warning counts.
- Opportunity gains: low-occupancy unbooked nights × ADR; weekend pricing,
  minimum-stay, and dynamic-pricing as % of gross.
- Lost revenue: low-occupancy gap × ADR + weekend discount + cancellation
  losses.
- Property risk: occupancy < 40% or revenue trend < −10% → flagged.
- Property review: strengths/weaknesses from margin, occupancy, health,
  expense ratio; suggested action mapped from the weakest area.

## Communication with other domains

- Constructs `FinancialReportingService` (annual reports, summary),
  `AnalyticsService` (portfolio analytics, health scores), and
  `PropertyRepository` (targets/goals).
- **Reports** domain constructs `AIAdvisorService` to embed AI insights into
  the portfolio report.
- **Settings** could drive behavior (ai_enabled/level/language) — stored but
  not yet consumed (a gap).

## Strengths

- Deterministic, offline, private, explainable, and cheap.
- The interface is the **LLM seam** — rules can be swapped for OpenAI/Claude/
  Ollama without changing callers.
- Structured outputs make the UI rendering trivial and consistent.
- Same aggregation services as Reports → the advisor and the report agree.

## Weaknesses / Debt

- **Expensive:** `analyze_financial_performance` triggers portfolio analytics →
  per-property health → per-property analytics (nested recomputation); chat
  recomputes the entire advisor report per question.
- Rule engine is narrow — coverage limited to defined intents/thresholds.
- Hardcoded € in generated strings (not settings-driven).
- No caching; latency scales with data size.

## Future evolution

- LLM providers behind the same interface with rules as offline fallback.
- Cheap per-intent data path + caching; request-scoped analytics reuse.
- Persistent chat history; property-scoped questions.
- Sensitivity analysis for scenarios; multi-parameter what-if.
- Honor `ai_analysis_level`, `ai_language`, `ai_enabled` settings.
