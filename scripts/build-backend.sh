#!/usr/bin/env bash
# Build the Python backend with PyInstaller and bundle it into the Tauri
# resources so `tauri build` can embed it as a sidecar.
#
# Usage: scripts/build-backend.sh        (uses backend/.venv if present)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT/backend"
RESOURCES_DIR="$ROOT/frontend/src-tauri/resources/hostwise-backend"

# Pick a Python interpreter: prefer the project venv.
PY="${PYTHON:-}"
if [[ -z "$PY" ]]; then
  if [[ -x "$BACKEND_DIR/.venv/bin/python" ]]; then
    PY="$BACKEND_DIR/.venv/bin/python"
  elif [[ -x "$BACKEND_DIR/.venv/Scripts/python.exe" ]]; then
    PY="$BACKEND_DIR/.venv/Scripts/python.exe"
  else
    PY="python3"
  fi
fi

echo ">> Building backend with $PY"
"$PY" -m PyInstaller --noconfirm --distpath "$BACKEND_DIR/dist" "$BACKEND_DIR/hostwise-backend.spec"

echo ">> Bundling into $RESOURCES_DIR"
mkdir -p "$RESOURCES_DIR"
rm -rf "$RESOURCES_DIR"/*
cp -r "$BACKEND_DIR/dist/hostwise-backend/." "$RESOURCES_DIR/"

echo ">> Done. Backend bundled to $RESOURCES_DIR"
