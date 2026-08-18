# HostWise — Changelog & Dev Roadmap

> Practical record of what changed, **why**, and the workflow to follow so the
> app (dev and packaged) keeps working. Read §4 (workflow) + §5 (troubleshooting)
> first if you hit an issue.

---

## 0. v0.8.1 — production hardening, updater & logging (2026-08-10)

### Custom-date crash fixed (root cause: inverted ranges)
- Selecting a custom period where **start > end** made the backend return 422,
  which surfaced as misleading zero data and a stuck error state hiding the
  selector. Added `normalizeRange(start, end)` (`app/frontend/src/lib/report-period.ts`)
  that auto-swaps inverted ranges, wired into the **Dashboard**, **Analytics**,
  **Reports** and **Finance** custom-date handlers. The Dashboard error state
  also gained a **"Reset to {year}"** escape hatch so a failed period query
  never locks the page again. Verified live: `2026-09-01 → 2026-03-01` now
  auto-swaps and loads data.

### Settings / wizard — currency + language
- The **welcome wizard** now captures **Default currency** (EUR/USD/GBP/MAD/
  AED/CAD/AUD/CHF) and **Language** (English/Français/Español/العربية/Deutsch)
  alongside business name/email, and persists them through the settings context
  on submit. Coherent with the Settings → Business tab.

### Downloads — user chooses the save location
- Added a `save_file` Tauri command + a shared `app/frontend/src/lib/download.ts`
  helper. In the desktop app, PDF reports, backup downloads and the Excel
  export now open the **native "Save As" dialog** (the user picks where to save
  — no more dumping into a hidden folder). In the browser it falls back to the
  standard blob download.

### Production logging
- Backend logs every request (method, path, status, ms, request ID) to stdout
  **and** `<data_dir>/logs/hostwise.log` — in both the desktop app and the
  standalone binary. Paths only — no query strings, bodies or headers, so no
  API keys/secrets can leak.
- Frontend added `app/frontend/src/lib/logger.ts`: captures uncaught errors,
  unhandled rejections and failed API calls into a ring buffer
  (Settings → Maintenance → **Client Logs**, with **Export Client Logs**).
  Bodies/Authorization headers are never logged.

### Automatic daily backup (data safety)
- The status screen always advertised "schedule: daily" but nothing created
  backups automatically. `serve()` now creates an **automatic backup on every
  production launch** if the newest is older than 24 h
  (`hostwise_auto_*.db`, keeping the newest 7; manual backups untouched).

### Tauri Updater (auto-update)
- Wired the official **Tauri updater**: `tauri-plugin-updater` (Rust + JS +
  capability), `createUpdaterArtifacts: true`, endpoint
  `https://github.com/mahmoud-ath/HostWise/releases/latest/download/latest.json`,
  `passive` install mode on Windows.
- **Signing keypair generated** (2026-08-10) at `~/.tauri/hostwise.key`
  (+ `.pub`, + passphrase). Public key embedded in `tauri.conf.json`; private
  key gitignored and **never committed**. If lost, no further updates can be
  signed.
- Frontend checks for updates ~2.5 s after startup and shows a **banner** with
  "Download & Install" + progress; failures are silent + logged.
- `app/frontend/scripts/generate-latest-json.mjs` builds the updater manifest;
  `scripts/release.sh` performs a local signed build + upload;
  `release.yml` now signs all OS installers, uploads `.sig` files and publishes
  `latest.json` via a new `updater-manifest` job.
- **User data survives updates**: the SQLite DB/backups/logs live in the
  per-OS app-data dir, not the app bundle. See `docs/RELEASING.md`.

---

## 1. Recent changes (2026-08-09)

### v0.8.0 — official logo, production-ready settings save, coherent settings UX

**Branding — official logo**
- Adopted the official HostWise logo (white rounded tile, two gradient house
  loops with a chimney, and the window / checklist / bar-chart glyphs).
  Source master: `logo_hostwise.png` → cropped to a square
  `app/frontend/public/logo-1024.png` (`app/frontend/src/app/icon.png` = web favicon).
