#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# HostWise — Development Environment Setup
# ═══════════════════════════════════════════════════════════
# Installs all prerequisites for local development:
#   - Rust + Tauri system dependencies
#   - Python backend dependencies
#   - Frontend dependencies
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

echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}  HostWise — Development Setup${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"

# ── Check prerequisites ──────────────────────────────────
echo ""
echo -e "${YELLOW}[check] Verifying prerequisites...${NC}"

# Rust
if command -v rustc &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Rust: $(rustc --version)"
else
    echo -e "  ${RED}✗${NC} Rust not found. Install via: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "    Then restart your shell and run this script again."
    exit 1
fi

# Node.js or Bun
HAS_BUN=false
if command -v bun &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Bun: $(bun --version)"
    HAS_BUN=true
elif command -v node &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Node.js: $(node --version)"
else
    echo -e "  ${RED}✗${NC} Bun or Node.js not found. Install Bun: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Python
if command -v python3 &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Python: $(python3 --version)"
else
    echo -e "  ${RED}✗${NC} Python 3 not found."
    exit 1
fi

# Install Tauri system deps (Linux only)
if [ "$(uname)" = "Linux" ]; then
    echo ""
    echo -e "${YELLOW}[check] Tauri Linux dependencies...${NC}"
    MISSING_DEPS=()
    for pkg in libgtk-3-dev libwebkit2gtk-4.1-dev librsvg2-dev libssl-dev patchelf; do
        if dpkg -s "$pkg" &>/dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} $pkg"
        else
            echo -e "  ${RED}✗${NC} $pkg"
            MISSING_DEPS+=("$pkg")
        fi
    done

    if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}  Installing missing system dependencies...${NC}"
        sudo apt-get update -qq
        sudo apt-get install -y -qq "${MISSING_DEPS[@]}"
        echo -e "${GREEN}  Done.${NC}"
    fi
fi

# ── Python backend ───────────────────────────────────────
echo ""
echo -e "${YELLOW}[1/3] Setting up Python backend...${NC}"
cd "$BACKEND_DIR"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt -q 2>&1 | tail -3
echo -e "${GREEN}   Python deps installed.${NC}"

# ── Frontend ─────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/3] Setting up frontend...${NC}"
cd "$FRONTEND_DIR"
if $HAS_BUN; then
    bun install 2>&1 | tail -3
else
    npm install 2>&1 | tail -3
fi
echo -e "${GREEN}   Frontend deps installed.${NC}"

# ── Install Tauri CLI ────────────────────────────────────
echo ""
echo -e "${YELLOW}[3/3] Installing Tauri CLI...${NC}"
if $HAS_BUN; then
    bun add -d @tauri-apps/cli@^2 2>&1 | tail -2
else
    npm install -D @tauri-apps/cli@^2 2>&1 | tail -2
fi
echo -e "${GREEN}   Tauri CLI installed.${NC}"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo ""
echo -e "${CYAN}  Development commands:${NC}"
echo -e "${CYAN}    Backend only:${NC}"
echo -e "${CYAN}      cd backend && source .venv/bin/activate && uvicorn app.main:app --reload${NC}"
echo -e "${CYAN}    Frontend only:${NC}"
echo -e "${CYAN}      cd frontend && bun run dev${NC}"
echo -e "${CYAN}    Full Tauri dev (auto-starts frontend + backend sidecar):${NC}"
echo -e "${CYAN}      cd frontend && bun run tauri:dev${NC}"
echo ""
echo -e "${CYAN}  Production build:${NC}"
echo -e "${CYAN}      ./scripts/build.sh${NC}"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
