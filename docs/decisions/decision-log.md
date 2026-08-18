# HostWise — Decision Log

Every important implementation decision, framed as:
**Problem → Chosen solution → Alternatives → Trade-offs → Why it's right for HostWise.**

Read this before changing anything significant. It separates **deliberate
design** from **accidental complexity**.

---

## 0. What changed in v2 (product simplification)

A consolidation pass applied user feedback to sharpen the product's focus.
These decisions supersede any earlier notes that contradict them.

### 0.1 Remove authentication entirely
- **Problem:** A login screen, default credentials, and JWT plumbing add
  friction and imply "accounts" for a product that is local-first and
  single-user.
- **Chosen:** No auth anywhere. Routers dropped `get_current_user`; the frontend
  `auth-context` derives identity from `profile_name`/`profile_email` settings;
  a welcome wizard collects name/email via `POST /setup/initialize`.
- **Trade-offs:** No multi-user tenancy. If the product ever becomes a hosted
  SaaS, authentication must be re-introduced intentionally.
- **Why right:** Matches the "your data stays on this device, no account, no
  login" value proposition.

### 0.2 Remove occupancy / ADR / RevPAR metrics
- **Problem:** These "PMS-style" metrics require nightly availability data the
  product does not own and that users found confusing; they diluted the
  profit-driven message.
- **Chosen:** Removed occupancy/ADR/RevPAR from analytics, AI advisor, reports,
  and all frontend types/components. Health scoring and AI risks are now driven
  by **profit margin, cancellation rate, expense ratio, and revenue vs target**.
  Asking the AI about "occupancy" explains it is no longer tracked.
- **Why right:** Reinforces "financial intelligence layer, not a PMS".

### 0.3 Full CRUD for properties and finances
- **Chosen:** Added `PATCH`/`DELETE` for revenue, expense, and property (soft
  delete); the finance and properties pages gained create/edit/delete UIs backed
  by typed TanStack Query mutations.
- **Why right:** A local-first tool must let users correct their data.

### 0.4 BYOK — bring your own LLM key
- **Chosen:** The AI advisor stays a deterministic rules engine by default; when
  the user supplies `ai_api_key`/`ai_base_url`/`ai_model` in Settings, chat
  routes through an httpx proxy (OpenAI-compatible or Ollama) with a
  `POST /ai/test-connection` validation endpoint.
- **Why right:** No hosted LLM cost or data-sharing for HostWise; power users
  can upgrade to a real LLM without a product dependency.

### 0.5 Professional PDF report + settings & import overhaul
- **Chosen:** The report PDF is now a dedicated print layout (cover header, KPI
  band, styled tables, CSS bar chart, page-numbered footer) hidden on screen and
  shown via `window.print()`. Settings dropped the Dashboard/Reports/Notifications
  sections; added editable profile, BYOK AI connection, export-all (`.xls`) and
  wipe, and backup upload. Import gained an in-page guide, JSON support, and a
  server-side `ConnectorService` layer (settings-aware date format + currency).

### 0.6 Automated backend test suite
- **Chosen:** Added pytest + pytest-asyncio + faker with 36 tests covering
  setup/profile, finance CRUD + summaries + reports, property CRUD, analytics
  (asserting no occupancy metrics leak), AI advisor (rules + scenarios + BYOK
  no-key fallback), settings (export/wipe), connectors (CSV + JSON import), and
  auth-free operation. Tests run against a throwaway SQLite DB in `backend/tests/`.

### 0.7 AI advisor — deterministic section logic and a single scoring model
- **Problem:** Several advisor sections were empty or illogical — `opportunities`
  was a flat array that crashed the page, `lost_revenue` a bare number, and
  property reviews / trend explanations / goals / achievements were hardcoded `[]`.
