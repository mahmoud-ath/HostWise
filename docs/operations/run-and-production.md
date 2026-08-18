
# HostWise — Run Locally & Ship to Production

> HostWise v0.8.1 is a **100% native Rust backend** (`app/backend/`) embedded
> **in-process** inside a **Tauri** desktop shell, serving a **Next.js static**
> frontend. No Python, no PyInstaller, no external runtime, no database server —
> SQLite is built into the binary. Updates ship through the **Tauri Updater**
> (see `docs/RELEASING.md`).
>
> - API: `http://127.0.0.1:<port>/api/v1` (Rust + axum)
> - Desktop: Tauri 2 (Linux/macOS/Windows), Rust backend runs inside the app
> - Frontend: Next.js 14 **static export** (bun builds it, Tauri serves it)
> - Data: a single SQLite file, stored **on-device** (local-first)

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Rust** | 1.77.2+ | stable toolchain (`rustc`, `cargo`) |
| **bun** | 1.x | used for the frontend (install/build/dev/tauri) |
| **git** | — | clone the repo |
| **Linux Tauri deps** | — | only needed for the desktop app on Linux |

Install Linux desktop dependencies (Debian/Ubuntu):

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

> macOS/Windows: no extra system packages — Tauri downloads what it needs.

---

## 2. Option A — Desktop app (recommended, port-agnostic)

This is the real product. The Tauri shell starts the Rust backend **in-process**
on a free port and tells the frontend the actual URL, so port collisions never
matter.

```bash
cd app/frontend
bun install          # first time only
bun run tauri:dev    # opens the native app window
```

- The window loads the frontend (`devUrl http://localhost:3000`).
- The backend starts automatically on port 8000 (or the next free one).
- Your data lands in the per-OS data dir (see §5).

---

## 3. Option B — Web / browser dev mode

In the browser the frontend uses a **relative** `/api/v1` base that the Next.js
dev server proxies to the backend (see `next.config.js`). By dev convention the
backend runs on **`http://127.0.0.1:8000`** — both `cargo run` and the Tauri
in-process backend prefer port 8000 in dev.

### Recommended: single command

```bash
cd app/frontend
bun install          # first time only
bun run dev:app      # starts app/backend (cargo run, :8000) + Next dev (:3000)
```

`dev:app` (`app/frontend/scripts/dev.mjs`) starts the Rust backend **first**, waits
for it to listen on 8000, then boots Next — so the proxy never sees
`ECONNREFUSED`. Both logs print in one terminal with `[backend]` / `[frontend]`
prefixes; Ctrl+C stops both.

### Or: two terminals

```bash
# Terminal 1 — Rust backend → http://127.0.0.1:8000  (start this FIRST)
cd app/backend
cargo run

# Terminal 2 — Next.js dev server → http://localhost:3000
cd app/frontend
bun install          # first time only
bun run dev
```

Open **http://localhost:3000** in your browser.

> **Start the backend before `bun run dev`.** The dev proxy targets
> `127.0.0.1:8000` when Next starts. If Next boots first (or the backend isn't
> running), every `/api` call logs `ECONNREFUSED` until the backend is up. If
> you don't want to manage two terminals, use `bun run dev:app` above.

### ⚠️ The #1 gotcha: stale `PORT` env var

The backend reads `PORT` from the environment (default **8000**). If your
terminal has a leftover `PORT` (e.g. from an earlier test), the backend binds to
the wrong port and the browser shows **"Could not connect to the backend. Please
restart the app."**

```bash
# Check for stale vars
echo "PORT=$PORT"

# Fix — clear them (and the temp DB/data dirs if you don't want them)
unset PORT SQLITE_PATH HOSTWISE_DATA_DIR

# ...or just pin the port for the run
PORT=8000 cargo run
```

> If you ever see `addr=127.0.0.1:8091` (or similar) in the backend log instead
> of `:8000`, a stray `PORT` is set. `unset PORT` before running.

---

## 4. Backend only / API testing

```bash
cd app/backend
cargo run            # http://127.0.0.1:8000

# smoke check
curl http://127.0.0.1:8000/api/health
# → {"database":"up","status":"ok","version":"0.8.1","schema_version":4}

# tests
cargo test           # 8 suites: domains, analytics, connectors, AI/reports, …
```

---

## 5. Environment variables & where your data lives

