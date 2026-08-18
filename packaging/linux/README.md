# Linux packaging

Linux artifacts are produced by CI (`.github/workflows/release.yml` → `linux`
job): `.deb`, `.rpm`, and an AppImage that is **repacked to use the system
WebKitGTK** (the bundled CI webkit crashes on real GPUs — see
`scripts/repack-appimage-system-webkit.sh`).

This directory is for Linux-specific packaging assets committed to the repo:

- `../aur/` — the AUR `hostwise-bin` package (PKGBUILD + .SRCINFO) that ships
  the AppImage to Arch/Manjaro users.

Future: deb/rpm packaging tweaks, AppImage build extras, systemd units, etc.
