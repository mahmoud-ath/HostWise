# HostWise — Improvement Roadmap

> Improvements are **classified by phase**, not rewritten. Each item explains
> *what*, *why now (or not now)*, and *business value*.

Phases:
- **Immediate** — cheap, high-value, low-risk fixes that should happen now.
- **After MVP** — the next product milestone (post-local-beta).
- **Production** — required before broad distribution / sensitive data.
- **Scaling** — as data volume or user count grows.
- **Enterprise** — multi-tenant / institutional needs.

---

## 1. Immediate

Low effort, high value, no architecture change.

| Item | Why | Business value |
| --- | --- | --- |
| ~~Replace **fake ADR/RevPAR arrays** in the Analytics page~~ — ✅ **Done (v2)** — occupancy/ADR/RevPAR were removed from the product entirely | Fake numbers misled users | Trust |
| ~~Add **edit/delete** for revenue, expense, property~~ — ✅ **Done (v2)** — full CRUD in `/finance` and `/properties` | Correcting mistakes without re-import | Data accuracy |
| **Category management** (create/rename expense categories + UI) | Uncategorized data cripples expense analysis | Better "where money goes" insight |
| ~~Dashboard → **shared `use-api` hooks** + honor `default_currency`~~ — ✅ **Done (v2)** | Consistency; currency now a setting | Dashboard matches the rest of the app |
| ~~Route API calls through the **dynamic base URL** (stop hardcoding `localhost:8000`)~~ — ✅ **Done (v2)** — `api.upload()` + `getApiHost()` used in import/backup/export | Breaks in packaged app if port differs | Packaged desktop reliability |
| ~~Replace frontend **`any`-typing** in hooks~~ — ✅ **Done (v2)** | Type safety | Fewer runtime bugs |

## 2. After MVP (next product milestone)

Features that complete the promised product.

| Item | Why now | Business value |
| --- | --- | --- |
| **Real connectors** — iCal ✅ Done (Airbnb/Booking calendar-export path, `/connectors/ical/*`); official APIs for Airbnb/Booking/VRBO don't exist for hosts, so iCal is the supported route | The product story is "analytics over booking data" — connectors feed it | Removes manual CSV entry; retention |
| ~~**Notifications engine** + report scheduler wired to stored settings~~ — ✅ **Done (v3)** — in-app notifications (`/api/v1/notifications`): profit-drop / revenue-up / occupancy-fall / backup-done / report-ready, deduped by fingerprint + partial unique index; bell UI + Settings tab; `report_send_email` still planned (in-app first) | Settings already define them | Proactive insights |
| ~~Honor **AI settings**~~ — ✅ **Done (v4)** — `ai_analysis_level` trims report depth, `ai_language` steers the BYOK LLM + report, `ai_enabled` gates BYOK; advisor + scenario served from a short-TTL cache keyed by period + data fingerprint | Settings exist but were half-wired | Personalization |
| ~~**LLM swap** behind the existing AI interface (OpenAI/Claude/Ollama), rules as offline fallback~~ — ✅ **Done (v2)** as BYOK (`ai_api_key`/`ai_base_url`/`ai_model` + `/ai/test-connection`) | The seam exists; LLMs give richer chat/scenarios | Flagship feature upgrade |
| ~~Make **import settings** actually used~~ — ✅ **Done (v3)** — `ConnectorService` honors `import_date_format`, `default_currency`, `import_encoding` and `import_delimiter`; JSON supported; imports are **idempotent** (natural-key dedupe, re-imports skip); remaining: column-mapping wizard | Stored but unused | Better import reliability |
| Per-property **deep-dive** page (uses existing `/analytics/property/{id}`) | Data exists, UI doesn't | Clarity on problem properties |
| ~~**Optimize AI cost:** request-scoped analytics caching~~ — ✅ **Done (v4)** — advisor + scenario cached (60s TTL, data-fingerprint invalidated); chat reuses the cached advisor report | Chat recomputed everything per question | Responsiveness on real portfolios |

## 3. Production (before broad distribution)

Correctness, security, and operational safety.

| Item | Why | Business value |
| --- | --- | --- |
| ~~**Test suite**~~ — ✅ **Done (v2)** — pytest + pytest-asyncio + faker, 36 tests (`backend/tests/`) covering setup/profile, finance CRUD + reports, properties, analytics (no-occupancy checks), AI advisor, settings export/wipe, connectors (CSV+JSON), auth-free. Still to add: e2e UI flows | Was the biggest risk | Confidence to ship |
| **Auth hardening**: enforce `UserRole` (RBAC), refresh rotation, logout, login rate-limit | App is intentionally auth-free (local single-user); re-enter only if hosted | Security for real users |
| **Schema migration strategy** for packaged SQLite (version + patch) instead of relying on `create_all` | `create_all` only adds tables | Safe upgrades across versions |
| **Validation/typing for settings** values | JSON strings, no schema | Prevent config corruption |
| Restore safety checks + import **idempotency** (avoid duplicate imports) | Prevent data corruption | Data integrity |
| Backend **logging to file** + wire to `/maintenance/logs` in packaged builds | Dev logs go to stdout | Supportability |

## 4. Scaling

When data volume / portfolio size grows.

| Item | Why | Value |
| --- | --- | --- |
| **Analytics recomputation caching** (request-scoped or short TTL) + report caching (`rendered_at`) | Portfolio analytics → per-property health → per-property analytics is N+1 and slow at scale | Keeps pages fast on large portfolios |
| **Pagination + server-side filtering** on list endpoints (PaginatedResponse exists) | Lists unbounded | Responsive lists |
| Background **async report/AI generation** with polling | Expensive payloads block requests | UX on big data |
| **Materialized / read-model** aggregates only if measured need | CID stays the source of truth | Speed without staleness |

## 5. Enterprise

Multi-tenant / institutional needs.

| Item | Why | Value |
| --- | --- | --- |
| **Organizations tenant boundary** (`business_name` setting is the seed) | Agency/multi-user mode | One instance, many portfolios |
| **Cloud sync** via the pre-existing `sync_id` columns | Multi-device, cloud-optional promise | Data everywhere |
| **RBAC + audit logs + SSO** | Agencies and institutions | Governance |
| **Advanced tax/accounting export**, payout reconciliation, owner statements | The "hosts use this every year" promise | Retention, professional users |
| **Email delivery of reports** | Scheduled reports | Automated owner reporting |

---

## What NOT to change (deliberate architecture)

- Computed-on-demand analytics (no stored KPI tables without a measured reason).
- Service/repository/schema layering and the "no logic in routers" rule
  (except the known CSV-import exception, which should be moved into a service).
- The AI interface (`analyze/advisor/chat/scenario`) — it's the LLM seam.
- Soft-delete + `sync_id` conventions.
- Local-first data ownership and the dual-database switch.