- Regenerated the entire Tauri icon set (`src-tauri/icons/*`: `icon.png`,
  `icon.ico`, `icon.icns`, Square* + Windows/macOS/iOS/Android variants) from
  the new logo via `tauri icon`.
- Replaced the in-app placeholder marks (lucide `Home` / `Rocket`) with the new
  `Logo` component (`app/frontend/src/components/layout/logo.tsx`) in the sidebar,
  the mobile header (`app-shell`) and the welcome wizard; added favicon metadata
  in `app/layout.tsx`.

**Root cause fix — desktop could not save settings (CORS missing PUT)**
- See the dedicated section below: `app/backend/src/lib.rs` CORS now allows
  `PUT`, so saving settings works in the Tauri desktop window, not just the
  browser dev proxy.

**Settings workflow (previous section below) + version bump to 0.8.0**
- Version bumped to `0.8.0` across `app/backend/Cargo.toml`,
  `app/frontend/src-tauri/Cargo.toml`, `tauri.conf.json` and `app/frontend/package.json`.

### Root cause: desktop (Tauri) could not save settings — missing PUT in CORS
- **Symptom:** saving settings worked in the browser (`localhost:3000`) but not
  in the desktop window (`bun run tauri:dev`) — changes looked "not applied".
- **Root cause:** the backend CORS layer (`app/backend/src/lib.rs`) allowed
  `GET, POST, PATCH, DELETE, OPTIONS` but **not `PUT`**. In the browser the
  Next dev server proxies `/api/*` to the backend (same-origin, no CORS), so
  every method worked. In the Tauri webview the frontend calls the backend
  **directly** (cross-origin `localhost:3000 → 127.0.0.1:8000`), so writes
  trigger a CORS preflight; the preflight answered "PUT not allowed" and the
  browser/webview blocked the request. GETs are "simple" requests, which is why
  the desktop could load data but never persist a settings save.
- **Fix:** added `Method::PUT` to `CorsLayer::allow_methods`. Verified with a
  real preflight (`OPTIONS`) against a rebuilt backend: the allow list is now
  `GET,POST,PUT,PATCH,DELETE,OPTIONS` and a cross-origin `PUT /settings`
  returns 200. `cargo check --all-targets`, `cargo test`, and `cargo fmt` green.
- **To pick up:** restart `bun run tauri:dev` (Tauri depends on `backend-rs` by
  path, so it rebuilds the embedded binary automatically).

### Settings — coherent save workflow, business identity & welcome wizard
- **Settings context saves only the changed keys** (`save()` diffs the draft
  against the committed settings instead of PUTting the whole 36-key draft).
  This stops re-writing untouched defaults and never echoes the masked
  `ai_api_key` placeholder back to the backend. Verified: only the edited key
  changes on the server; unrelated values (currency, tax rate, appearance)
  are preserved.
- **Unsaved-changes guard** — new `useConfirmLeave(dirty)` hook on the Settings
  page. Leaving the page (in-app link click or browser close/reload) with
  pending edits now shows *"You have unsaved changes. Leave without saving?"*
  instead of silently dropping the draft.
- **Sidebar identity = `business_name`** — the sidebar `{/* User */}` block now
  renders `business_name` (committed settings, so it updates on Save — same rule
  as theme/language) instead of the old `profile_name || business_name` mix.
  `auth-context.tsx` exposes `user.business_name`.
- **Welcome wizard is coherent with Settings** — the field is now *"Your
  business name"* (all 5 languages), pre-filled from existing settings, and on
  submit writes `business_name` + `profile_email` + `profile_name` via
  `PUT /settings` (keeping `/setup/initialize` for DB init). No more orphaned
  `profile_name` that the Business tab can't edit.
- **Backup stats refresh** — `BackupSection` now invalidates the
  `["backup-status"]` query after create/upload/delete, so the stat cards
  (last/next backup, storage) stay in sync with the backup list.
- All settings tabs exercised in the browser against the running backend:
  Business (save/discard/currency/tax), AI (provider switch, API-key
  save→mask→clear→test-connection), Appearance (theme applies only on Save,
  accent, compact), Backup (create + stats refresh), Notifications (toggle),
  Maintenance (optimize, copy diagnostics, logs, cache), Import, About.