- **Chosen:** One transparent composite health score (profit margin 30 ·
  occupancy 20 · expense ratio 20 · cancellations 15 · booking value 15) used
  consistently at portfolio and per-property level; every section derives from
  real metrics (portfolio analytics + the same window one year earlier) with
  itemized, explainable outputs (opportunity upside = cancellation leakage +
  |YoY growth|; risks from underperforming properties; reviews/goals/achievements
  from per-property signals).
- **Trade-offs:** Output is heuristic (e.g. 60% occupancy benchmark, revenue/12
  monthly forecast) rather than an LLM; stays deterministic, free, and private.
- **Why right:** Reinforces the "rules engine by default" decision (0.4) — the
  AI Advisor page is fully populated and logical with no LLM key.

---

## 1. Local-first desktop with a bundled Python backend

- **Problem:** The product must serve a non-technical host, work offline, and
  own the user's data privately. Web-only requires a server and an account.
- **Chosen:** Tauri v2 shell bundling a PyInstaller-packaged FastAPI backend as
  a sidecar process; SQLite as the local database.
- **Alternatives:** Electron + Node backend; pure web app (SaaS); native
  mobile.
- **Trade-offs:** Tauri bundles two runtimes (Rust + Python) which complicates
  packaging; Python startup adds ~1s; but binaries are small and the data
  layer is identical to a future cloud deployment.
- **Why right:** Matches the "analytics layer, not a PMS" positioning and the
  privacy/ownership value proposition.

## 2. SQLite by default, PostgreSQL optional — one codebase

- **Problem:** Desktop must be zero-setup; cloud must be scalable.
- **Chosen:** SQLAlchemy async with a `DATABASE_TYPE` switch; SQLite via
  aiosqlite for desktop, Postgres via asyncpg for cloud.
- **Alternatives:** Always Postgres (too heavy for desktop); always SQLite
  (limits cloud growth).
- **Trade-offs:** Some SQL must stay portable (extract("month", ...) instead of
  DB-specific functions); Postgres-specific features are avoided.
- **Why right:** Local-first MVP + a credible cloud path with minimal
  divergence.

## 3. Modular monolith (domain packages) over microservices

- **Problem:** Need clean boundaries without operational complexity.
- **Chosen:** One FastAPI app with domain packages and explicit service
  composition between domains.
- **Alternatives:** Microservices; a single "models + routes" file soup.
- **Trade-offs:** No independent scaling or deployment; but no network
  failures, and shared transactions (important for CSV import).
- **Why right:** One team, local-first single process; boundaries exist so a
  future split is possible.

## 4. Computed Intelligence on Demand (never store metrics)

- **Problem:** Stored KPIs go stale and require invalidation on every write.
- **Chosen:** All analytics/health/report metrics are recomputed per request
  from the raw rows.
- **Alternatives:** Pre-aggregated tables / materialized views.
- **Trade-offs:** More CPU per request; the AI analyze path is notably
  expensive (portfolio + per-property health). Acceptable because a single
  user's dataset is small.
- **Why right:** Always-correct numbers, no invalidation bugs, and the reports
  are naturally "fresh."

## 5. Rule-based AI with an LLM-swappable interface

- **Problem:** Need useful, trustworthy insights now; LLMs are costly, online,
  non-deterministic, and privacy-sensitive for financial data.
- **Chosen:** A deterministic rule engine producing **structured** outputs
  `{cause, impact, action, confidence}` and a plain-language summary.
- **Alternatives:** LLM from day one; no AI at all.
- **Trade-offs:** Rules are limited in nuance; but they are testable, offline,
  free, and explainable.
- **Why right:** The interface (`analyze_financial_performance`, chat, scenario)
  is designed so an LLM can be dropped in later without changing callers —
  the "LLM-ready" strategy is explicit in the code.

## 6. Repository pattern + generic `BaseRepository`

- **Problem:** Keep ORM isolated and soft-delete consistent.
- **Chosen:** Every domain has a repository extending a generic
  `BaseRepository[ModelType]`; all base queries filter `is_deleted == False`.
