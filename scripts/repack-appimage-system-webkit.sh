#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# HostWise — repack the Tauri AppImage to use the SYSTEM WebKitGTK
# ═══════════════════════════════════════════════════════════════════════
# WHY THIS EXISTS
#   `tauri build --bundles appimage` bundles an OLD WebKitGTK (the CI base
#   image's copy) + its whole dep tree into the AppImage. On many real
#   machines (notably AMD/Intel iGPUs with a modern Mesa) that old webkit's
#   web process aborts with:
#       Could not create default EGL display: EGL_BAD_PARAMETER. Aborting...
#   (WebKit bug #297921 / #302796). The .deb works because it uses the
#   system webkit2gtk; the bundled one is what breaks the AppImage.
#
# WHAT THIS DOES
#   Extracts the AppImage, strips the bundled shared libraries + webkit
#   helper processes, and repacks it so the app runs on the SYSTEM
#   webkit2gtk-4.1 / gtk3 / gstreamer stack (exactly like the .deb).
#   The AUR package (hostwise-bin) already depends on those system libs.
#
# USAGE
#   scripts/repack-appimage-system-webkit.sh <AppImage> [output AppImage]
#     AppImage      the tauri-built AppImage (e.g.
#                   frontend/src-tauri/target/release/bundle/appimage/HostWise_0.8.1_amd64.AppImage)
#     output        optional; defaults to <AppImage> (in-place, atomic via tmp)
#
#   Finds appimagetool via $APPIMAGETOOL, else extracts it from
#   ~/.cache/tauri/linuxdeploy-plugin-appimage.AppImage (what Tauri caches),
#   else PATH. No network needed after `tauri build` ran once.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

SRC="${1:?usage: repack-appimage-system-webkit.sh <AppImage> [output]}"
OUT="${2:-$SRC}"
OUT="$(realpath -m "$OUT")"
SRC="$(realpath -m "$SRC")"

if [ ! -f "$SRC" ]; then
  echo "ERROR: AppImage not found: $SRC" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "== Extracting $SRC =="
cd "$WORK"
"$SRC" --appimage-extract >/dev/null

echo "== Stripping bundled shared libraries (using system webkit/gtk stack) =="
# Remove every bundled .so + the bundled webkit helper processes so the
# dynamic loader falls back to the system webkit2gtk-4.1 (installed as a
# dependency of the AUR package / required by the .deb model).
find squashfs-root/usr/lib -name '*.so*' -delete
rm -rf squashfs-root/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1

# Locate appimagetool
APPIMAGETOOL="${APPIMAGETOOL:-}"
if [ -z "$APPIMAGETOOL" ] && [ -f "$HOME/.cache/tauri/linuxdeploy-plugin-appimage.AppImage" ]; then
  echo "== Extracting appimagetool from cached linuxdeploy plugin =="
  mkdir -p "$WORK/tool"
  "$HOME/.cache/tauri/linuxdeploy-plugin-appimage.AppImage" --appimage-extract --appimage-extract-and-run >/dev/null 2>&1 || true
  # The plugin AppImage extracts to ./squashfs-root inside the tool dir.
  (cd "$WORK/tool" && "$HOME/.cache/tauri/linuxdeploy-plugin-appimage.AppImage" --appimage-extract >/dev/null 2>&1) || true
  if [ -x "$WORK/tool/squashfs-root/usr/bin/appimagetool" ]; then
    APPIMAGETOOL="$WORK/tool/squashfs-root/usr/bin/appimagetool"
  fi
fi
if [ -z "$APPIMAGETOOL" ]; then
  APPIMAGETOOL="$(command -v appimagetool || true)"
fi
if [ -z "$APPIMAGETOOL" ]; then
  echo "== Downloading appimagetool (not cached locally) =="
  curl -fL -o "$WORK/appimagetool.AppImage" \
    https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage
  chmod +x "$WORK/appimagetool.AppImage"
  APPIMAGETOOL="$WORK/appimagetool.AppImage"
fi
if [ -z "$APPIMAGETOOL" ]; then
  echo "ERROR: appimagetool not found. Set APPIMAGETOOL or run 'tauri build --bundles appimage' first." >&2
  exit 1
fi

echo "== Repacking into $OUT =="
TMPOUT="$(mktemp --suffix=.AppImage)"
# --no-appstream: the tauri AppDir has no .metainfo; appimagetool would warn/fail on it.
"$APPIMAGETOOL" --no-appstream squashfs-root "$TMPOUT" >/dev/null
chmod +x "$TMPOUT"
mkdir -p "$(dirname "$OUT")"
mv -f "$TMPOUT" "$OUT"
echo "Done: $(du -h "$OUT" | cut -f1) -> $OUT"
