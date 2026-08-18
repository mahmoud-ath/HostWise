# HostWise — Rust Backend Rewrite (adapted engineering prompt)

This is the rewrite prompt you provided, **adapted to HostWise's actual codebase**.
It is the spec to fully replace `backend/` (Python/FastAPI) with native Rust.
It is written so any senior Rust/Tauri engineer (or a coding agent) can execute
it without guessing.

---

## Goal

Replace the entire Python backend (`backend/`) with a **native Rust backend**
that ships inside the existing Tauri v2 desktop app. Remove Python, PyInstaller,
and every external runtime. The desktop app must build and run on Windows 10/11,
macOS, and Linux with **no Python and no external runtime** installed.

The user's hard requirement: **the end customer (non-technical) double-clicks
the installer and the app just works** — no Defender warnings, no missing
runtimes, no console windows, no manual setup.

---

## Non-negotiables

1. **Keep the existing UI and functionality unchanged.**
2. **Remove Python completely** once the Rust backend is feature-equivalent:
   delete `backend/`, `launcher.py`, `hostwise-backend.spec`, `import_csv.py`,
   `requirements.txt`, `alembic/`, and the PyInstaller packaging in CI.
3. **No external runtime**: no Python, no GTK/Pango (WeasyPrint), no node child.
   Everything must be statically linked / embedded.
4. **Offline-first, local-first**: data lives on the user's machine
   (`%APPDATA%\HostWise\hostwise.db` on Windows).
5. **Cross-platform**: Windows 10/11 (primary), macOS, Linux.
6. **Async** (`tokio`) where it matters; idiomatic, modular Rust.

---

## What exists today (ground truth)

- **Backend:** Python 3.12 + FastAPI 0.115 + SQLAlchemy 2.0 + Alembic, packaged
  with PyInstaller (onedir) → `hostwise-backend.exe`, launched as a child
  process by the Tauri Rust shell, killed on app close, killed by NSIS hooks on
  install/uninstall.
- **REST contract:** `/api/v1/*` for all domains; `GET /api/health` for health.
- **Auth:** JWT (HS256, `python-jose`), bcrypt password hashing, access token
  (60 min) + refresh token (30 days), `sub` claim = user UUID.
- **DB:** SQLite (desktop) via `aiosqlite`; optional PostgreSQL via `asyncpg`.
- **AI:** `app/ai/providers.py` (OpenAI/Anthropic via HTTP), `app/ai/rules.py`
  (rule-based fallback), `app/ai/cache.py`.
- **Reports/PDF:** `app/reports/pdf_service.py` uses **WeasyPrint** (needs
  GTK/Pango) — lazy-imported, degrades to 503 when absent.
- **Connectors:** CSV import + iCal sync (`app/connectors/ical.py`).
- **Desktop runtime (`launcher.py`):** forces `DATABASE_TYPE=sqlite`, sets
  `SQLITE_PATH` to the platform app-data dir, sets CORS to allow
  `tauri://localhost`, cleans stale PyInstaller `_MEI*` temp dirs, fixes the
  windowed `sys.stdout=None` problem.

### Module map (must be ported)

| Domain | Python module | Key behavior |
|---|---|---|
| auth | `app/auth/*` | register, login, refresh, me, update profile; JWT + bcrypt |
| properties | `app/properties/*` | CRUD properties + listings (soft delete) |
| reservations | `app/reservations/*` | bookings CRUD |
| finance | `app/finance/*` | revenues/expenses, categories |
| analytics | `app/analytics/*` | KPIs, dashboards |
| reports | `app/reports/*` | financial reports + PDF export |
| ai | `app/ai/*` | OpenAI/Anthropic calls + rules + cache |
| settings | `app/settings/*` | app settings |
| maintenance | `app/maintenance/*` | maintenance tasks |
| notifications | `app/notifications/*` | in-app notifications |
| connectors | `app/connectors/*` | iCal sync + CSV import |
| setup | `app/setup_router.py` | first-run wizard |
| backup | `app/backup_router.py` / `backup_service.py` | DB backups |
| core | `app/core/*` | config, database, migrations, deps |
| shared | `app/shared/*` | base model/repository, exceptions, schemas |

---

## Target architecture (decision: embedded HTTP server, not Tauri commands for data)

**Recommended: run an `axum` HTTP server INSIDE the Tauri process.**

- The frontend already talks REST over HTTP to `/api/v1` with an auth token
  (`frontend/src/lib/api.ts`). **Keeping the same HTTP contract means the UI and
  the entire frontend data layer stay unchanged.**
