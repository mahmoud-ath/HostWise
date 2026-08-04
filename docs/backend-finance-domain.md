# Backend — Finance Domain (`app/finance/`)

## Purpose

The Finance domain is the **source of truth for money**. It owns revenue and
expense records, their categories, and — critically — the **aggregation layer**
that turns raw rows into the KPIs every other domain consumes
(`FinancialSummary`, `MonthlyReport`, `AnnualReport`, `CategoryBreakdown`,
`PropertyFinancialSummary`).

It exists because the entire product is built on accurate, attributable
financial records; the Dashboard, Analytics, AI, and Reports all read this
domain's output.

## Architecture

```
finance/
  models.py           # Revenue, Expense (+ enums RevenueSource, PaymentMethod)
  category_models.py  # RevenueCategory, ExpenseCategory
  schemas.py          # request/response DTOs + report schemas
  repository.py       # RevenueRepository, ExpenseRepository (aggregation SQL)
  service.py          # RevenueService, ExpenseService, FinancialReportingService
  router.py           # /finance/* endpoints
```

## Services

| Service | Responsibility |
| --- | --- |
| `RevenueService` | Create/list/get/update revenue. **Auto-computes `net_amount = gross − commission`.** |
| `ExpenseService` | Create/list/get expense records. |
| `FinancialReportingService` | The analytics engine: `get_summary`, `get_monthly_report`, `get_annual_report`. All KPI math lives here. |

### `FinancialReportingService` — the heart

- **`get_summary(start, end)`** → gross/net revenue, total expenses, cashflow,
  profit, profit margin, property count, avg revenue per property. This powers
  the Dashboard and the top of every report.
- **`get_monthly_report(year, month)`** → month summary + full-year monthly
  trend + category and property breakdowns.
- **`get_annual_report(year)`** → 12-month breakdown, best/worst month,
  **year-over-year growth** (vs previous year), category + property breakdowns.
  This is the backbone of Reports and AI.

## Repositories

- `RevenueRepository` / `ExpenseRepository` extend `BaseRepository` and add the
  **aggregation queries** that make the analytics layer cheap and correct:
  - `get_total_revenue`, `get_monthly_revenue`
  - `get_revenue_by_category`, `get_revenue_by_property`
  - `get_total_expenses`, `get_monthly_expenses`
  - `get_expenses_by_category`, `get_expenses_by_property`
- These use **SQL-side aggregation** (GROUP BY / SUM) rather than loading rows
  into Python — the performance decision that keeps on-demand computation fast.

## Schemas / Validation

- Pydantic v2 request/response DTOs.
- `FinancialSummary`, `MonthlyBreakdown`, `CategoryBreakdown`,
  `PropertyFinancialSummary`, `MonthlyReport`, `AnnualReport` — the contract
  types shared with reports/AI.
- `RevenueCreateRequest` enforces non-negative amounts; net is always computed
  server-side (business rule, not client).

## Error handling

- `NotFoundException` (404) for missing revenue/expense; standard
  `AppException` hierarchy maps to HTTP codes; the global handler in `main.py`
  converts them.

## Business rules (encoded where?)

| Rule | Where |
| --- | --- |
| net = gross − commission | `RevenueService.create/update` |
| margin = profit/net, 0 if no revenue | `FinancialReportingService.get_summary` |
| YoY growth only when previous year > 0 | `get_annual_report` |
| property margin 0 when no net revenue | `get_monthly_report` / `get_annual_report` |
| soft-deleted rows excluded | repository base queries |

## Why the domain is separated

Money is the product's foundation; separating it keeps aggregation logic in one
place and lets other domains depend on it **by service, not by reaching into
its tables**. Finance has no knowledge of AI or Reports — it just publishes
accurate numbers.

## How it communicates with other domains

- **Properties:** joins to `Property` for per-property aggregation.
- **Analytics/AI/Reports:** construct `FinancialReportingService` and call its
  methods (composition in services, not routers).
- **Settings:** reports read default currency/tax rate when composing tax
  summaries.

## Strengths

- SQL-side aggregation = fast on-demand metrics.
- Net-revenue auto-computation prevents inconsistent data.
- Rich report DTOs reused across three other domains.

## Weaknesses / Debt

- Annual/monthly report methods duplicate property-merging logic (revenue +
  expense per property merged in both).
- No edit/delete UI (API supports it, frontend doesn't).
- Categories exist but no management API/UI; uncategorized rows weaken expense
  analysis.
- No multi-currency conversion (single display currency from settings).

## Future evolution

- Extract a shared "property financial merge" helper.
- Category management API.
- Recurring-expense recognition; payout reconciliation.
- Currency conversion layer; per-property target-based variance reporting.