### AI Advisor — coherent scoring, sentence summary, opportunities & PDF layout
- **Health score components** are now four self-explanatory pillars
  (`profit`, `growth`, `expenses`, `risk`) on a 0–100 scale; the overall score is
  a weighted average of them, so it matches what the bars show. The frontend
  labels them *Profitability / Revenue Trend / Expenses / Risk* with a caption
  explaining each. Reports `portfolio_health` uses the same pillars (Revenue bar
  now reflects the YoY trend, fixing the contradictory "100/100 while ↓34%").
- **Executive AI Summary** is now written as plain sentences
  (e.g. "Your portfolio generated $16,237 in net revenue against $3,228 in
  expenses, leaving a profit of $13,009 — a 80.1% margin…").
- **Opportunities & Lost Revenue** are coherent: `opportunities.actions` are
  concrete levers tied to real gaps (recover revenue decline, improve occupancy,
  reduce cancellations, capture growth) with per-lever gains; `lost_revenue`
  equals the sum of its itemized reasons.
- **PDF**: added a "Print / Save PDF" button on the Reports page that renders the
  styled CSS print view (cover, KPI cards, CSS bar charts, tables). The backend
  **Generate Report** PDF (`reports/pdf_service.rs`) was rewritten from plain
  text into a structured, visual A4 report: cover band, sentence executive
  summary, **KPI cards**, **AI Executive Insights** with risk/recommendation
  callout boxes, a **monthly revenue-vs-expenses bar chart** (drawn with printpdf
  shapes), **property performance** and **expense analysis** tables, risks with
  level chips, recommended actions, and per-page footers with page numbers
  (auto-pagination).

### AI Advisor — crash fix + logical section outputs (rules engine)

- **Contract fix:** `generate_advisor_report` (`app/backend/src/ai/rules.rs`) now
  emits exactly the shapes the frontend `AdvisorReport` type expects. Previously
  `opportunities` was a flat array and `lost_revenue` a bare number, which
  crashed the AI Advisor page (`undefined is not an object (evaluating
  'opp.actions.map')`); `risks` and `forecast` also had mismatched shapes and
  rendered garbage.
- **Every section now has real, logical output** (several were hardcoded empty):
  - **Health score** — transparent composite (profit margin 30 · occupancy 20 ·
    expense ratio 20 · cancellations 15 · booking value 15), 0–100, with
    component bars on a 0–100 scale; mirrors the per-property analytics score.
  - **Executive summary** — narrative includes margin, expense ratio, cancellation rate.
  - **Opportunities** — upside = cancellation leakage + recoverable revenue
    change (|YoY growth|); each action carries a real gain and the actionable step.
  - **Lost revenue** — itemized reasons (cancellations, revenue decline) with amounts.
  - **Risks** — per-property (negative margin → high; health < 40 or low occupancy → medium).
  - **Property reviews** — generated for every property (strengths, weaknesses,
    AI summary, suggested action) from the ranking + per-property expense
    ratio/occupancy (now exposed on `property_ranking`).
  - **Trend explanations** — why net revenue / expenses / profit changed vs the
    same window a year earlier (volume, cancellations, spending).
  - **Recommended goals** — concrete targets (expense ratio, occupancy, margin,
    cancellations, revenue growth) with progress.
  - **Achievements** — wins based on margin, cancellations, growth, cost ratio, activity.
  - **Forecast** — expected next-month revenue, risk level aligned to health
    status, best property, and a data-driven confidence.
- **YoY growth exposed** in the rules `metrics` (`revenue_growth_yoy`) so the
  growth-driven goals / reasons / achievements actually trigger.
- **Reports + Dashboard AI consumers updated** for the new advisor shapes:
  `reports/service.rs` now maps `ai["risks"]` (per-property → RiskItem), builds
  `ai_insights.drivers` from `opportunities.actions`, and derives `biggest_risk`
  from the per-property risks. The dashboard only reads `executive_summary` +
  `priority_actions` (unchanged shapes) — verified rendering in the browser.
- Frontend `opportunities.tsx` hardened with array guards so it never throws on
  partial / LLM-shaped data.
- **Note:** the desktop backend is compiled by `tauri dev` into
  `app/frontend/src-tauri/target/debug/hostwise`; backend-rs source changes go live
  after restarting `bun run tauri:dev`.

## 2. Recent changes (2026-08-08)

### v0.7.6 — production & settings audit (2026-08-08)

A page-by-page production audit of **Finance, Import, Analytics, Reports,
Feedback and Settings** (frontend + Rust backend together, verified against
`bun run tauri:dev`). Fixes, all uncommitted until reviewed:

- **Finance** — added the missing `POST /finance/revenue-categories/{id}/merge`
  endpoint (the category manager called it; only the expense version existed).
  `PATCH /finance/revenue|expense/{id}` now persists `date` and `property_id`
  (previously ignored).
- **Reports PDF** (`app/backend/src/reports/pdf_service.rs`) — the PDF read
  `executive_summary` as a string but the API returns an object (so the
  section rendered empty), and risk lines used the wrong key (`risk` vs
  `title`). Both fixed.
- **Settings → Backup list** — the frontend called `GET /backups/` (404); the
  backend serves `GET /backups`. Fixed the frontend path (axum does not
  normalise the trailing slash).
- **Settings → About** — versions were hardcoded (`v0.5.0` / backend `0.1.0`).
  `/api/health` now also returns `schema_version` (applied migration count)
  and the About tab displays the real app version + migration count.
- **AI settings** — the API-key **Clear** button did nothing (empty string was
  treated as "keep"); only the `••` masked placeholder is preserved now and an
  empty string actually clears the key. `ai_base_url` is validated (must be
  http(s) with a host → 422 otherwise).
- **Backup restore** — restore copied the file but the open pool + stale
  `-wal`/`-shm` sidecars made it a no-op. The backend now removes the sidecars
  after copying, and the desktop frontend calls `restart_backend` so the
  embedded backend reopens the restored database.
- **CSV import encoding** — `import_encoding` was ignored (always decoded as
  UTF-8). Added the `encoding_rs` crate; ISO-8859-1 / Windows-1252 (mapped to
  windows-1252 per WHATWG) / UTF-16 (BOM-aware) files now decode correctly,
  and the upload preview uses the configured encoding too.
- **Dashboard / Reports charts** — the Y-axis was hardcoded `$` and tooltips
  defaulted to EUR. Added `formatCurrencyCompact` + a `currency` prop (falls
  back to the `default_currency` setting) to the shared charts and passed the
  currency at both call sites.
- **Settings → Business** — field labels were hardcoded English while the
  section title/description were translated; labels now use i18n keys across
  all 5 languages.
- **`app/frontend/package.json`** version synced `0.4.0 → 0.7.6` to match
  `backend-rs` / `src-tauri` / `tauri.conf.json`.

### v0.7.6 — diagnostics + version sync
- **`api.ts` no longer hides `get_backend_url` failures.** In the Tauri webview
  it now invokes `get_backend_url`, validates the result (`http://127.0.0.1:…`),
  and THROWS a descriptive error on failure — no more silent fallback to a
  relative `/api/v1` that can't reach the embedded backend. (Browser-only dev
  still uses the `/api/v1` proxy base.)