- The Rust shell starts the axum server in-process (no child process → no
  Defender false positive, no DLL issues, no PyInstaller, no port-coordination
  dance). It binds `127.0.0.1:<free port>`, stores the URL in managed state,
  and the existing `get_backend_url` command keeps returning it.
- **Tauri commands are reserved for desktop-native actions only** (open folder,
  shutdown, etc.). Do NOT move REST endpoints to `#[tauri::command]` — that
  would force rewriting the entire frontend `api.ts` client, violating
  "keep the UI unchanged."

**Alternative (only if you deliberately want it):** full `#[tauri::command]`
replacement of the API — acceptable only if the frontend data layer is rewritten
to `invoke()` calls in the same change. Higher risk; not recommended.

---

## Rust stack (recommended)

- `tokio` (full), `axum` 0.8 (router, extractors), `tower-http` (CORS, gzip, trace)
- `sqlx` 0.8 (`runtime-tokio`, `sqlite`, `migrate`, bundled sqlite) — async DB;
  schema via `sqlx::migrate!` (replaces Alembic)
- `jsonwebtoken` 9 (JWT HS256), `argon2` 0.5 (replaces bcrypt), `rand`
- `serde` / `serde_json`, `uuid` v4, `chrono`
- `reqwest` (rustls) — AI provider calls
- `printpdf` (pure-Rust PDF) — replaces WeasyPrint; HTML→PDF requires a pure-Rust
  engine or a minimal native report layout; **no external runtime allowed**
- `tracing` / `tracing-subscriber` — structured logs
- `thiserror`, `anyhow`, `dotenvy`, `async-trait`

**Placement:** a new crate `backend-rs/` (library + small `main.rs` bin for
standalone dev/test), added as a dependency of `frontend/src-tauri`. Run it with
`axum::serve` inside Tauri `setup()`, or spawn a tokio task in the Tauri process.

---

## Runtime behavior to preserve

1. **Dynamic port**: prefer 8000, else OS-assigned; pass to the server; the
   frontend gets the live URL (keep `BackendUrl` state + `get_backend_url`).
2. **Health**: `GET /api/health` returns `{ status, version, database }`.
3. **Data dir**: `%APPDATA%\HostWise` (Windows), `~/Library/Application Support`
   (macOS), `$XDG_DATA_HOME` (Linux); DB at `<data_dir>/hostwise.db`.
4. **CORS**: allow `http://localhost:3000`, `http://127.0.0.1:3000`,
   `tauri://localhost`, `https://tauri.localhost`.
5. **No console window on Windows**; logs via `tracing` to a file + stdout.
6. **Kill-on-close**: server shuts down when the last window closes (it is
   in-process, so this is automatic).
7. **Soft deletes** for entities (properties, etc.) via `deleted_at`.

---

## Migration strategy (do NOT break the working app)

1. Build `backend-rs/` **alongside** `backend/` (Python stays until parity).
2. Implement + test each domain in Rust (order: core → auth → properties →
   reservations → finance → analytics → settings → maintenance → notifications
   → connectors → setup → backup → ai → reports/PDF).
3. Keep `sqlx` migrations matching the SQLAlchemy schema so existing
   `%APPDATA%\HostWise\hostwise.db` files keep working (same tables/columns).
4. When feature-parity is reached: switch Tauri `setup()` to the in-process
   Rust server, delete `backend/` + PyInstaller CI steps, remove the
   `resources/hostwise-backend` bundle and the NSIS kill-hooks (no child process
   anymore), bump to v0.7.0.
5. The Defender false-positive class of bugs disappears by construction
   (no unsigned child exe, no extracted Python).

---

## Definition of done

- `cargo build --release` works on Windows/macOS/Linux with no Python.
- All `/api/v1/*` routes from the Python backend exist with equivalent JSON
  (verified by running the existing Playwright e2e suite against the Rust build).
- `sqlx` migrations create/upgrade the same SQLite schema; existing user DBs
  open without data loss.
- PDF reports generate without external software (`printpdf`).
- AI features call OpenAI/Anthropic via `reqwest` and fall back to `rules.rs`
  when offline/unauthorized.
- CI: backend Rust lint (`cargo clippy`), `cargo test`, `cargo fmt --check`; the
  existing Python CI steps are removed.
- The desktop app on a clean Windows 10/11 VM: install → launch → register →
  import CSV → dashboard → PDF export, with no Defender prompts.

---

## Out of scope (explicitly)

- Rewriting the Next.js/React frontend (must stay unchanged).
- PostgreSQL parity in the first pass (SQLite is the desktop DB; Postgres can be
  added later via a `postgres` sqlx feature).
- Email/SMTP sending unless already wired (notifications are in-app only today).
