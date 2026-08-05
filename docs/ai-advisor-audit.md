# AI Advisor Audit (`/ai-advisor`)

## Purpose

> **v2 update:** The page is organized into **tabs** — Analytics,
> Recommendations, and Simulator (the Chat tab was removed; the backend
> `/ai/chat` endpoint is left in place but unused by the UI). The advisor is
> **period-aware** (year or custom date range). Occupancy references were removed
> from all advisor sections (risks flag on revenue trend / margin / health; the
> simulator’s allowed scenarios are `price_increase`, `hire_cleaner`,
> `expense_reduction`, `minimum_stay`). It follows the **rules-vs-LLM** strategy:
> the built-in rules engine by default; when `ai_api_key` + provider are
> configured it sends the real data to your LLM (DeepSeek/OpenAI/etc.) and
> conservatively merges its executive summary + health score.

The AI Advisor page is the **financial co-pilot** — the flagship differentiator
of HostWise. It exists so a host can move from *"I see the numbers"* to *"I
know what to do."* Where Reports documents performance, the Advisor *reasons*
about it: it prioritizes actions, quantifies opportunities and lost revenue,
flags risks per property, explains trends, forecasts the next 30 days, answers
questions in natural language, and lets the host simulate "what if" scenarios.

The intended user is the **owner/operator** who wants actionable guidance, not
just dashboards.

## Business Objective

After visiting, the user should be able to decide:
- **What to fix first** (Priority Action Center: critical/medium/low).
- **Where the upside is** (Opportunities + lost revenue).
- **Which property is at risk** and why.
- **What next month looks like** (forecast).
- **Whether a price change / hiring a cleaner is worth it** (scenario
  simulator).

## Workflow

```mermaid
sequenceDiagram
    participant U as Host
    participant A as AI Advisor page
    participant Q as React Query
    participant API as FastAPI
    participant AI as AIAdvisorService
    participant F as Finance / Analytics / Properties

    U->>A: opens /ai-advisor
    A->>Q: useAIAdvisor(period)
    Q->>API: GET /ai/advisor?year | start_date&end_date
    API->>AI: generate_advisor_report(year | start,end)
    AI->>F: analyze_financial_performance + portfolio analytics + annual report
    F-->>AI: metrics + recommendations
    AI-->>API: AdvisorReport (health, priorities, opportunities, risks, reviews, forecast, goals, trends, wins)
    API-->>Q: JSON
    Q-->>A: render sections (analytics / recommendations / simulator tabs)
    U->>A: run a scenario (e.g., price +10%)
    A->>API: POST /ai/scenario { scenario, params, year }
    API->>AI: simulate_scenario
    AI-->>A: baseline → impact → projected
```

## Components

| Component | Responsibility |
| --- | --- |
| `AIHeader` | Title + period selector (year or custom range) + provider badge (rules vs LLM) |
| `ExecutiveAISummary` | Narrative summary + current metrics |
| `BusinessHealthScore` | 0–100 ring + component bars (revenue/expenses/growth/risk) |
| `PriorityActions` | Grouped critical/medium/low actions with confidence |
| `Opportunities` | Potential revenue + actions; lost-revenue card |
| `RiskDetection` | Per-property high/medium risk cards |
| `PropertyReviews` | Per-property AI summary, strengths/weaknesses, suggested action |
| `ForecastNext30` | Expected revenue/occupancy/risk/best property |
| `TrendExplanations` | "Why it happened" reasons per KPI |
| `RecommendedGoals` | Occupancy/ADR/cleaning/revenue targets with progress |
| `ScenarioSimulator` | What-if controls + baseline/impact/projected comparison |
| `Achievements` | Wins (best month, margin, expense reduction) |

## Hooks

- `useAIAdvisor(period)` — one query for the whole dashboard (accepts a `ReportPeriod`
  of `{year}` or `{start,end}`).
- `useAIScenario()` — mutation (`POST /ai/scenario`).
- `useAIChat()` — mutation (`POST /ai/chat`); no longer called by the UI (chat removed).

## API Calls

| Endpoint | Why |
| --- | --- |
| `GET /ai/advisor?year \| start_date&end_date` | Composed advisor dashboard (the page's single source of truth; rules engine by default, LLM when configured). |
| `POST /ai/scenario` | What-if financial simulation. |
| `POST /ai/chat` | Interactive Q&A over the same data (rule-based intent engine) — kept in the API but unused by the UI. |

## State Management

- Server state: React Query for the dashboard; mutations for scenario (and chat, unused by UI).
- Local state: scenario inputs.

## User Journey

```
Open /ai-advisor
  ↓
Executive summary + business health score
  ↓
Priority actions (what to fix first)
  ↓
Opportunities + money left on the table
  ↓
Risk detection per property
  ↓
Property AI reviews
  ↓
Next 30 days forecast
  ↓
Simulate: "Increase prices 10%?" → see projected profit
  ↓
Decision: adopt the scenario with the best projected outcome
```

## Relation With Other Pages

- **Dashboard:** shows a condensed slice of the advisor's recommendations.
- **Reports:** AI Insights in reports reuse the same `AIAdvisorService` — the
  Advisor is the "live/interactive" form, Reports is the "documented" form.
- **Analytics:** the advisor reasons over the same operating KPIs.
- **Finance/Properties:** recommendations map to concrete records (expenses to
  cut, properties to promote).
- **Settings:** `ai_*` settings (enabled, level, language) are the knobs for
  this page.

## Architectural Decisions

- **Rule-based engine with an LLM-ready interface** — deterministic, private,
  offline, and swappable (see Decision Log #5).
- **Structured outputs** (`cause/impact/action/confidence`) — the UI renders
  them consistently and an LLM can fill the same shape later.
- **One dashboard endpoint** — composition on the backend.
- **Chat & scenario as separate POST endpoints** — interactive, stateful
  requests isolated from the read dashboard (chat endpoint retained, UI tab removed).
- **Reuses the same aggregation services as Reports** — consistency between
  what the advisor says and what the report shows.

## Strengths

- Differentiating product surface (scenarios + priorities are not "just charts").
- Explainable, deterministic AI (confidence scores, "why it happened").
- The LLM seam means the flagship feature can be upgraded without a rewrite.

## Weaknesses

- Rule engine is narrow — answers are only as good as the intents that exist.
- Chat recomputes the **entire advisor report per question** (expensive on
  large portfolios).
- (Fixed) AI prose currency is driven by `default_currency` via a `CURRENCY_SYMBOL`
  map — no longer hardcoded €.

## Technical Debt

- Nested recomputation (analyze → portfolio → per-property health → per-property
  analytics).
- No caching of advisor results; chat latency scales with data size.
- Chat state is lost on navigation (acceptable for MVP, could persist later).

## Future Evolution

- Swap/add LLM providers (OpenAI/Claude/Ollama) behind the same interface;
  keep rules as the offline fallback.
- Cheap per-intent data path + caching for chat.
- Persistent conversation history; "ask about a specific property".
- Scenario sensitivity analysis (multi-parameter what-if).
- ~~Honor `ai_analysis_level` and `ai_language`~~ — ✅ Done (v4): `ai_analysis_level` trims report depth; `ai_language` steers the BYOK LLM and is surfaced on the report; `ai_api_key` is masked in public reads with a safe round-trip + clear button; LLM replies parse strictly with guaranteed rules fallback.
