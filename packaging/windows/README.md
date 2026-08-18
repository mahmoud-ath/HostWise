# Windows packaging

Windows installers are produced by CI (`.github/workflows/release.yml` → `windows`
job) with Tauri's NSIS bundler from `app/frontend/src-tauri`.

This directory is for Windows-specific packaging assets that are committed to
the repo (e.g. NSIS hooks, signing configs, icon/installer extras) that aren't
Tauri-bundled by default.

Current state: the NSIS upgrade/uninstall hooks live in
`app/frontend/src-tauri/nsis/hooks.nsh` (wired via `tauri.conf.json` →
`bundle.windows.nsis.installerHooks`). Move/extend them here if they grow.