- **Alternatives:** Query the ORM directly in services; raw SQL everywhere.
- **Trade-offs:** Slight indirection; but queries are named, testable, and
  ORM-swappable.
- **Why right:** Matches the "analytics over data" product: aggregation queries
  (monthly revenue, category splits, property rankings) are the heart of the
  system and deserve first-class homes.

## 7. Auto-login (no login screen) for the MVP

- **Problem:** A local-first app doesn't need a walled login for one owner.
- **Chosen:** First-run `POST /setup/initialize` creates a default
  admin@hostwise.local user; the frontend auto-logs-in and stores a JWT.
- **Alternatives:** Full registration/login UI; no auth at all.
- **Trade-offs:** Security is nominal on-device; but the auth machinery (JWT,
  bcrypt, refresh tokens, roles) is real and ready for when multi-user arrives.
- **Why right:** Removes friction from the MVP while keeping the security
  architecture intact.

## 8. Soft-delete + `sync_id` on every table

- **Problem:** Data is precious (financial history); the cloud is coming.
- **Chosen:** `BaseModel` gives `id`, `sync_id`, `created_at`, `updated_at`,
  `deleted_at`, `is_deleted` on every entity.
- **Alternatives:** Hard deletes; no sync columns.
- **Trade-offs:** Slightly larger rows; every query must filter soft-deleted.
- **Why right:** Recoverability for users and a migration-free foundation for
  future cloud sync.

## 9. Denormalized fields on `Reservation`

- **Problem:** Occupancy/ADR/cancellation analytics query reservations heavily.
- **Chosen:** Store derived `nights`, `net_revenue`, `property_name`,
  `property_city`, `property_country` on the reservation row.
- **Alternatives:** Always JOIN to property and compute nights.
- **Trade-offs:** Redundancy risk (must be kept in sync at write time); but
  queries stay simple and fast.
- **Why right:** The analytics layer reads reservations constantly; snapshotting
  property metadata at import time also preserves history if a property is
  renamed.

## 10. Settings as a key-value store (no org table yet)

- **Problem:** Users need config (currency, tax rate, appearance, AI, etc.)
  that affects the whole app.
- **Chosen:** A `settings` key-value table (JSON values) with defaults merged
  server-side; frontend `SettingsProvider` applies them.
- **Alternatives:** A wide `Organization` table; localStorage only.
- **Trade-offs:** No schema-level validation per key; but new settings need no
  migration and localStorage-only wouldn't let the backend honor them (e.g.,
  reports using default currency + tax rate).
- **Why right:** The `business_name` setting is the seed of a future
  `organizations` tenant boundary.

## 11. File-copy + VACUUM backups with 7/4/3 rotation

- **Problem:** SQLite has no built-in server; backups must be simple and safe.
- **Chosen:** `shutil.copy2` of the DB + `VACUUM` on the copy; retention of 7
  daily / 4 weekly / 3 monthly; safety backup before any restore.
- **Alternatives:** SQLite online backup API; external service.
- **Trade-offs:** Copy is not point-in-time consistent under heavy writes, but
  for a single-user desktop app it is perfectly adequate.
- **Why right:** Simple, local, zero-dependency, and the restore flow is
  protected by a pre-restore safety snapshot.

## 12. Dynamic backend port (18000–18099)

- **Problem:** Fixed ports (8000) collide on desktops.
- **Chosen:** The Rust shell scans for a free port and the backend binds to it;
  the frontend resolves the URL at runtime via `get_backend_url()`.
- **Alternatives:** Fixed 8000; unix socket.
- **Trade-offs:** Slight startup delay scanning ports; but eliminates the most
  common desktop support issue.
- **Why right:** Local-first product reliability.

## 13. Chart.js over a heavier viz library

