#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# HostWise — Production Build Script (Linux / macOS)
# ═══════════════════════════════════════════════════════════
# Builds the desktop application:
#   1. Python backend (PyInstaller bundle)
#   2. Next.js frontend (static export)
#   3. Tauri desktop app (embeds backend + frontend)
#
# Prerequisites:
#   - Python 3.10+ with venv
#   - Bun >= 1.0 (or Node.js 22+)
#   - Rust stable (rustup)
#   - Tauri system deps (see docs)
#
# Usage:
#   ./scripts/build.sh                          # Build for current platform
#   ./scripts/build.sh --bundles deb,appimage   # Specific bundle targets
#   ./scripts/build.sh --clean                  # Clean all build artifacts
# ═══════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
TAURI_DIR="$FRONTEND_DIR/src-tauri"

# Parse arguments
CLEAN=false
BUNDLES=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --clean) CLEAN=true; shift ;;
        --bundles) BUNDLES="$2"; shift 2 ;;
        --help)
            echo "Usage: $0 [--clean] [--bundles deb,appimage,rpm]"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}  HostWise Production Build${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"

# ── Clean ─────────────────────────────────────────────────
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}[clean] Removing build artifacts...${NC}"
    rm -rf "$BACKEND_DIR/build" "$BACKEND_DIR/dist" "$BACKEND_DIR"/*.spec
    rm -rf "$FRONTEND_DIR/out"
    rm -rf "$TAURI_DIR/target"
    echo -e "${GREEN}  Cleaned.${NC}"
    exit 0
fi

# ── 1. Backend: PyInstaller bundle ────────────────────────
echo ""
echo -e "${YELLOW}[1/3] Building Python backend with PyInstaller...${NC}"
cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt
pip install -q pyinstaller

pyinstaller \
    --onefile \
    --name "hostwise-backend" \
    --add-data "app:app" \
    --hidden-import=uvicorn.logging \
    --hidden-import=uvicorn.loops.auto \
    --hidden-import=uvicorn.protocols.http.auto \
    --hidden-import=aiosqlite \
    --hidden-import=sqlalchemy.dialects.sqlite \
    --hidden-import=sqlalchemy.dialects.sqlite.aiosqlite \
    --hidden-import=pydantic \
    --hidden-import=pydantic_settings \
    --hidden-import=bcrypt \
    --hidden-import=jose \
    --collect-all aiosqlite \
    --noconsole \
    --noupx \
    --strip \
    launcher.py

# Detect the binary name (with or without .exe)
BACKEND_BIN=""
if [ -f "dist/hostwise-backend.exe" ]; then
    BACKEND_BIN="dist/hostwise-backend.exe"
elif [ -f "dist/hostwise-backend" ]; then
    BACKEND_BIN="dist/hostwise-backend"
else
    echo -e "${RED}  ERROR: Backend binary not found in dist/${NC}"
    exit 1
fi
echo -e "${GREEN}   Backend: $BACKEND_DIR/$BACKEND_BIN${NC}"

# ── 2. Copy backend binary for Tauri sidecar ─────────────
echo ""
echo -e "${YELLOW}[2/3] Copying backend binary to Tauri sidecar location...${NC}"

# Detect Rust target triple
TARGET_TRIPLE=$(rustc -vV | grep "host:" | awk '{print $2}')
mkdir -p "$TAURI_DIR/binaries"

if [ "$(uname)" = "Darwin" ] || [ "$(uname)" = "Linux" ]; then
    cp "$BACKEND_DIR/$BACKEND_BIN" "$TAURI_DIR/binaries/hostwise-backend-${TARGET_TRIPLE}"
    chmod +x "$TAURI_DIR/binaries/hostwise-backend-${TARGET_TRIPLE}"
    echo -e "${GREEN}   Sidecar: $TAURI_DIR/binaries/hostwise-backend-${TARGET_TRIPLE}${NC}"
else
    cp "$BACKEND_DIR/$BACKEND_BIN" "$TAURI_DIR/binaries/hostwise-backend-${TARGET_TRIPLE}.exe"
    echo -e "${GREEN}   Sidecar: $TAURI_DIR/binaries/hostwise-backend-${TARGET_TRIPLE}.exe${NC}"
fi

# ── 3. Frontend + Tauri build ─────────────────────────────
echo ""
echo -e "${YELLOW}[3/3] Building Next.js frontend and Tauri desktop app...${NC}"
cd "$FRONTEND_DIR"
bun install --silent 2>/dev/null || npm install --silent

# Build Next.js static export
bun run build 2>/dev/null || npm run build
echo -e "${GREEN}   Frontend: $FRONTEND_DIR/out/${NC}"

# Build Tauri desktop bundles
if [ -n "$BUNDLES" ]; then
    echo -e "${YELLOW}   Tauri bundles: $BUNDLES${NC}"
    bun run tauri build --bundles "$BUNDLES"
else
    # Try building all bundles (deb + rpm + appimage)
    # On Arch/Manjaro, appimage bundling may fail due to linuxdeploy GTK plugin
    echo -e "${YELLOW}   Building Tauri bundles (deb + rpm)...${NC}"
    bun run tauri build --bundles deb,rpm 2>&1

    # Build AppImage separately — may need to work around GTK plugin issues
    echo ""
    echo -e "${YELLOW}   Building AppImage...${NC}"
    # Clean previous AppDir and try Tauri's appimage bundler
    rm -rf "$TAURI_DIR/target/release/bundle/appimage"
    if bun run tauri build --bundles appimage 2>/dev/null; then
        echo -e "${GREEN}   AppImage built via Tauri.${NC}"
    else
        # Tauri's appimage bundler failed (GTK plugin issue on Arch).
        # The AppDir was created before the failure — use it directly.
        APPIMAGE_DIR="$TAURI_DIR/target/release/bundle/appimage"
        if [ -d "$APPIMAGE_DIR/HostWise.AppDir" ]; then
            echo -e "${YELLOW}   Tauri AppImage bundler failed — building manually...${NC}"
            LINUXDEPLOY="$HOME/.cache/tauri/linuxdeploy-x86_64.AppImage"
            if [ -f "$LINUXDEPLOY" ]; then
                cd "$APPIMAGE_DIR"
                NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 "$LINUXDEPLOY" \
                    --appdir HostWise.AppDir --output appimage 2>&1 | tail -3
                cd "$FRONTEND_DIR"
            fi
        fi
    fi
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Build Complete!${NC}"
echo ""
echo -e "${CYAN}  Output:${NC}"
echo -e "${CYAN}    Backend:  $BACKEND_DIR/$BACKEND_BIN${NC}"
echo -e "${CYAN}    Frontend: $FRONTEND_DIR/out/${NC}"
echo -e "${CYAN}    Desktop:  $TAURI_DIR/target/release/bundle/${NC}"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
