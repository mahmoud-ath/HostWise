# Settings Audit (`/settings`)

## Purpose

> **v2 update:** The page is now a **vertical tab sidebar** with 8 tabs —
> Business, AI Settings, Appearance, Security, Backup & Restore, Data Import,
> Maintenance, About HostWise. **Profile and Business are merged** into one
> "Business" tab (identity = business name only; email, country, default
> currency, language, tax rate, fiscal year start), and **Maintenance and
> Developer are merged** (database housekeeping + backend diagnostics in one
> tab). The old Dashboard/Reports/Notifications sections and the standalone
> Account/Developer components were removed. AI is a BYOK connection UI
> (provider, API key, base URL, model, “Test Connection”). Security offers
> **Export all** (`.xls`) and **Delete all data** (wipe, keeps settings).
> Backup gained an **Upload** (`.db`) button.

The Settings page is the **configuration and housekeeping center**. It exists
so a host can tailor HostWise to their business (currency, tax rate, AI
behavior, appearance, dashboard defaults) and operate it (backups, maintenance,
diagnostics).

It solves two problems: **personalization** (make the tool match the business)
and **operability** (keep the local-first app healthy — back up data, optimize
the DB, read logs when something breaks).

## Business Objective

After visiting, the user should be able to:
- Set the business identity and tax context that **propagate into reports**.
- Choose appearance/theme and dashboard defaults.
- Understand backup health and restore if needed.
- Run maintenance (optimize, clear cache, reset demo data) and read logs.

## Workflow

```mermaid
sequenceDiagram
    participant U as Host
    participant S as Settings page
    participant C as SettingsProvider
    participant API as FastAPI
    participant DB as Database

    U->>S: opens /settings
    S->>C: provider loads GET /settings on mount
    C->>API: GET /settings
    API->>DB: read settings (defaults merged with stored)
    API-->>C: settings map
    C-->>S: values rendered
    U->>S: change a setting (e.g., tax rate)
    S->>C: updateSetting('tax_rate', 20)
    C->>C: optimistic update + apply appearance side-effects
    C->>API: PUT /settings
    API->>DB: upsert
    U->>S: view backups / optimize / logs (separate queries)
    S->>API: GET /backups/status, GET /maintenance/status, etc.
```

## Components

| Component | Responsibility |
| --- | --- |
| `BusinessSection` | **Merged Profile+Business**: business name, email, country, default currency, language, tax rate, fiscal year start |
| `AISection` | Provider, enabled, analysis level, auto-analysis, language (BYOK: key, base URL, model, Test Connection) |
| `AppearanceSection` | Theme, accent swatches, compact mode, animations |
| `SecuritySection` | Export all (.xls), delete all data (keeps settings); password/sessions/2FA placeholders |
| `BackupSection` | Status cards + create/restore/download/upload (.db)/delete |
| `ImportSection` | CSV encoding, delimiter, date format |
| `MaintenanceSection` | **Merged Maintenance+Developer**: DB size/optimize, clear cache, view logs, reset demo data, backend status, API URL, restart backend, copy diagnostics |
| `AboutSection` | Version, license, updates |

> Removed: `AccountSection` (merged into Business), `DeveloperSection` (merged
> into Maintenance), `DashboardSection`, `ReportsSection`, `NotificationsSection`.

## Hooks / Context

- `SettingsProvider` (context) — `get`, `updateSetting`, `updateSettings`,
  `ready`; applies theme/accent/compact/animations live.
- `useBackupStatus()`, `useMaintenanceStatus()`, `useOptimizeDatabase()`,
  `useResetDemoData()`, `useBackendLogs()`.
- `useBackend()` (developer section), `useAuth()` (profile).

## API Calls

| Endpoint | Why it belongs here |
| --- | --- |
| `GET/PUT /settings` | The settings store (backend honors it: reports currency/tax). |
| `GET /backups/status` | Backup schedule overview. |
| `GET /backups/`, `POST /backups/create`, `POST /backups/restore/{n}`, `GET /backups/download/{n}`, `DELETE /backups/{n}` | Backup lifecycle. |
| `GET /maintenance/status` | DB size + storage overview. |
| `POST /maintenance/optimize` | VACUUM. |
| `GET /maintenance/logs` | Read backend logs. |
| `POST /maintenance/reset-demo-data` | Clear transactional demo data. |

## State Management

- **Settings**: `SettingsProvider` context — one global store, optimistic
  writes, appearance applied via side-effects on `document.documentElement`.
- **Backup/maintenance**: React Query (server state) with mutations.
- **Local**: collapsible sections, log viewers.

## User Journey

```
Open /settings
  ↓
Business (name, email, currency, language, tax rate, fiscal year)
  ↓
AI Settings (enable / connect your own LLM — DeepSeek, OpenAI, …)
  ↓
Appearance (pick theme + accent → whole app changes live)
  ↓
Security (export all / delete all data)
  ↓
Backup & Restore (last backup, storage) — create/restore if needed
  ↓
Data Import (CSV defaults)
  ↓
Maintenance (optimize DB, clear cache, read logs, restart backend, copy diagnostics)
```

## Relation With Other Pages

- **Reports / AI Advisor:** settings **feed them** (default currency, tax rate,
  AI language/level). This is the clearest cross-page data flow: Settings
  → store → reports tax summary & currency.
- **Dashboard:** dashboard preferences + default currency should drive the
  dashboard (partially implemented — see debt).
- **AppShell:** `SettingsProvider` is mounted globally; `BackendProvider`
  status drives the developer section; theme/accent apply app-wide.

## Architectural Decisions

- **Backend settings store (not just localStorage)** — so the backend can honor
  them (reports currency/tax). LocalStorage-only would make settings cosmetic.
- **Key-value JSON store with defaults merged server-side** — new settings need
  no migration.
- **SettingsProvider as global context** — one read, applied everywhere;
  appearance side-effects centralized.
- **Destructive actions are double-confirmed** (reset demo data) and scoped
  (never touches properties/users/settings).
- **Backups are file-copy + VACUUM with rotation** — simple and local.

## Strengths

- Settings genuinely affect the product (currency/tax reach reports).
- Local-first operations (backups, restore, maintenance) are first-class.
- Appearance is applied live via CSS variables — instant feedback.
- Developer diagnostics are tucked away but complete.

## Weaknesses

- Some settings are stored but **not yet consumed** (dashboard prefs,
  notifications, report auto-generate, AI analysis level/language).
- No notifications engine / scheduler yet.
- Security actions (change password, export/delete account) are placeholders.

## Technical Debt

- Backend `settings` values are JSON strings with no per-key schema validation.
- `SettingsProvider.load()` could theoretically overwrite an optimistic change
  if a user edits within the first second (minor race).
- Dead `components/layout/backup-settings.tsx` superseded by `BackupSection`.

## Future Evolution

- Wire stored settings into their consumers (dashboard prefs, notifications,
  scheduler, AI level/language, email reports).
- Add a notifications engine and a report scheduler (using stored
  `report_auto_generate`/`report_send_email`).
- Per-key validation + typing for settings.
- Multi-tenant organization settings (business identity → `organizations`).
