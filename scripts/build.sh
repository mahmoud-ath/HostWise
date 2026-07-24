#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# HostWise — Production Build Script (Linux / macOS)
# ═══════════════════════════════════════════════════════════
# Builds the complete desktop application:
#   1. Python backend (PyInstaller bundle)
#   2. Next.js frontend (static export)
#   3. Tauri desktop shell (Rust)
#
# Produces:
#   Linux: .deb, .rpm, .AppImage
#   macOS: .dmg
#
# Prerequisites:
#   - Python 3.10+ with venv
#   - Rust (rustup + cargo)
#   - Bun >= 1.0 (or Node.js 22+)
#   - Linux: libwebkit2gtk-4.1-dev, libgtk-3-dev, etc.
#   - macOS: Xcode Command Line Tools
#
# Usage:
#   ./scripts/build.sh              # Build for current platform
#   ./scripts/build.sh --target win # Cross-compile for Windows (Linux only)
#   ./scripts/build.sh --clean      # Clean all build artifacts
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
BINARIES_DIR="$TAURI_DIR/binaries"

# Parse arguments
CLEAN=false
TARGET=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --clean) CLEAN=true; shift ;;
        --target) TARGET="$2"; shift 2 ;;
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
    rm -rf "$BINARIES_DIR"
    rm -rf "$FRONTEND_DIR/out"
    rm -rf "$TAURI_DIR/target"
    echo -e "${GREEN}  Cleaned.${NC}"
    exit 0
fi

# ── 1. Detect target triple ──────────────────────────────
if [ -n "$TARGET" ]; then
    TARGET_TRIPLE="$TARGET"
    BACKEND_BIN="hostwise-backend-${TARGET_TRIPLE}"
    echo -e "${CYAN}  Cross-compile target: ${TARGET_TRIPLE}${NC}"
else
    TARGET_TRIPLE="$(rustc -vV | sed -n 's/^host: //p')"
    BACKEND_BIN="hostwise-backend-${TARGET_TRIPLE}"
    echo -e "${CYAN}  Native target: ${TARGET_TRIPLE}${NC}"
fi

# ── 2. Backend: PyInstaller bundle ────────────────────────
echo ""
echo -e "${YELLOW}[1/4] Building Python backend with PyInstaller...${NC}"
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
    --collect-all app \
    --collect-all aiosqlite \
    launcher.py

mkdir -p "$BINARIES_DIR"
if [ -f "dist/hostwise-backend.exe" ]; then
    cp "dist/hostwise-backend.exe" "$BINARIES_DIR/$BACKEND_BIN.exe"
    chmod +x "$BINARIES_DIR/$BACKEND_BIN.exe"
    echo -e "${GREEN}   Backend: $BINARIES_DIR/$BACKEND_BIN.exe${NC}"
else
    cp "dist/hostwise-backend" "$BINARIES_DIR/$BACKEND_BIN"
    chmod +x "$BINARIES_DIR/$BACKEND_BIN"
    echo -e "${GREEN}   Backend: $BINARIES_DIR/$BACKEND_BIN${NC}"
fi

# ── 3. Inject externalBin into tauri.conf.json ───────────
echo ""
echo -e "${YELLOW}[2/4] Configuring Tauri for production...${NC}"

CONF="$TAURI_DIR/tauri.conf.json"
CONF_BAK="$TAURI_DIR/tauri.conf.json.bak"

# Backup original config
cp "$CONF" "$CONF_BAK"

python3 -c "
import json
with open('$CONF') as f:
    cfg = json.load(f)
bundle = cfg.setdefault('bundle', {})
bundle['externalBin'] = ['binaries/hostwise-backend']
bundle['resources'] = ['binaries/*']
with open('$CONF', 'w') as f:
    json.dump(cfg, f, indent=2)
"
echo -e "${GREEN}   externalBin + resources configured.${NC}"

# Register cleanup trap
cleanup_config() {
    if [ -f "$CONF_BAK" ]; then
        mv "$CONF_BAK" "$CONF"
        echo -e "${GREEN}   Tauri config restored.${NC}"
    fi
}
trap cleanup_config EXIT

# ── 4. Frontend: Next.js static export ────────────────────
echo ""
echo -e "${YELLOW}[3/4] Building Next.js frontend...${NC}"
cd "$FRONTEND_DIR"
bun install --silent 2>/dev/null || npm install --silent
bun run build 2>/dev/null || npm run build
echo -e "${GREEN}   Frontend: $FRONTEND_DIR/out/${NC}"

# ── 5. Tauri build ────────────────────────────────────────
echo ""
echo -e "${YELLOW}[4/4] Building Tauri desktop app...${NC}"
cd "$FRONTEND_DIR"

TAURI_CMD="bun run tauri build"

if [ -n "$TARGET" ]; then
    TAURI_CMD="$TAURI_CMD --target $TARGET"
fi

# Set up Windows cross-compilation linker if needed
if [ -n "$TARGET" ] && [[ "$TARGET" == *"windows"* ]]; then
    export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc
    export CARGO_TARGET_AARCH64_PC_WINDOWS_MSVC_LINKER=x86_64-w64-mingw32-gcc
fi

eval "$TAURI_CMD"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Build Complete!${NC}"
echo ""

# Show bundle output
BUNDLE_DIR="$TAURI_DIR/target/release/bundle"
if [ -n "$TARGET" ]; then
    BUNDLE_DIR="$TAURI_DIR/target/$TARGET/release/bundle"
fi

if [ -d "$BUNDLE_DIR" ]; then
    echo -e "${CYAN}  Artifacts:${NC}"
    find "$BUNDLE_DIR" -type f \( -name "*.deb" -o -name "*.rpm" -o -name "*.AppImage" -o -name "*.dmg" -o -name "*.msi" -o -name "*.exe" \) -exec ls -lh {} \; 2>/dev/null
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
