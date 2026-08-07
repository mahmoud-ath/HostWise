# HostWise — Production Roadmap

> ⚠️ **SUPERSEDED (2026-08-07):** This roadmap was written against the pre-Rust
> codebase (Python/PyInstaller). The backend is now a **native Rust crate**
> embedded in-process (`backend-rs/`). See the current docs:
> `docs/run-and-production.md`, `docs/BUILD.md`, `docs/CHANGELOG.md` and
> `docs/rust-rewrite-prompt.md`.

> **Built on the existing audit** (`AUDIT.md`, `decision-log.md`,
> `overall-architecture.md`, `database-audit.md`, page audits, `roadmap.md`),
> **not a new audit**. Re-verified against the codebase on **Aug 4, 2026**.
> This document answers one question:
>
> > **Starting from today's codebase and existing audit, what should I build
> > next, in what order, and why?**

---

## 0. How to read this document

1. **§1** gives the one-paragraph answer (the ordering).
2. **§2** is the delta between the audit and the current code — what's done,
   what's obsolete, what's missing, what debt is new. This keeps us from
   re-planning finished work.
3. **§3** reviews every page for production-readiness.
4. **§4** evaluates the architecture against the shipping targets
   (Windows/macOS/Linux, offline, local DB, AI, auto-update, cloud).
5. **§5** is the **Grill** — a critical challenge of the big decisions, each
   with priority and now-vs-later.
6. **§6** is the phased roadmap (Phase 1 → 6). Every phase has a **Goal**,
   **Why now**, a per-item table (**why / problem solved / business impact /
   technical impact / dependencies / risks**), **Technical tasks**,
   **Expected outcome**, and **Definition of Done**.

---

## 1. The answer in one paragraph

