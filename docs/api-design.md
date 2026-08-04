# HostWise — API Design

## 1. API Philosophy

- **REST over `/api/v1`**, JSON, versioned from day one.
- **One aggregated endpoint per page** where possible (e.g.
  `/reports/portfolio`, `/ai/advisor`) — the backend owns composition so the
  frontend stays a thin presentation layer.
- **DTOs via Pydantic `response_model`** — the OpenAPI schema is the contract.
- **Computed on demand** — no stored metrics; endpoints return live numbers.
- **Thin routers, rich services** — routers map HTTP; services hold logic.
- **Auth-free:** since v2 the app is a local, single-user product — there are
  no login/register endpoints in use, no bearer tokens required, and no
  `get_current_user` dependency anywhere. Identity is just `profile_name` /
  `profile_email` stored as settings (see `/api/v1/setup/initialize`).
- **BYOK AI:** the AI advisor works as a rules engine out of the box, and can
  optionally call a user-provided LLM (OpenAI/Anthropic-compatible or Ollama)
  configured through settings (`ai_api_key`, `ai_base_url`, `ai_model`).
- **Errors:** consistent `{ "detail": ... }` with a shared exception hierarchy.

## 2. Endpoint Inventory

Legend — `🔒` = requires auth (Bearer). `P` = consumer page.

### Auth — `/api/v1/auth`
> **Retired in v2.** The router still exists for backwards compatibility but the
> UI no longer uses it. There is no login screen and no default credentials.
> The product is intentionally local-first and single-user.

### Setup — `/api/v1/setup`
| Method & Path | Purpose | Consumer | Notes |
| --- | --- | --- | --- |
| `POST /initialize` | First-run onboarding: store `profile_name` / `profile_email` | Welcome wizard | No auth; empty body is valid |

### Properties — `/api/v1/properties`
| Method & Path | Purpose | Consumer | Notes |
| --- | --- | --- | --- |
| `POST ""` | Create property (incl. `target_annual_revenue`) | /properties | |
| `GET ""` | List (returns detail w/ listings) | /properties | |
| `GET /{id}` | Property detail | /properties | |
| `PATCH /{id}` | Update property | /properties (edit modal) | |
| `DELETE /{id}` | Delete property (soft delete) | /properties | |
| `POST /{id}/listings` | Add platform listing | (no UI) | |
| `GET /{id}/listings` | List listings | (no UI) | |

### Finance — `/api/v1/finance`
| Method & Path | Purpose | Consumer | Notes |
| --- | --- | --- | --- |
| `POST /revenue` | Record income (auto net) | /finance | Business rule: net = gross − commission |
| `GET /revenue` | List revenue (filters) | /finance | |
| `GET /revenue/{id}` | Single revenue | (no UI) | |
| `PATCH /revenue/{id}` | Update (recomputes net) | /finance (edit) | |
| `DELETE /revenue/{id}` | Soft-delete revenue | /finance (delete) | |
| `POST /expense` | Record expense | /finance | |
| `GET /expense` | List expenses | /finance | |
| `GET /expense/{id}` | Single expense | (no UI) | |
| `PATCH /expense/{id}` | Update expense | /finance (edit) | |
| `DELETE /expense/{id}` | Soft-delete expense | /finance (delete) | |
| `GET /summary` | Portfolio financial summary | Dashboard, /finance | The "how are we doing" answer |
| `GET /report/monthly?year&month` | Monthly report (summary + trend + categories) | Reports (legacy) | |
| `GET /report/annual?year` | Annual report (YoY, best/worst month) | Dashboard, Reports (legacy) | |

### Analytics — `/api/v1/analytics`
| Method & Path | Purpose | Consumer | Notes |
| --- | --- | --- | --- |
| `GET /property/{id}?year` | Per-property deep-dive | /properties modal, /analytics | **No** occupancy/ADR/RevPAR — profit-focused |
| `GET /portfolio?year` | Portfolio KPIs + ranking + seasonality | /analytics, AI, Reports | Computed on demand |
| `GET /property/{id}/health` | Health score (0–100) | /properties cards | Profit-margin/cancellation/expense-driven |

