#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# HostWise — Development Environment Setup
# ═══════════════════════════════════════════════════════════
# Installs all prerequisites for local development:
#   - System dependencies (Linux only)
#   - Rust + Tauri CLI
#   - Python backend dependencies
#   - Frontend dependencies
# ═══════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo "═══════════════════════════════════════════"
echo "  HostWise — Development Setup"
echo "═══════════════════════════════════════════"

# ── System deps (Linux only) ────────────────────────────
if [[ "$(uname)" == "Linux" ]]; then
    echo ""
    echo "[1/5] Installing Linux system dependencies for Tauri..."

    if command -v apt-get &>/dev/null; then
        sudo apt-get update -qq
        sudo apt-get install -y -qq \
            libwebkit2gtk-4.1-dev build-essential curl wget file \
            libxdo-dev libssl-dev libayatana-appindicator3-dev \
            librsvg2-dev libgtk-3-dev libjavascriptcoregtk-4.1-dev \
            libsoup-3.0-dev
    elif command -v pacman &>/dev/null; then
        sudo pacman -S --needed --noconfirm \
            webkit2gtk-4.1 base-devel curl wget file \
            xdotool openssl libayatana-appindicator \
            librsvg gtk3 libsoup3
    elif command -v dnf &>/dev/null; then
        sudo dnf install -y \
            webkit2gtk4.1-devel openssl-devel curl wget file \
            libxdo-devel libappindicator-gtk3-devel \
            librsvg2-devel gtk3-devel libsoup3-devel
    else
        echo "   ⚠ Unknown package manager. Install Tauri deps manually."
    fi
else
    echo ""
    echo "[1/5] Skipping system deps (not Linux)."
fi

# ── Rust ─────────────────────────────────────────────────
echo ""
echo "[2/5] Checking Rust..."
if command -v rustc &>/dev/null; then
    echo "   Rust: $(rustc --version)"
else
    echo "   Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# ── Tauri CLI ────────────────────────────────────────────
echo ""
echo "[3/5] Installing Tauri CLI..."
export PATH="$HOME/.cargo/bin:$PATH"
cargo install tauri-cli --version "^2" 2>&1 | tail -3 || echo "   Tauri CLI may already be installed."

# ── Python backend ───────────────────────────────────────
echo ""
echo "[4/5] Setting up Python backend..."
cd "$BACKEND_DIR"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt 2>&1 | tail -3
echo "   Python deps installed."

# ── Frontend ─────────────────────────────────────────────
echo ""
echo "[5/5] Setting up frontend..."
cd "$FRONTEND_DIR"
if command -v bun &>/dev/null; then
    bun install 2>&1 | tail -3
else
    npm install 2>&1 | tail -3
fi
echo "   Frontend deps installed."

echo ""
echo "═══════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  To run in development mode:"
echo "    Terminal 1: cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo "    Terminal 2: cd frontend && bun run dev"
echo "    Or: cd frontend && bun run tauri dev"
echo "═══════════════════════════════════════════"