- **Backend URL shown in diagnostics.** Settings → Maintenance now resolves and
  displays the actual `API URL` the app talks to (via the API client), instead
  of the placeholder "dynamic (Tauri)".
- **Persistent file logging.** The Tauri shell now appends backend logs to
  `<app-data>/logs/hostwise.log` as well as the terminal, so startup failures
  are visible on packaged Windows release builds (which have no console).
- **Version synced to 0.7.6** across `app/backend/Cargo.toml`,
  `src-tauri/Cargo.toml` and `tauri.conf.json` (+ lockfiles).
- Docs updated for the Rust architecture: `BUILD.md` rewritten; stale
  Python/PyInstaller docs (`ARCHITECTURE.md`, `overall-architecture.md`,
  `README-config.md`, `production-overview.md`, `production-roadmap.md`,
  `frontend-architecture.md`) marked SUPERSEDED.
- **Browser dev single-command runner** (`bun run dev:app` →
  `app/frontend/scripts/dev.mjs`): starts `backend-rs` (`cargo run`, :8000) first,
  waits for it to listen, then boots Next (:3000) — no more `ECONNREFUSED`
  proxy spam. Both logs show in one terminal; Ctrl+C stops both.
- **Legacy-schema reconciliation** (`app/backend/src/core/db.rs`): databases
  created by the old Python backend carry an unused `organization_id NOT NULL`
  column (plus `is_deleted`/`sync_id` nullability differences) on the core
  tables, so **every insert** (property / revenue / expense / reservation /
  category) returned `500 {"error":"Database error"}`. On startup the backend
  now rebuilds those tables in the Rust-compatible shape — drops
  `organization_id`, defaults `is_deleted` to 0, makes `sync_id` nullable —
  preserving all data. Idempotent (fresh Rust-created DBs are untouched).
  Verified: property/revenue/expense inserts now return 201.

