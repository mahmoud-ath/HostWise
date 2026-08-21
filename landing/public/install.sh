#!/usr/bin/env sh
#
# HostWise — one-line installer
#   curl -fsSL https://hostwise-app.vercel.app/install.sh | sh
#
# Detects your OS/arch and installs the matching build from the latest GitHub
# release (github.com/mahmoud-ath/HostWise/releases/latest):
#   macOS  → .dmg (Apple Silicon, copied into /Applications)
#   Linux  → .deb (apt) / AppImage (portable) / AUR (Arch)
#
# Override the download source if needed:
#   HOSTWISE_BASE_URL=https://your-host.example curl -fsSL ... | sh
#
set -eu

BASE_URL="${HOSTWISE_BASE_URL:-https://github.com/mahmoud-ath/HostWise/releases/latest/download}"
VERSION="${HOSTWISE_VERSION:-0.8.3}"

say() { printf '%s\n' "$*"; }
die() { say "error: $*" >&2; exit 1; }

say ""
say "  HostWise installer  (v$VERSION)"
say "  ─────────────────────────────────────────────"

[ -n "${HOSTWISE_BASE_URL:-}" ] || \
  say "  Downloading from $BASE_URL (set HOSTWISE_BASE_URL to override)"
say ""

os="$(uname -s)"
arch="$(uname -m)"
case "$arch" in
  x86_64 | amd64) arch="x86_64" ;;
  aarch64 | arm64) arch="arm64" ;;
  *) die "unsupported architecture: $arch" ;;
esac

case "$os" in
  Darwin)
    say "  Detected: macOS ($arch) — downloading installer…"
    dmg="$BASE_URL/HostWise_${VERSION}_aarch64.dmg"
    tmp="$(mktemp -d)"
    trap 'hdiutil detach -quiet "$tmp/mnt" 2>/dev/null || true; rm -rf "$tmp"' EXIT
    curl -fsSL "$dmg" -o "$tmp/HostWise.dmg" || die "download failed: $dmg"
    hdiutil attach "$tmp/HostWise.dmg" -mountpoint "$tmp/mnt" -quiet
    say "  Installing to /Applications…"
    cp -R "$tmp/mnt/HostWise.app" /Applications/
    hdiutil detach "$tmp/mnt" -quiet
    say ""
    say "  ✅ HostWise installed. Open it from /Applications."
    ;;
  Linux)
    if command -v apt-get >/dev/null 2>&1; then
      say "  Detected: Debian/Ubuntu — installing the .deb…"
      deb="$BASE_URL/HostWise_${VERSION}_amd64.deb"
      curl -fsSL "$deb" -o "/tmp/HostWise_${VERSION}_amd64.deb" || die "download failed: $deb"
      sudo apt-get install -y "/tmp/HostWise_${VERSION}_amd64.deb"
      rm -f "/tmp/HostWise_${VERSION}_amd64.deb"
      say "  ✅ HostWise installed."
    elif command -v dnf >/dev/null 2>&1; then
      say "  Detected: Fedora/RHEL — no .rpm build yet, using the AppImage…"
      mkdir -p "$HOME/.local/bin"
      appimage="HostWise_${VERSION}_amd64.AppImage"
      url="$BASE_URL/$appimage"
      curl -fsSL "$url" -o "$HOME/.local/bin/$appimage" || die "download failed: $url"
      chmod +x "$HOME/.local/bin/$appimage"
      say "  ✅ Installed to:  $HOME/.local/bin/$appimage"
    elif command -v pacman >/dev/null 2>&1; then
      say "  Detected: Arch/Manjaro — installing from the AUR:"
      say ""
      say "    yay -S hostwise-bin    # or:  paru -S hostwise-bin"
      say ""
      exit 0
    else
      say "  Detected: Linux (portable) — downloading the AppImage…"
      mkdir -p "$HOME/.local/bin"
      appimage="HostWise_${VERSION}_amd64.AppImage"
      url="$BASE_URL/$appimage"
      curl -fsSL "$url" -o "$HOME/.local/bin/$appimage" || die "download failed: $url"
      chmod +x "$HOME/.local/bin/$appimage"
      say ""
      say "  ✅ Installed to:  $HOME/.local/bin/$appimage"
      say "  Run it with:      $HOME/.local/bin/$appimage"
      say "  (If it won't launch, run it with --appimage-extract-and-run)"
    fi
    ;;
  *)
    die "unsupported OS: $os — on Windows, download the .exe installer from the GitHub release"
    ;;
esac