### AI — `/api/v1/ai`
| Method & Path | Purpose | Consumer | Notes |
| --- | --- | --- | --- |
| `GET /analyze` | Recommendations + executive summary | Dashboard | Structured `{cause, impact, action, confidence}` |
| `GET /advisor?year` | Full advisor dashboard | /ai-advisor (Analytics tab) | One endpoint per page |
| `POST /chat` | Natural-language Q&A | /ai-advisor chat | Rules engine, or BYOK LLM when `ai_api_key` set |
| `POST /scenario` | What-if simulation | /ai-advisor simulator | Allowlist: `price_increase`, `hire_cleaner`, `expense_reduction`, `minimum_stay` |
| `POST /test-connection` | Validate BYOK LLM settings | /settings AI section | Returns `{ok, message}` |

### Reports — `/api/v1/reports`
| Method & Path | Purpose | Consumer | Notes |
| --- | --- | --- | --- |
| `GET /weekly` | Weekly summary | (legacy) | |
| `GET /monthly?year&month` | Monthly report + AI recs | (legacy) | |
| `GET /annual?year` | Annual report + AI recs | (legacy) | |
| `GET /executive` | Investor executive summary | (legacy) | |
| `GET /portfolio?year&currency` | **Flagship** — 13-section report | /reports | Currency defaults from settings; includes tax rate/liability |

### Connectors — `/api/v1/connectors`
| Method & Path | Purpose | Consumer | Notes |
| --- | --- | --- | --- |
| `GET /guide` | Expected columns per import type | /import | Drives the in-page guide |
| `GET /available` | List connectors | /import | `ConnectorRegistry` seam |
| `POST /csv/upload` | Save CSV **or JSON** + preview | /import | Returns `format` + columns + first 5 rows |
| `POST /csv/import` | Detect type + insert normalized rows | /import | `ConnectorService` layer; honors `import_date_format` + `default_currency` |

### Backups — `/api/v1/backups`
| Method & Path | Purpose | Consumer | Notes |
| --- | --- | --- | --- |
| `GET /` | List backups | /settings | |
| `GET /status` | Schedule overview (last/next, size, retention) | /settings | |
| `POST /create` | On-demand backup | /settings | file copy + VACUUM |
| `GET /download/{name}` | Download backup file | /settings | |
| `POST /upload` | Restore from a `.db` file | /settings | Saves into backups dir |
| `POST /restore/{name}` | Restore (safety backup first) | /settings | |
| `DELETE /{name}` | Delete backup | /settings | |

### Maintenance — `/api/v1/maintenance`
| Method & Path | Purpose | Consumer | Notes |
| --- | --- | --- | --- |
| `GET /status` | DB size, backups, log availability | /settings | |
| `POST /optimize` | VACUUM (returns freed bytes) | /settings | graceful when locked |
| `GET /logs?lines` | Tail of backend log | /settings | min 10, max 2000 |
| `POST /reset-demo-data` | Clear revenues/expenses/reservations | /settings | destructive, double-confirmed |

### Settings — `/api/v1/settings`
| Method & Path | Purpose | Consumer | Notes |
| --- | --- | --- | --- |
| `GET ""` | All settings (defaults merged) | SettingsProvider | |
| `PUT ""` | Upsert settings | SettingsProvider | Reports honor currency + tax |
| `GET /export` | Export all business data as multi-sheet `.xls` | /settings Security | Properties/Revenue/Expenses/Reservations sheets |
| `POST /wipe` | Delete all business data, keep settings | /settings Security | Destructive, returns deleted counts |

### Health
| `GET /api/health` | Liveness + DB status | Tauri shell / AppShell | Not under /api/v1 |

## 3. Design observations

- **Auth-free by design (v2).** The product is local-first and single-user;
  no tokens are required anywhere. If HostWise is ever exposed to the web,
  authentication and per-user tenancy become a first-class concern again.
- **One-endpoint-per-page** is the emerging pattern (`/ai/advisor`,
  `/reports/portfolio`) and is the recommended model for new pages.
- **Composition lives in the service layer.** The connectors router now
  delegates to `ConnectorService` (CSV + JSON parsing, settings-aware date
  parsing, property auto-creation); the old inline parsing was removed.
- **BYOK AI is a proxy, not a fork:** the rules engine remains the default;
  an LLM call is only attempted when the user configures an API key.

## 4. Possible improvements

- Add pagination metadata (`PaginatedResponse` exists in shared schemas but is
  barely used).
- Add `If-None-Match`/ETag or a `rendered_at` cache for expensive report/AI
  payloads.
- Add OpenAPI client generation (openapi-typescript) so the frontend is typed
  from the contract.
- Add a proper Excel/PDF generator server-side (currently `.xls` is an HTML
  table and PDF is a browser print layout).