### v0.7.5 — production CORS fix
- **`app/frontend/src-tauri/src/rust_backend.rs`**: the embedded backend's CORS
  allow-list now includes **`http://tauri.localhost`** — the packaged webview's
  origin on **Windows** (Tauri v2 uses the http scheme there; WebView2 can't
  fetch custom schemes). Without it the built Windows app CORS-blocks every
  `/api` call and looks like "the backend won't run".

### v0.7.4 — desktop "API Connection Error" root cause
- **`get_backend_url` returned a bare host** (`http://127.0.0.1:8000`), but the
  frontend builds request URLs as `baseUrl + endpoint` where every endpoint has
  **no** `/api/v1` prefix (e.g. `/finance/summary`). So the desktop webview was
  calling `http://127.0.0.1:8000/finance/summary` → **404** → "Request failed".
  The browser worked only because its fallback base is `/api/v1`.
  - Fix: `get_backend_url` (and `default_backend_url()`) now return
    `http://127.0.0.1:<port>/api/v1`. **This is a cross-cutting contract — do
    not change it.**
- **Backend startup race**: the embedded backend bound the port *asynchronously*
  after the window loaded, so the webview's first requests could hit a not-yet
  listening port. Fix: bind the `TcpListener` **synchronously before the window
  loads** (`rust_backend.rs::start`).
- **Auto-recovery**: `backend-context.tsx` invalidates all queries when the
  backend reports `healthy`, so pages clear cached "Request failed" without a
  manual reload.

### v0.7.4 — dev proxy hardening (`app/frontend/next.config.js`)
- The `/api` dev proxy is **unconditionally** `['/api/:path*' →
  'http://127.0.0.1:8000/api/:path*']` in dev. `rewrites()` is only evaluated at
  boot — *before* the embedded backend exists under `tauri:dev` — so any gating
  (live-port check, port file) made `/api` 404/500 for the whole session. A
  static destination is fetched per-request and works the moment port 8000 is up.

---

## 2. Architecture at a glance

```
Tauri shell (Rust)                     browser dev (localhost:3000)
 └─ embedded axum backend               └─ Next.js dev proxy
    binds 127.0.0.1:<port>                 /api → 127.0.0.1:8000
    serves /api/v1/*                       (relative /api/v1 base)
 └─ webview (static export or devUrl)  └─ backend: `cargo run` on 8000
    api.ts → get_backend_url
    → http://127.0.0.1:<port>/api/v1
```

- **Port** (dev): 8000 preferred — used by both `cargo run` and the embedded
  backend.
- **API base contract**: `get_backend_url` MUST end in `/api/v1`.
- **CORS origins** (`rust_backend.rs::desktop_config`) MUST include:
  - Linux/macOS packaged → `tauri://localhost`
  - Windows packaged → `http://tauri.localhost`
  - dev → `http://localhost:3000`, `http://127.0.0.1:3000`

---

## 3. Logging

