# Building HostWise as a Desktop App

HostWise is a **local-first desktop app**: a Tauri (Rust) shell that spawns the
FastAPI/Python backend and shows the Next.js frontend in its webview.

```
┌─────────────────────────────┐   ┌────────────────────────────────────┐
│  Tauri (Rust) shell         │   │  Python backend (PyInstaller)      │
│  · webview → static `out/`  │──▶│  · uvicorn on 127.0.0.1:8000       │
│  · spawns + stops backend   │   │  · SQLite in OS app-data dir       │
└─────────────────────────────┘   └────────────────────────────────────┘
```

## Architecture notes

- **Frontend** — Next.js, built with `output: 'export'` into `frontend/out/`.
  Tauri serves it from its webview (`tauri://localhost`). All pages are
  client-side rendered; dynamic routes (e.g. the property deep-dive) use a
  static route + query param (`/properties/detail?id=…`) so the export works.
- **Backend** — FastAPI. In development it runs `backend/launcher.py` with the
  repo venv; in release the PyInstaller bundle is embedded as a Tauri
  resource (`src-tauri/resources/hostwise-backend/`) and launched as a
  sidecar. It stores the DB under the OS app-data directory.
- **API URL** — the webview asks the Rust shell via `invoke('get_backend_url')`
  → `http://127.0.0.1:8000/api/v1`. CORS in `backend/launcher.py` already
  allows `tauri://localhost`.

## Prerequisites

- [Bun](https://bun.sh) (frontend tooling)
- [Rust](https://rustup.rs) + Cargo (Tauri)
- Python 3.10 (backend)
- OS-specific Tauri system deps — see the per-OS CI workflows in
  `.github/workflows/` (Linux needs `libwebkit2gtk-4.1-dev`, etc.)

## Development

```bash
# 1. Backend deps + venv
cd backend && python -m venv .venv && ./.venv/bin/pip install -r requirements.txt

# 2. Frontend deps + Tauri CLI
cd frontend && bun install

# 3. Run the desktop app in dev mode (starts next dev + the backend)
bun tauri dev
```

> Running the web frontend standalone is unchanged: `bun next dev` (3000) +
> `uvicorn app.main:app --reload` (8000).

## Building the desktop app

```bash
# 1. Bundle the Python backend into Tauri resources
scripts/build-backend.sh

# 2. Build the desktop app (frontend export + Rust + installer)
cd frontend
bunx tauri build --bundles nsis   # Windows
bunx tauri build --bundles dmg    # macOS
bunx tauri build --bundles appimage,deb  # Linux
```

Artifacts land in `frontend/src-tauri/target/release/bundle/`.

## Continuous integration

Separate workflows build each OS (they bundle the backend, export the
frontend, and produce an installer):

| OS | Workflow | Artifact |
| --- | --- | --- |
| Windows | `.github/workflows/build-windows.yml` | NSIS `.exe` |
| macOS | `.github/workflows/build-macos.yml` | `.dmg` |
| Linux | `.github/workflows/build-linux.yml` | `.AppImage` + `.deb` |

Run them manually (`workflow_dispatch`) or push a `v*` tag.

## Known caveats

- **WeasyPrint PDF export** needs native libs (Pango/Cairo/GDK-PixBuf) on the
  target OS. The Linux workflow installs them; Windows/macOS may need the
  runtime installed, and the app falls back to the print view if they're
  absent (see `docs/pdf-report-system.md`).
- **Code signing / notarization** (macOS) and **Authenticode** (Windows) are
  stubbed out in the workflows — add your certificates + secrets when you're
  ready to distribute. See the commented steps in `build-macos.yml`.
- The backend binds `127.0.0.1:8000`; make sure no other process uses it.