### Env vars (all optional; a `app/backend/.env` file is supported)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8000` | HTTP port |
| `HOST` | `127.0.0.1` | Bind address |
| `SQLITE_PATH` | `<data_dir>/hostwise.db` | SQLite database file |
| `HOSTWISE_DATA_DIR` | `<data_dir>` | Backups + uploads live here |
| `CORS_ORIGINS` | dev: `["http://localhost:3000"]`; desktop: `["tauri://localhost","http://tauri.localhost","https://tauri.localhost"]` | Allowed origins |
| `APP_NAME` / `APP_VERSION` / `ENVIRONMENT` | `HostWise` / `0.8.1` / `development` | Metadata; `ENVIRONMENT=production` enables the automatic startup backup |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | *(empty)* | Optional BYOK AI providers |
| `DATABASE_TYPE` | `sqlite` | Reserved |

### Data directory (per OS)

| OS | Path |
|---|---|
| Linux | `$XDG_DATA_HOME/hostwise` → `~/.local/share/hostwise` |
| macOS | `~/Library/Application Support/hostwise` |
| Windows | `%APPDATA%\hostwise` |

Inside: `hostwise.db` (WAL), `backups/` (created by the backup feature),
`uploads/` (import staging).

> **Backup/restore** is built in: Settings → Maintenance, or the API
> (`/api/v1/backups/create`, `/restore`, `/verify`, `/download`).

### Logs

- **Backend** logs every request (method, path, status, ms, request ID — never
  query strings, bodies or headers, so no secrets) to **stdout** and to
  `<data_dir>/logs/hostwise.log`. Both the desktop app and the standalone
  binary do this.
- **Frontend** captures uncaught errors, rejected promises and failed API calls
  into an in-memory ring buffer (`localStorage`), visible under
  Settings → Maintenance → **Client Logs**, with **Export Client Logs**
  (downloads a `.log` file). Bodies and Authorization headers are never stored.
- View backend logs in-app: Settings → Maintenance → **View Logs**, or read the
  file at `<data_dir>/logs/hostwise.log`.

### Automatic backups

Every **production** launch (`ENVIRONMENT=production`, which the packaged
desktop app sets) creates an automatic backup if the newest one is older than
24 h: `hostwise_auto_<timestamp>.db`, keeping the newest 7. Manual backups
(`hostwise_manual_*`) are never pruned automatically. This is the "daily
backup" the status screen advertises.

---

## 6. Production build (installers)

Build a release installer for the current OS:

```bash
cd app/frontend
bun install --frozen-lockfile
bunx tauri build                     # default bundles for the current OS
bunx tauri build --bundles nsis      # Windows
bunx tauri build --bundles dmg       # macOS
bunx tauri build --bundles deb       # Linux (.deb)
bunx tauri build --bundles appimage  # Linux (raw; repack to use system webkit)
# Linux AppImage that works on real GPUs (system WebKitGTK, re-signed):
scripts/repack-appimage-system-webkit.sh \
  src-tauri/target/release/bundle/appimage/HostWise_*.AppImage
```

Output installers land in `app/frontend/src-tauri/target/release/bundle/…`.

### Production facts

- **No external runtime** — the Rust backend is compiled into the app binary
  (SQLite + migrations included). Install and go.
- **Local-first** — all data stays on the device; the app works fully offline.
- **AI is optional** — the built-in rules engine works out of the box; connect
  your own OpenAI/Anthropic key in Settings for LLM-powered answers.
- **Code signing / notarization** (Windows + macOS) is optional and configured in
  CI via secrets; unsigned builds still work, but may trigger SmartScreen/Gatekeeper
  warnings.

### How the packaged app reaches its backend

- The embedded backend binds `127.0.0.1:<port>` (port 8000 preferred) **before**
  the window loads.
- `get_backend_url` (Tauri command) returns the **full** API base
  `http://127.0.0.1:<port>/api/v1` — the frontend builds every request as
  `baseUrl + endpoint` where endpoints have **no** version prefix (e.g.
  `/finance/summary`). A bare host here makes every data request 404.
- The backend's CORS must allow the packaged webview origin. That differs per OS
  (see `rust_backend.rs` `desktop_config`):
  - Linux / macOS → `tauri://localhost`
  - **Windows → `http://tauri.localhost`** (Tauri v2 uses the http scheme there)
  - plus dev origins `http://localhost:3000` / `http://127.0.0.1:3000`

  If a platform's origin is missing from the list, the packaged app shows
  "API Connection Error" on every page — it looks like the backend "won't run"
  even though it's healthy.

