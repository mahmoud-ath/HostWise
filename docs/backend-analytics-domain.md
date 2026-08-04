# Backend — Analytics Domain (`app/analytics/`)

## Purpose

The Analytics domain is the **operational intelligence engine**. It computes
the profit-focused KPIs a host cares about — **gross/net revenue, profit and
margin, expense ratio, cancellation rate, booking window, seasonality** — plus
a **Property Health Score (0–100)**.

> **v2 update:** **Occupancy, ADR, and RevPAR were removed** (HostWise is an
> analytics layer, not a PMS, and it does not own nightly availability data). The
> property and portfolio analytics returns no longer include those keys; the
> health score is driven by profit margin, cancellation rate, expense ratio, and
> revenue vs `target_annual_revenue`.

It exists because revenue/profit/health are the levers a host actually
controls, and these metrics are *derived from financials + reservations*, not
stored. The intended consumer is the Analytics page, plus the AI and Reports
domains that reason over the same numbers.

## Architecture

```
analytics/
  service.py   # AnalyticsService
  router.py    # /analytics/*
```

## Services

`AnalyticsService` provides three capabilities:

### `get_property_analytics(property_id, year)`
Per-property deep-dive: revenue, profit/margin, **occupancy** (nights /
available nights), **ADR** (avg revenue per night), **RevPAR**, cancellation
rate, booking window, monthly breakdown, expense ratio.

### `get_portfolio_analytics(year)`
Portfolio-wide aggregation:
- Operating KPIs (occupancy, ADR, RevPAR, cancellation, avg stay).
- **Property ranking** — each property enriched with `health_score`,
  `occupancy_rate`, `profit_margin` (this feeds the Analytics comparison table
  and the AI's property reviews).
- **Seasonality** — monthly revenue/counts.
- **Expense/revenue categories** and **health distribution**.
- **Forecast** — `forecast_next_month` (simple trailing average).

### `get_property_health_score(property_id)`
A 0–100 score from: **occupancy vs target** (`target_occupancy`), **profit
margin**, **cancellation rate**, and **expense ratio**, with a
healthy/average/concerning/critical status. This is the property "triage"
signal used everywhere (Properties page badges, AI risk detection, Reports
health).

## Business rules (the health formula)

```
score = 50 (baseline)
+ up to 20  (occupancy vs target occupancy)
+ 15 / 8 / −20 (profit margin > 30% / >15% / <0)
+ 10 / −10 (cancellation <5% / >20%)
+ 10 / −10 (expense ratio <30% / >60%)
clamped 0–100
```

Why baseline-50? So a neutral property is "average" and data-driven evidence
moves it — a deliberately conservative scoring model.

## Communication with other domains

- Reads **finance** repositories (revenue/expense totals, categories) and
  **reservations** repository (nights, cancellations, booking windows).
- **AI** calls `get_portfolio_analytics` + `get_property_health_score` to build
  recommendations, reviews, and risk detection.
- **Reports** calls `get_portfolio_analytics` for property ranking, occupancy,
  and health.
- **Properties** page calls `get_property_health_score` per card.

## Strengths

- **Computed Intelligence on Demand** — always fresh, never stale.
- Health score is explainable (each component contributes transparently).
- Provider-agnostic because it reads normalized reservations.

## Weaknesses / Debt

- **Nested recomputation:** `get_portfolio_analytics` calls
  `get_property_health_score` per property, which calls
  `get_property_analytics` per property → N+1 on-demand recomputation. Fine at
  small scale, slow at scale.
- Occupancy uses `365` days/year regardless of leap years or listing-level
  availability (an approximation).
- ADR/RevPAR monthly series aren't returned (the Analytics page fakes them).

## Future evolution

- Cache per-property analytics for the duration of a request batch (or a short
  TTL).
- Return monthly ADR/RevPAR series to replace the fake frontend data.
- Account for real availability (blocked nights) per listing.
- Add year-over-year occupancy/margin comparisons.