Ship the **packaged desktop app** reliably first (Phase 2 — otherwise the
product can't be installed, updated, or export its PDF on real machines),
then finish the **promised product surface** (Phase 3 — categories, one real
connector, idempotent import, mixed-currency support, scheduled reports),
then make the **AI trustworthy and cheap** (Phase 4 — settings honored,
caching, masked keys, safe LLM fallback). Layer **production guardrails**
(Phase 5 — e2e tests, migrations, caching, pagination, backup verification)
before broad distribution, and only then move to **commercial release**
(Phase 6 — licensing, signing, opt-in crash reporting, optional cloud sync).
Throughout, the **architecture does not need a rewrite** — it needs
stabilization, packaging work, and a small number of schema-level additions
(currencies per record, migrations).

**Ordering rule:** *distribution risk before feature risk; data integrity
before analytics; trust before AI.* This is why PDF packaging and schema
migrations precede connectors and the AI polish.

---

## 2. State of the codebase vs. the audit (delta)

> Re-verified Aug 4, 2026. The audit and `roadmap.md` were written against an
> earlier snapshot; the items below supersede them.

### 2.1 Completed since the audit (do not re-plan)

| Audit / roadmap item | Status | Evidence |
| --- | --- | --- |
| Dynamic backend URL via Tauri `invoke("get_backend_url")` | ✅ Done | `lib/api.ts` imports `@tauri-apps/api/core`; `backend-context.tsx` uses `@tauri-apps/api/event` + `restart_backend` |
| Backend readiness/health monitor + restart + connection banner | ✅ Done | `BackendProvider` status machine; v0.5.0 |
| Dynamic backend port (18000–18099) | ✅ Done | Rust sidecar port scan |
| CSV import moved out of the router into `ConnectorService` | ✅ Done | `backend/app/connectors/service.py` |
| Expense categories resolved on import (no "Uncategorized") | ✅ Done | find-or-create `ExpenseCategory`, sets `category_id` |
| Backend test suite | ✅ Done | 37 tests (was 36) |
| BYOK LLM (DeepSeek/OpenAI/Ollama) behind the AI seam | ✅ Done | `ai/providers.py`, `/ai/test-connection` |
| Period-driven reports/analytics/dashboard (year OR custom range) | ✅ Done | `ReportPeriod`, backend `year \| start_date&end_date` |
| Backend PDF export (WeasyPrint) + "Generate Report" | ✅ Done | `reports/pdf_service.py`, `/reports/export` |
| Settings vertical tabs; Profile+Business and Maintenance+Developer merged | ✅ Done | `settings/page.tsx`, deleted `account-section.tsx`/`developer-section.tsx` |
| Guide page → tabs; new Feedback page; CSV-only import + sample templates | ✅ Done | `guide/`, `feedback/`, `public/samples/` |
| Default-currency fallback consolidated to EUR (removed stray USD) | ✅ Done | `formatCurrency`, KPI cards, dashboard, backend reports |
| Property analytics modal (combined Monthly Revenue & Expenses chart) | ✅ Done | `properties/page.tsx` |
| Dead `require_role()` / no-op role checker | ✅ Removed | no longer present in `auth/dependencies.py` |
| Fake ADR/RevPAR arrays | ✅ Removed | metric removed from product |

### 2.2 Outdated recommendations (no longer applicable)

- **"Auth hardening / RBAC / refresh rotation"** — auth was deliberately
  **removed** (decision-log §0.1). The recommendation only reapplies if the
  product becomes a **hosted web SaaS**. Retain as a *conditional* item, not a
  default task.
- **"Fix `require_role()`"** — the dead code is gone.
- **"Route API calls through dynamic base URL"** — done.
- **"Move CSV import into a service"** — done.
- **"AI chat cost (per-intent data path)"** — the **Chat tab was removed** from
  the UI; only the **scenario** endpoint remains hot. The cost concern shifts
  from chat to *scenario + advisor recomputation*.
- **"PDF via `window.print()`"** — superseded by backend WeasyPrint PDF
  (print view retained only as a fallback).

### 2.3 Still missing (carried forward — these are the real backlog)

1. **Category management UI** — **Done** (create/rename/merge expense +
   revenue categories; auto-categorization on create and on description edit).
2. **Real platform connectors** — **Partially done**: iCal connector shipped
   (the Airbnb/Booking calendar-export path); no official host APIs exist.
3. **Import idempotency + encoding/delimiter** — **Done** (natural-key dedupe
   for reservations/revenues/expenses; importer honors `import_encoding` /
   `import_delimiter`). Column-mapping UI still pending.
4. **Notifications engine + report scheduler** — `notify_*`,
   `report_auto_generate`, `report_send_email` settings still unwired.
5. **AI settings honored fully** — `ai_analysis_level`, `ai_language`,
   `ai_enabled` only partially drive generation.
6. **Schema migration strategy for packaged SQLite** — still relies on
   `create_all` (adds tables, never alters).
7. **Settings schema validation / typing** — key-value JSON strings, no
   per-key schema.
8. **AI key handling** — stored **plaintext** in the `settings` table and
   returned raw to the client; no masking/clear.
9. **Analytics/report caching** — portfolio analytics → per-property health is
   N+1; the AI/advisor path recomputes per call.
10. **Pagination + server-side filtering** on growing list endpoints.
11. **E2E UI tests** — pytest covers backend; no Playwright flows.
12. **Backup verification/restore automation + DB integrity check**.
13. **Mixed-currency support** — **Partially done**: per-record `currency`
   column is editable in the finance form and surfaced per-row in the lists
   (display-only; no FX conversion yet).

### 2.4 New technical debt introduced since the audit

| Item | Where | Impact |
| --- | --- | --- |
| **WeasyPrint native deps not bundled** for packaged builds (Pango/Cairo/GDK-PixBuf + PyInstaller data files) | `reports/pdf_service.py`, `hostwise-backend.spec`, build scripts | **PDF export breaks in the installed app** — the flagship export |
| Plain-text AI API key + returned to client | `settings` table / `GET /settings` | Secret exposure on-disk and in browser state |
| Per-record currency absent; all amounts assume one default currency | finance models | Wrong totals for mixed-currency users |
| Settings load race (draft can be overwritten if edited in first second) | `settings-context.tsx` | Rare config loss |
| `clean_db.py` added (helpful) but not wired into UI/docs | `backend/clean_db.py` | Discoverability |
| Feedback stored only locally + mailto | `feedback/page.tsx` | No server-side collection (acceptable for local-first) |

### 2.5 Better architectural alternatives considered (and rejected/kept)

- **Keep the modular monolith.** Microservices add failure modes to a
  single-process desktop app for zero benefit (decision-log §3). No change.
- **Keep Next.js 14.** It gives the web-hosted escape hatch; the App Router
  cost is acceptable. *Only* revisit (Vite) if the web product is dropped.
- **Keep computed-on-demand analytics**, but add a **request-scoped cache**
  instead of materialized KPI tables (avoids invalidation bugs while removing
  N+1). This is a refinement, not a rewrite.
- **SQLite → WAL + online backup API** rather than copy-file backups. Cheap,
  improves consistency, keeps the dual-database story intact.
- **WeasyPrint → keep**, but bundle deps per-OS and keep `window.print()`
  fallback; a headless-Chromium/Electron approach would be heavier and
  contradicts Tauri's footprint goal.

---

## 3. Page-by-page production readiness

| Page | Ready? | Still missing | Improve / Redesign | Coherent? |
| --- | --- | --- | --- | --- |
| **Dashboard** | ✅ Core | Persist the chosen period across visits (optional) | Fine as-is | Yes |
| **Properties** | ✅ Core | Full deep-dive page (modal exists — promote to a route later for shareable links) | Modal chart is good | Yes |
| **Finance** | ✅ Core | **Category management**, bulk edit, recurring-expense flag | CRUD is solid | Yes |
| **Analytics** | ✅ Core | Export the trend chart; deep-link to a property | Expense Trend + compare-prev is the right shape | Yes |
| **Reports** | ✅ Core | Scheduled/email delivery (later); PDF fallback when WeasyPrint absent | Period + PDF export is complete | Yes |
| **AI Advisor** | ✅ Core | Honor all `ai_*` settings; mask keys; data-sent disclosure; caching | Rules+BYOK strategy is right | Yes |
| **Import** | ✅ Core (CSV) | **Idempotency**, encoding/delimiter, column-mapping, rollback report | CSV-only + samples is the right scope | Yes |
| **Settings** | ✅ Core | Secret masking; backup **verification**; category management entry point | Vertical tabs + merges are correct | Yes |
| **Guide** | ✅ Ready | Expand with new-feature guides as they ship | Tabs are right | Yes |
| **Feedback** | ✅ Ready | Optional backend endpoint for server-side collection | Local + mailto is fine for MVP | Yes |

No page needs a redesign. All are coherent with the single product thesis
(profit-driven financial intelligence, local-first). The **only structural
gap** is the **category-management surface**, which is business logic that
today lives only inside the importer.

---

## 4. Architecture review & evolution path

| Requirement | Adequate today? | Gap | Evolution path (no rewrite) |
| --- | --- | --- | --- |
| **Windows / macOS / Linux** | Mostly | Build-script/CI drift; WeasyPrint native deps; signing/notarization not verified | Phase 2 (packaging) + Phase 6 (signing) |
| **Offline-first** | ✅ Yes | — | Keep; never make cloud mandatory |
| **Local database** | ✅ Yes | `create_all` instead of migrations; copy-backups not point-in-time | Phase 2 (Alembic on startup, WAL, online backup API) |
| **AI integration** | ✅ Yes | Plain-text key; N+1 recompute; settings partially honored | Phase 4 |
| **Automatic updates** | Partial | Tauri updater is wired but signing/endpoints/channels unverified | Phase 2/6 |
| **Future cloud sync** | Pre-wired (`sync_id`, soft-delete, Postgres path) | Sync protocol not implemented | Phase 6 (optional, CRDT-ish via `sync_id`+`updated_at`) |

**Evolution path (summary):** stabilize the monolith (Phase 1) → make the
three-OS install/update/PDF path bulletproof (Phase 2) → complete the data &
product surface (Phase 3) → harden AI (Phase 4) → production guardrails
(Phase 5) → commercial + optional cloud (Phase 6). No rewrite at any point.

---

## 5. The Grill 🔥

> Every weakness: **why it's a weakness → impact → priority → recommended
> solution → now or later.**

| # | Decision | Why it's a weakness | Impact | Priority | Solution | When |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Tauri + PyInstaller sidecar (two runtimes)** | Packaging is the whole game and it's fragile: Python startup ~1s, native libs (Pango/Cairo for WeasyPrint), port scan, spec/build-script drift | High — an install that can't start or export breaks trust | **Critical** | Bundle deps per-OS; CI builds installers per OS; keep print fallback; remove build-script drift | **Now** |
| 2 | **WeasyPrint PDF not bundled** | New export is the flagship; it will fail on installed machines | High | **Critical** | PyInstaller data files + system libs; CI smoke-test `/reports/export` per OS | **Now** |
| 3 | **`create_all` instead of migrations** | Upgrading users can't get new columns safely; schema drift | High | **Critical** | Run Alembic on startup with a version table; test upgrade from current DB | **Now** (before v1) |
| 4 | **Settings as unvalidated JSON + plaintext secrets** | Config corruption + exposed AI key | High | **Critical** | Typed settings model; mask/redact secrets; optional OS keychain | Mask **now**, schema **Phase 5** |
| 5 | **Computed-on-demand N+1 (analytics/AI)** | Slow on real portfolios; AI recomputes per call | Medium | **High** | Request-scoped cache + short TTL; cache advisor data per period | **Phase 5** |
| 6 | **No e2e UI tests** | Regressions slip through (we hit flaky browser interactions) | Medium | **High** | Playwright: 8 core flows | **Phase 5** |
| 7 | **Single default currency** | Mixed-currency portfolios compute wrong totals | Medium | **Medium** | Per-record currency column + display conversion; FX later | **Phase 3** |
| 8 | **Auth removed** | Cost only if hosted SaaS later | Low (unless hosted) | **Medium** | Keep retired module as reference; treat hosted as a separate product | Only if hosting |
| 9 | **SQLite copy-file backups** | Not point-in-time consistent | Low (single user) | **Low** | WAL + `sqlite3.Connection.backup()` | **Phase 2** (cheap) |
| 10 | **Soft-delete + `sync_id` unused** | Row growth; no cleanup; sync never implemented | Low | **Low** | Cleanup policy; implement sync when cloud ships | Later |
| 11 | **Next.js 14 in a webview** | Heavier than a pure SPA; SSR mostly unused | Low | **Low** | Keep (web escape hatch); revisit only if web is dropped | Never/revisit |
| 12 | **AI key sent to any configured base URL** | User could paste into a non-OpenAI endpoint; no scope guard | Medium | **Medium** | Validate base URL host allowlist on save; show "data sent" preview | **Phase 4** |

---

## 6. Roadmap phases

### Phase 1 — Architecture Stabilization

**Goal.** Make the codebase clean, consistent, and cheap to change before
layering on product work. **Why now.** Every later phase touches these files;
debt here compounds. Mostly low-risk, mechanical.

| # | Recommendation | Why | Problem solved | Business impact | Technical impact | Depends on | Risks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | Ruff cleanup (unused imports, `Optional[X]`→`X\|None`, `collections.abc.Sequence`) | ~35 unused imports + dead symbols from the audit | Faster review, fewer surprises | None visible (internal) | Big diff, all mechanical | None | Diff noise — isolate in one commit |
| 1.2 | Remove residual dead code (unused `soft_delete`/`count`/`sync_id` writers, unused auth-adjacent imports) | Audit §1.2/§1.3 | Smaller surface | None | Removes ambiguity | 1.1 | Ensure no hidden callers — grep first |
| 1.3 | Tighten broad `except Exception` blocks (auth, connectors, main) | Masks `KeyboardInterrupt`/`SystemExit`; hides bugs | Clearer failures | Fewer silent data/ops errors | Small, careful edits | None | Low |
| 1.4 | Frontend type-safety pass (kill residual `any`, unused `isRestoring`) | Audit §2 | Fewer runtime bugs | Fewer support tickets | Moderate | None | None |
| 1.5 | Add `clean_db.py` to maintenance + document it | New script is undiscoverable | Standardized clean/reset | Self-service reset | Small | None | Destructive — require confirm |

**Technical tasks.** Run `ruff check --fix`; add a `Makefile`/script for
`lint`/`test`; one commit per concern. **Expected outcome.** Green lint,
37+ tests, no dead symbols in hot paths. **Definition of Done.** `ruff check`
clean; no unused imports/dead code in the modules the audit flagged; tests
pass; `clean_db.py` documented.

---

### Phase 2 — Desktop Foundation

**Goal.** The installed product works on all three OSes: starts, updates,
exports, and upgrades its DB safely. **Why now.** Nothing else matters if the
app can't run where users actually run it.

| # | Recommendation | Why | Problem solved | Business impact | Technical impact | Depends on | Risks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2.1 | Bundle WeasyPrint (PyInstaller data files + Pango/Cairo/GDK-PixBuf per OS) + CI smoke-test `/reports/export` | The PDF export is the flagship and will break packaged | PDF works in the installed app | Core deliverable ships | Spec + build scripts + CI matrix | Phase 1 | Native lib version drift per OS |
| 2.2 | Alembic migrations on startup (versioned) instead of `create_all` only | Upgrading users need safe schema changes | No broken upgrades | Trust in updates | Medium; DB-version table + boot migrator | None | Migration bugs on old DBs — test from current dump |
| 2.3 | Sync build scripts with CI; remove stale PyInstaller spec or pin it; AUR version automation + checksums | Audit §3/§4 — drift causes release breakage | Reliable releases | Faster, safer releases | Medium | None | Low |
| 2.4 | SQLite WAL + online backup API + `PRAGMA integrity_check` in maintenance | Copy-backups aren't consistent; no integrity signal | Safer backups, diagnosable DBs | Confidence | Small | None | WAL file juggling — test |
| 2.5 | Verify auto-update end-to-end (signing, stable/beta channel, release notes) + logging to file wired to `/maintenance/logs` | Update + supportability are table-stakes | Users get fixes; we can debug | Retention | Medium (signing certs) | 2.3 | Code-signing certs/notarization |

**Expected outcome.** Installers on Win/macOS/Linux; PDF export works packaged;
DB upgrades without data loss; auto-update E2E; logs on disk. **DoD.**
Green CI matrix; one packaged smoke test per OS (start → health → import →
report PDF → update); migration from the current DB succeeds.

---

### Phase 3 — Core Product Completion

**Goal.** Finish the promised product surface and close the data-accuracy
gaps. **Why now.** These are the features hosts actually ask for.

| # | Recommendation | Why | Problem solved | Business impact | Technical impact | Depends on | Risks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3.1 | **Category management UI** ✅ Done (create/rename/merge expense + revenue categories) | The #1 data-accuracy gap; categories exist only via import | "Where does money go" becomes trustworthy | Higher insight quality, retention | Backend CRUD + UI; reuse category models | Phase 2 (migrations) | Merge semantics — keep soft-delete |
| 3.2 | **Per-record currency** ✅ Done (editable per-row currency; display-only, no FX) | Mixed-currency hosts compute wrong totals | Correct multi-currency books | Real correctness for global users | Schema + formatting changes | 2.2 | FX handling — keep display-only, no auto-convert in v1 |
| 3.3 | **Import idempotency + encoding/delimiter** ✅ Done (column-mapping UI deferred) | Duplicate imports corrupt data; settings unused | Safe re-imports | Data integrity | Service-level dedupe by natural key | 2.2 | Defining the natural key per type |
| 3.4 | **iCal connector** ✅ Done — Airbnb/Booking calendar-export path (no official host API) | Product story is "analytics over booking data"; CSV-only limits it | Feeds data automatically | Retention, less manual entry | `ConnectorRegistry` + iCal parser + sync UI | 2.2 | Scrape/API ToS — prefer official APIs |
| 3.5 | **Notifications + report scheduler** ✅ Done — in-app notifications engine wired to `notify_*` settings; `refresh()` is the local scheduler tick (deduped by fingerprint, partial unique index) | Settings already promise them | Proactive insights | "The app tells me" | Lightweight scheduler + email (local SMTP/OS) | 2.2 | Email delivery needs a server — keep local notify first (email still planned) |
| 3.6 | **Property deep-dive route** ✅ Done — `/properties/[id]` reusing `/analytics/property/{id}` + health; "View analytics" link on property cards | Promote property modal → optional deep-dive route | Shareable, book-markable analytics | Better UX on problem properties | Small | New route reusing `/analytics/property/{id}` | None | None |

**Expected outcome.** Categories manageable; correct multi-currency display;
safe re-imports; at least one automatic connector; scheduled/notify basics.
**DoD.** 3.1–3.6 shipped with tests; mixed-currency report shows correct
per-currency totals; importing the same file twice inserts once.

**Executed so far (3.1–3.6).** Category manager UI + auto-categorization on
create and on description edit; per-record currency (editable + per-row
badge, display-only); idempotent CSV/JSON import (natural-key dedupe for
reservations by confirmation code, revenues by property+date+amount+source,
expenses by property+date+amount+vendor+category) with `import_encoding` /
`import_delimiter` honored; iCal connector (`POST /connectors/ical/upload` +
`/import`) that turns Airbnb/Booking calendar VEVENTs into reservations and
skips re-imported UIDs; in-app **notifications engine** (`/api/v1/notifications`)
wired to the `notify_*` settings — profit-drop / revenue-up / occupancy-fall /
backup-done / report-ready events, deduped by fingerprint with a partial
unique index, bell UI in the app shell, Notifications settings tab;
**property deep-dive route** `/properties/[id]` with KPI cards, health badge
and a monthly revenue/expense chart, linked from each property card.
Remaining: column-mapping UI, then Phase 4 (AI).

---

### Phase 4 — AI Integration

**Goal.** The AI surface is trustworthy, fast, private, and fully
configurable. **Why now.** AI is the differentiator; trust is the gate.

| # | Recommendation | Why | Problem solved | Business impact | Technical impact | Depends on | Risks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4.1 | **Honor `ai_analysis_level`, `ai_language`, `ai_enabled`** ✅ Done — `ai_analysis_level` trims report depth (summary vs detailed/expert); `ai_language` steers the BYOK LLM and is surfaced on the report; `ai_enabled` gates BYOK | Settings exist but are half-wired | Predictable AI behavior | Personalization | Medium | None | None |
| 4.2 | **Cache the advisor path** ✅ Done — short-TTL in-process cache keyed by period + data fingerprint + AI settings | Advisor + scenario recompute everything | Fast AI on real portfolios | Responsiveness | Medium; cache keyed by period+data fingerprint | None | Staleness — short TTL |
| 4.3 | **Mask/clear AI key + validate base URL + "what data is sent" note** ✅ Done — key masked in `GET /settings` (round-trip safe), clear button, http(s)-only base-URL guard, privacy note in AI settings | Plaintext key + any-host proxy is a trust risk | Privacy & safety | Higher trust | Settings UI + provider guard | Phase 1.4 | None |
| 4.4 | **Strict LLM JSON parsing with rules fallback** ✅ Done — `_extract_json` handles fences/trailing commas; any failure → rules engine | Malformed LLM JSON must never break the page | Resilience | Reliability | Small (already conservative merge — strengthen) | None | None |
| 4.5 | **Scenario uses cached data path** ✅ Done — annual report cached (same TTL + fingerprint) | Only hot endpoint left after chat removal | Cheaper scenarios | Faster "what-if" | Medium | 4.2 | None |

**Expected outcome.** AI honors config, runs from cache, protects the key, and
never breaks on bad LLM output. **DoD.** Advisor/scenario served from cache in
E2E test; key masked in UI and absent from logs; a malformed-LLM test asserts
rules fallback.

**Executed so far (4.1–4.5).** `ai_analysis_level` (summary trims the report;
detailed/expert are full depth) and `ai_language` (passed to the BYOK LLM and
surfaced as `report["language"]`) are honored; advisor + scenario use a 60s
TTL cache keyed by period + a data fingerprint (counts + max updated_at of
the business tables) so imports invalidate it automatically; `ai_api_key` is
masked on every public settings read (`GET /settings`) and round-trips safely
(server keeps the real key), can be cleared, and `ai_base_url` must be a valid
http(s) URL; LLM replies are parsed strictly (`_extract_json` — fences +
trailing commas) with guaranteed rules fallback; the AI Settings tab now shows
a "what data is sent" privacy note. Remaining: column-mapping UI, then
Phase 5 (production readiness).

---

### Phase 5 — Production Readiness

**Goal.** Correctness, security, operations, and scaling guardrails before
broad distribution. **Why now.** Sensitive financial data + real users.

| # | Recommendation | Why | Problem solved | Business impact | Technical impact | Depends on | Risks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5.1 | **Playwright e2e suite (8 core flows)** ✅ Harness + flows added — `frontend/e2e/` + `playwright.config.ts`, run with `bun run e2e` (servers up); dashboard flow validated green locally; full-suite CI run is the remaining bit | Backend-only tests miss UI regressions | Confident releases | Trust | Medium; CI runner | Phase 2 CI | Flaky selectors — use stable text/role selectors |
| 5.2 | **Analytics/report caching + pagination** ✅ Done — `/analytics/portfolio` + `/property/{id}` cached (60s TTL, data-fingerprint keyed); finance + properties lists already support `skip`/`limit` pagination | N+1 + unbounded lists at scale | Fast on large portfolios | Retention at scale | Medium | 4.2 | Cache invalidation — key by period + fingerprint |
| 5.3 | **Settings typed schema + secret redaction + CORS audit** ✅ Done — per-key `SETTINGS_SCHEMA` validation (bool/number/int/enum, 422 on bad values); API key masked (4.3); `/maintenance/status` reports CORS + default-JWT-secret audit; startup logs security warnings in production | Config corruption + secret exposure | Safe config | Operational safety | Medium | 1.x | None |
| 5.4 | **Backup verify/restore + soft-delete cleanup** ✅ Done — `verify_backup` (quick_check) + `POST /backups/{name}/verify`; restore endpoint existed; `POST /maintenance/cleanup?days=` permanently purges old soft-deleted rows (children-first, per-table safety); `/maintenance/status` verifies the newest backup | Recoverability + row growth | Guaranteed recovery | Confidence | Small | 2.4 | None |
| 5.5 | Async report/AI generation with polling for heavy payloads | Expensive payloads block requests | UX on big data | Retention | Medium | 5.2 | Remaining — local single-user + caching largely mitigate the blocking cost |

**Expected outcome.** e2e green; lists fast; settings safe; recovery
verifiable. **DoD.** 8 e2e flows green in CI; pagination + caching benchmarked;
secret never in logs; restore-from-backup test passes.

**Executed so far (5.1–5.4).** Playwright harness + 8 core-flow specs
(dashboard/properties/finance/analytics/ai/reports/import/settings) with a
stable-selector style and `domcontentloaded` navigation for Next dev;
analytics endpoints cached; `SETTINGS_SCHEMA` typed validation with 422 on bad
values; CORS + default-JWT-secret audit surfaced in `/maintenance/status` and
as production startup warnings; `verify_backup` + cleanup endpoint + latest-
backup verification in the Maintenance screen. Remaining: full e2e CI run,
5.5 async heavy-payload generation, column-mapping UI, Phase 6 (commercial).

---

### Phase 6 — Commercial Release

**Goal.** Ship, distribute, and monetize; deliver the "cloud-optional"
promise. **Why now.** The product is complete and hardened.

| # | Recommendation | Why | Problem solved | Business impact | Technical impact | Depends on | Risks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 6.1 | Licensing/activation (offline) | Monetization | Sustainable business | Revenue | Medium; signed license keys validated offline | 2.5 | Piracy — balance friction |
| 6.2 | Code signing + notarization + stable/beta channels + changelog | Distribution trust | Safe installs/updates | Adoption | Medium | 2.5 | Cert costs/process |
| 6.3 | Opt-in crash reporting (privacy-first) | Supportability without telemetry | Faster fixes | Trust | Small | None | Consent UX |
| 6.4 | Optional **cloud sync** via `sync_id` (server = existing Postgres path) | The "data everywhere" promise | Multi-device | Upsell/retention | Large; CRDT-ish ordering on `sync_id`+`updated_at` | 5.x | Conflict resolution — start append-only |
| 6.5 | Documentation site + expanded in-app guide | Onboarding | Faster activation | Activation | Medium | None | None |
| 6.6 | (Stretch/Enterprise) Organizations/RBAC/SSO + email report delivery | Agencies/institutions | TAM expansion | Growth | Large | 6.4 | Multi-tenant scope creep |

**Expected outcome.** A signed, licensed, self-updating desktop product with
optional sync and a docs site. **DoD.** v1.0 released on all three OSes;
licensing works offline; sync beta opt-in; docs published.

**Executed so far (6.0 desktop shell + CI).** Created the **Tauri v2 shell**
(`frontend/src-tauri/`: `Cargo.toml`, `tauri.conf.json`, `build.rs`,
`capabilities`, icons, `src/main.rs` + `lib.rs` + `backend.rs`). The shell
spawns the Python backend — the repo venv launcher in dev, the PyInstaller
bundle (`resources/hostwise-backend`) in release — waits for the API port,
exposes `get_backend_url` to the webview, and stops the backend on window
close (`cargo check` passes). Frontend builds as a static export for Tauri:
re-enabled `output: 'export'`, moved the property deep-dive to a static route
(`/properties/detail?id=…`) and fixed three pre-existing TS errors so the
build is clean. **Separate GitHub Actions workflows per OS** bundle the
backend (PyInstaller), export the frontend, and build the installer:
`.github/workflows/build-windows.yml` (NSIS), `build-macos.yml` (dmg,
signing/notarization stubbed), `build-linux.yml` (AppImage + deb + WeasyPrint
system libs). Added `docs/BUILD.md` + `scripts/build-backend.sh`. Remaining
(6.x): licensing/activation, real code-signing certs, opt-in crash reporting,
optional cloud sync (deferred per decision — "cloud not now"), docs site.

---

## 7. Sequencing summary (the answer)

```
Now (Phase 1–2):  stabilize code → package PDF/migrations/build → 3-OS install/update/export
Next (Phase 3–4): categories → currencies → idempotent import → iCal → notifications
                  → honor AI settings → cache AI → mask keys → safe LLM fallback
Before release (Phase 5): e2e tests → caching/pagination → settings schema → backup verification
Release (Phase 6):        licensing → signing → opt-in crash reports → optional cloud sync
```

**Cut line for v1.0:** everything through Phase 5. **Not in v1.0:** cloud
sync, organizations/RBAC/SSO, hosted SaaS (auth), enterprise tax/owner
statements. **Never:** a rewrite, stored KPI tables, or making the cloud
mandatory.

---

*Built on the existing audit and decision log. Re-verified against the
codebase Aug 4, 2026. This roadmap supersedes the earlier `roadmap.md` phase
labels but keeps its "deliberate vs. accidental" spirit.*
