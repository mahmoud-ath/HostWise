#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# HostWise — local signed release build + updater manifest upload
# ═══════════════════════════════════════════════════════════════════════
# Builds a signed installer for the CURRENT OS (Tauri updater artifacts),
# generates latest.json, and — when a tag is given — uploads everything to
# the GitHub Release so the built-in updater works.
#
# Usage:
#   scripts/release.sh <tag>            # build + sign + manifest + upload
#   scripts/release.sh --no-upload      # build + sign + manifest locally only
#
# Signing key (REQUIRED for release builds):
#   The keypair lives at ~/.tauri/hostwise.key (+ .pub) with the passphrase in
#   ~/.tauri/hostwise.pass. NEVER commit these. In CI, provide the secrets
#   TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD instead.
#   If you lose the key or passphrase you can no longer publish updates.
#
# After this runs, push the tag BEFORE uploading (gh uploads to that release):
#   git tag -a v0.8.1 -m "v0.8.1 ..." && git push origin v0.8.1
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/frontend"

TAG="${1:-}"
if [ "${TAG:-}" = "--no-upload" ]; then TAG=""; fi

KEY_FILE="${TAURI_SIGNING_PRIVATE_KEY_PATH:-$HOME/.tauri/hostwise.key}"
PASS_FILE="$HOME/.tauri/hostwise.pass"
export TAURI_SIGNING_PRIVATE_KEY="${TAURI_SIGNING_PRIVATE_KEY:-}"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"

# Load the local signing key if the env vars aren't already set (CI sets them).
if [ -z "$TAURI_SIGNING_PRIVATE_KEY" ] && [ -f "$KEY_FILE" ]; then
  TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_FILE")"
  export TAURI_SIGNING_PRIVATE_KEY
  if [ -z "$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" ] && [ -f "$PASS_FILE" ]; then
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat "$PASS_FILE")"
    export TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  fi
fi

if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
  echo "ERROR: signing key not found. Generate it with:" >&2
  echo "  bunx tauri signer generate -w ~/.tauri/hostwise.key -p '<passphrase>'" >&2
  exit 1
fi

VERSION="$(node -p "require('./src-tauri/tauri.conf.json').version")"
echo "══ HostWise v$VERSION signed release build ══"

bun install --frozen-lockfile

# Build the default bundle(s) for this OS WITH updater artifacts (.sig files).
# Linux example: .deb + .rpm + best-effort AppImage. Add other bundles per OS.
case "$(uname -s)" in
  Linux*) BUNDLES="deb rpm" ;;
  Darwin*) BUNDLES="dmg app" ;;
  MINGW*|MSYS*) BUNDLES="nsis msi" ;;
  *) BUNDLES="deb" ;;
esac
bunx tauri build --bundles $BUNDLES

# Generate latest.json (needs the .sig files created above).
if [ -n "${TAG:-}" ]; then
  bun scripts/generate-latest-json.mjs --tag "$TAG"
else
  bun scripts/generate-latest-json.mjs
fi

echo "Done. Installer(s):"
find src-tauri/target/release/bundle -maxdepth 2 -type f \( -name '*.deb' -o -name '*.rpm' -o -name '*.AppImage' -o -name '*.dmg' -o -name '*.exe' -o -name '*.msi' \) | sed 's/^/  /'