- The Tauri shell now installs a **tracing subscriber** (`lib.rs::init_tracing`)
  so the embedded backend's logs are visible in the `tauri:dev` terminal —
  every request is logged as `request method=GET path=/api/v1/... status=200`.
- Filter via `RUST_LOG`, e.g. `RUST_LOG=debug bun run tauri:dev`.
- The middleware lives in `app/backend/src/core/middleware.rs` (request ID +
  timing). If you edit `app/backend/`, restart `bun run tauri:dev` — tauri dev
  only auto-rebuilds on `src-tauri/` changes.

---

## 4. Workflow (follow this)

### Desktop app (the product)
```bash
cd app/frontend
bun run tauri:dev        # single command: frontend + embedded backend
```
Do **not** also run `cargo run` — the backend is embedded in the app. Two
backends would fight over port 8000 and the `hostwise.port` file.

### Browser-only dev (API debugging)
```bash
# Terminal 1 — start the backend FIRST
cd app/backend && cargo run                     # http://127.0.0.1:8000

# Terminal 2 — then the frontend
cd app/frontend && bun run dev                     # http://localhost:3000
```
If you started Next first (or the backend restarted on a new port), restart
`next dev` (or touch `next.config.js`) so the proxy re-targets the live port.

### Production build
```bash
cd app/frontend
bun run build            # static export → out/
cd src-tauri && cargo build --release          # embeds out/ + backend
# or the full installer:
bunx tauri build
```

---

## 5. Troubleshooting

| Symptom | Fix |
|---|---|
| Desktop shows "API Connection Error / Request failed", browser is fine | **Stale webview storage** (WebKit persists localStorage/cache across restarts). Delete `~/.local/share/com.hostwise.desktop` (+ `app.hostwise.desktop`) and relaunch. Keep `~/.local/share/hostwise/` (your DB). |
| Settings "can't be saved" | Usually the same stale webview → it's still calling the old bare-host URL. Clear webview storage (above) and relaunch; confirm in the terminal log that requests go to `/api/v1/settings` and return 200. |
| No backend logs in `tauri:dev` | Fixed in v0.7.6 (tracing subscriber prints to the terminal and to `<app-data>/logs/hostwise.log`). Ensure you rebuilt. |
| Packaged Windows app can't reach backend | CORS origin `http://tauri.localhost` must be in `desktop_config` (fixed v0.7.5). |
| `/api` 404/500 in browser dev | The proxy is baked in at boot; the backend wasn't up. Restart `next dev` after the backend is running. |
| "backend won't run" on a clean install | Check the terminal log for `Database init failed` or bind errors; verify `get_backend_url` returns `.../api/v1`. |

**Quick sanity checks** (with the app running):
```bash
curl http://127.0.0.1:8000/api/health               # {"status":"ok",...}
curl http://127.0.0.1:8000/api/v1/settings          # settings JSON
curl -H "Origin: http://tauri.localhost" -D - -o /dev/null \
     http://127.0.0.1:8000/api/health | grep -i access-control-allow-origin
```

---

## 6. Verifying a packaged build (the 1-minute check)

On the machine where the app is installed, when the UI says the backend is
unreachable:

1. Open the app-data dir and read the port file:
   - Windows: `%APPDATA%\hostwise\hostwise.port`
   - Linux: `~/.local/share/hostwise/hostwise.port`
   - macOS: `~/Library/Application Support/hostwise/hostwise.port`

   It contains the port the embedded backend bound, e.g. `53142`.

2. From a terminal (PowerShell on Windows):
   ```
   Invoke-WebRequest http://127.0.0.1:53142/api/health
   ```

3. Interpret the result:
   - `{"status":"ok","database":"up","version":"0.7.6"}` → the **Rust
     backend is working**; the problem is frontend → Tauri IPC / URL / CORS.
     Then check `<app-data>/logs/hostwise.log` for what the webview requested.
   - connection refused → Rust isn't serving; check `logs/hostwise.log` for
     `Database init failed` / bind errors at startup.

Full definition-of-done (Windows clean VM): install → launch → dashboard loads
→ create property/revenue/expense → restart app → data persists → export PDF →
uninstall/reinstall → data persists.
