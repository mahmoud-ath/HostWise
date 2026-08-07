# HostWise — Changelog & Dev Roadmap

> Practical record of what changed, **why**, and the workflow to follow so the
> app (dev and packaged) keeps working. Read §4 (workflow) + §5 (troubleshooting)
> first if you hit an issue.

---

## 1. Recent changes (2026-08-07)

### v0.7.5 — production CORS fix
- **`frontend/src-tauri/src/rust_backend.rs`**: the embedded backend's CORS
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

### v0.7.4 — dev proxy hardening (`frontend/next.config.js`)
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
- The middleware lives in `backend-rs/src/core/middleware.rs` (request ID +
  timing). If you edit `backend-rs/`, restart `bun run tauri:dev` — tauri dev
  only auto-rebuilds on `src-tauri/` changes.

---

## 4. Workflow (follow this)

### Desktop app (the product)
```bash
cd frontend
bun run tauri:dev        # single command: frontend + embedded backend
```
Do **not** also run `cargo run` — the backend is embedded in the app. Two
backends would fight over port 8000 and the `hostwise.port` file.

### Browser-only dev (API debugging)
```bash
# Terminal 1 — start the backend FIRST
cd backend-rs && cargo run                     # http://127.0.0.1:8000

# Terminal 2 — then the frontend
cd frontend && bun run dev                     # http://localhost:3000
```
If you started Next first (or the backend restarted on a new port), restart
`next dev` (or touch `next.config.js`) so the proxy re-targets the live port.

### Production build
```bash
cd frontend
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
| No backend logs in `tauri:dev` | Fixed in v0.7.5 (tracing subscriber). Ensure you rebuilt. |
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
