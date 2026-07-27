#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# HostWise — AppImage Builder
# ═══════════════════════════════════════════════════════════
# Builds a standalone AppImage from Tauri's AppDir.
# This works around the linuxdeploy GTK plugin issue on Arch/Manjaro.
#
# Usage:
#   ./scripts/build-appimage.sh
# ═══════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TAURI_DIR="$PROJECT_ROOT/frontend/src-tauri"
BUNDLE_DIR="$TAURI_DIR/target/release/bundle"
APPDIR="$BUNDLE_DIR/appimage/HostWise.AppDir"
LINUXDEPLOY="$HOME/.cache/tauri/linuxdeploy-x86_64.AppImage"

echo "═══════════════════════════════════════════"
echo "  HostWise — AppImage Builder"
echo "═══════════════════════════════════════════"

# Ensure linuxdeploy exists
if [ ! -f "$LINUXDEPLOY" ]; then
    echo "Downloading linuxdeploy..."
    mkdir -p "$(dirname "$LINUXDEPLOY")"
    wget -q "https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage" -O "$LINUXDEPLOY"
    chmod +x "$LINUXDEPLOY"
fi

# Build the AppDir first using Tauri's AppImage bundler (this sets up the AppDir structure)
echo ""
echo "[1/2] Creating AppDir via Tauri..."
cd "$PROJECT_ROOT/frontend"
NO_STRIP=1 bun run tauri build --bundles deb,rpm 2>&1 | tail -5

# If Tauri already created an AppDir, use it. Otherwise, build one from the deb.
if [ -d "$APPDIR" ]; then
    echo "   Found existing AppDir"
elif [ -d "$BUNDLE_DIR/appimage_deb/data" ]; then
    echo "   Using appimage_deb data dir"
    APPDIR="$BUNDLE_DIR/appimage_deb/data"
else
    echo "   No AppDir found — extracting from deb..."
    DEB_FILE=$(ls "$BUNDLE_DIR/deb/"*.deb 2>/dev/null | head -1)
    if [ -z "$DEB_FILE" ]; then
        echo "ERROR: No deb file found. Build deb first."
        exit 1
    fi
    mkdir -p "$APPDIR"
    cd "$APPDIR"
    dpkg-deb -x "$DEB_FILE" .
    cd "$PROJECT_ROOT/frontend"
fi

echo ""
echo "[2/2] Building AppImage (without GTK plugin)..."
cd "$(dirname "$APPDIR")"
NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 "$LINUXDEPLOY" \
    --appdir "$(basename "$APPDIR")" \
    --output appimage 2>&1 | grep -E "(Success|AppImage|Error|error)" || true

# Check result
APPIMAGE_FILE=$(ls *.AppImage 2>/dev/null | head -1)
if [ -n "$APPIMAGE_FILE" ]; then
    echo ""
    echo "✅ AppImage built: $(dirname "$APPDIR")/$APPIMAGE_FILE"
    ls -lh "$APPIMAGE_FILE"
else
    echo ""
    echo "❌ AppImage build failed (deb and rpm are available)"
    exit 1
fi