---

## 7. Releasing a new version

Releases ship through the **built-in Tauri Updater**. Every release must be
**signed** with the updater keypair and publish a `latest.json` manifest to the
GitHub Release — otherwise the in-app updater can't offer it.

```bash
# 1. Bump the version in tauri.conf.json + Cargo.toml (x2) + package.json
# 2. Commit and push main
git add -A && git commit -m "v0.8.1: ..."
git push origin main

# 3. Tag and push → CI builds + signs installers for all three OSes
git tag -a v0.8.1 -m "v0.8.1"
git push origin v0.8.1

# 4. Local signed build + upload installers & latest.json to the release
#    (also what makes the updater work on Linux)
scripts/release.sh v0.8.1
```

See **`docs/RELEASING.md`** for the full workflow: signing keys (generated,
secured, gitignored), the CI secrets to configure
(`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`), the
`latest.json` manifest job, how to test the update flow, and why user data
survives updates (the DB lives in the app-data dir).

Watch CI at `https://github.com/mahmoud-ath/HostWise/actions`. Installers land
on `https://github.com/mahmoud-ath/HostWise/releases/tag/v0.8.1`.

CI checks (`.github/workflows/ci.yml`) run on every push/PR to `main`:
Rust `fmt` + `clippy` + `test`, plus a frontend `bun` lint + build.

---

## 8. Production readiness checklist

- [x] All 14 backend domains ported to Rust (auth, properties, reservations,
      finance, categories, analytics, settings, maintenance, notifications,
      setup, backup, connectors, AI, reports/PDF).
- [x] API shapes aligned with the frontend (finance summary/reports, analytics,
      AI advisor, portfolio report, property model).
- [x] Frontend `bun run build` passes (type-checked, 14 static pages).
- [x] All 8 Rust test suites green (`cargo test`).
- [x] Version metadata synced to `0.8.1` (`tauri.conf.json`,
      `app/frontend/src-tauri/Cargo.toml`, `app/backend/Cargo.toml`, `package.json`).
- [x] CI + release pipelines Rust-only and bun-based.
- [x] Production logging: backend (stdout + `<data_dir>/logs/hostwise.log`,
      no secrets) and frontend (client log capture + export).
- [x] Automatic daily backup on production launch (keeps newest 7 auto
      backups; manual backups untouched).
- [x] Auto-update: Tauri updater configured, keypair generated + secured,
      signed `latest.json` pipeline (see `docs/RELEASING.md`).
- [ ] (Optional) Configure Windows signing / macOS notarization secrets.
- [ ] (Optional) Pin a `v*` tag → CI publishes signed installers for all OSes.

---

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Could not connect to the backend. Please restart the app." | Backend not running, or on the wrong port (stale `PORT`). `unset PORT; cargo run`, or use the desktop app. |
| Port 8000 already in use | `PORT=8001 cargo run` **only** for backend-only testing; for the browser frontend keep it on `8000` (or use `tauri:dev`). |
| `bun run tauri:dev` fails on Linux | Missing webkit deps — install the packages from §1. |
| Empty/wrong data | Check `SQLITE_PATH` / `HOSTWISE_DATA_DIR` aren't pointing at stale temp dirs. |
| AI Advisor answers "no LLM" | AI is BYOK: add your OpenAI/Anthropic key in Settings → AI. |
| Desktop shows "API Connection Error / Request failed", browser is fine | (a) Stale webview storage — the WebKitGTK webview restores old localStorage/cache across restarts. Fix: delete `~/.local/share/com.hostwise.desktop` (Linux) / `%LOCALAPPDATA%\com.hostwise.desktop` (Windows) and relaunch. Do NOT delete the `hostwise` data dir (your DB). (b) Older builds: `get_backend_url` missing `/api/v1` (fixed in v0.7.4). |
| Packaged app can't reach backend on Windows | CORS origin `http://tauri.localhost` missing (fixed in v0.7.4 — keep it in `rust_backend.rs` `desktop_config`). |
| `next dev` proxies /api but browser still 404s/500s | The proxy is baked in at boot; the backend wasn't up yet. Restart `next dev` (or touch `next.config.js`) after the backend is running. |