- **Problem:** Need clear bar/line charts quickly without bloat.
- **Chosen:** Chart.js via react-chartjs-2, centralized in one component file.
- **Alternatives:** Recharts, D3, ECharts.
- **Trade-offs:** Chart.js is imperative and less React-idiomatic, but small and
  sufficient for the current visual needs.
- **Why right:** MVP scope — three chart types reused across pages.

---

## 14. Production & settings audit (2026-08-08)

### 14.1 Settings are the single source of truth — no hardcoded display values
- **Problem:** Several pages hardcoded currency/behaviour (the dashboard/reports
  chart Y-axis was `$`, tooltips defaulted to EUR, About showed hardcoded
  versions) so settings didn't actually change what users saw.
- **Chosen:** Every displayed value reads from the `default_currency` setting
  (EUR fallback); `/api/health` exposes `version` + `schema_version` and the
  About tab renders those; the shared chart components take a `currency` prop
  that falls back to the setting.
- **Trade-offs:** A little prop plumbing on the chart call sites.
- **Why right:** "Settings affect the app" is the product promise; hardcoded
  values made settings effectively dead.

### 14.2 AI API-key clear semantics: empty clears, `••` mask keeps
- **Problem:** The "Clear" button couldn't remove a saved key — the backend
  treated an empty string as "keep the stored secret".
- **Chosen:** Only the masked placeholder (`••…`) is preserved; an empty string
  stores "" (clears); a real value stores it. `GET /settings` masks non-empty
  keys.
- **Trade-offs:** The client must send `••…` (untouched) to keep, `""` to
  clear. Enforced in the settings service, not the UI.
- **Why right:** Lets users rotate/remove keys without wiping them on every
  unrelated settings save.

### 14.3 `ai_base_url` validated (http(s) + host)
- **Problem:** Invalid endpoints (`not-a-url`, `ftp://…`) were saved and only
  failed at connection time.
- **Chosen:** `coerce_setting` rejects non-http(s) / hostless `ai_base_url`
  values with 422, matching the earlier Python-era behaviour.

### 14.4 Backup restore needs a backend restart (WAL/SHM)
- **Problem:** `fs::copy` over an open SQLite DB + stale `-wal`/`-shm` made
  restore a silent no-op for the running app.
- **Chosen:** The restore endpoint deletes the `-wal`/`-shm` sidecars after
  copying; the desktop frontend then calls `restart_backend` so the embedded
  backend reopens the restored file. Browser dev falls back to a reload.
- **Trade-offs:** Restore briefly restarts the backend (new port, connection
  banner). Acceptable for a destructive operation.
- **Why right:** A restore that reports success but changes nothing is worse
  than a visible restart.

### 14.5 Import encodings via `encoding_rs`
- **Problem:** `import_encoding` was ignored — files were always decoded as
  UTF-8, garbling ISO-8859-1 / Windows-1252 / UTF-16 CSVs.
- **Chosen:** Added the pure-Rust `encoding_rs` crate; decode honours
  `import_encoding` (ISO-8859-1 → windows-1252 per WHATWG; UTF-16 reads the
  BOM). The upload preview uses the same setting so users don't see mojibake.
- **Trade-offs:** One new dependency; no system libraries required.
- **Why right:** Real-world host exports are often not UTF-8; a setting that
  does nothing is worse than no setting.

## What is deliberate and should NOT be changed casually

- The **service/repository/schema layering** and "no logic in routers" rule.
- **Computed-on-demand** analytics (don't add stored KPI tables without a
  measured reason).
- The **AI interface** (`analyze`/`advisor`/`chat`/`scenario`) — it is the
  LLM seam.
- **Soft-delete + sync_id** conventions.
- **Local-first** data ownership and the dual-database switch.

## What is accidental and is fair game

- Frontend `any`-typing.
- CSV logic living in the connectors router.
- Hardcoded `localhost:8000` in a few frontend spots.
- Fake ADR/RevPAR data in the analytics page.
- Lack of a test suite.
