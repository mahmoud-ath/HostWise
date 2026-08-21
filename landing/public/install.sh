#!/usr/bin/env sh
#
# HostWise — one-line installer
#   curl -fsSL https://hostwise.app/install.sh | sh
#
# Detects your OS/arch and installs the matching build from the HostWise site:
#   macOS  → .dmg  (copied into /Applications)
#   Linux  → .deb  (apt) / .rpm (dnf) / AppImage (portable) / AUR (Arch)
#
# Override the download host if the site is deployed elsewhere:
#   HOSTWISE_BASE_URL=https://your-site.example curl -fsSL ... | sh
#
set -eu

BASE_URL="${HOSTWISE_BASE_URL:-https://hostwise.app}"
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
    dmg="$BASE_URL/downloads/HostWise_${VERSION}_universal.dmg"
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
      deb="$BASE_URL/downloads/hostwise_${VERSION}_amd64.deb"
      curl -fsSL "$deb" -o "/tmp/hostwise_${VERSION}_amd64.deb" || die "download failed: $deb"
      sudo apt-get install -y "/tmp/hostwise_${VERSION}_amd64.deb"
      rm -f "/tmp/hostwise_${VERSION}_amd64.deb"
      say "  ✅ HostWise installed."
    elif command -v dnf >/dev/null 2>&1; then
      say "  Detected: Fedora/RHEL — installing the .rpm…"
      rpm="$BASE_URL/downloads/hostwise-${VERSION}-1.x86_64.rpm"
      curl -fsSL "$rpm" -o "/tmp/hostwise-${VERSION}-1.x86_64.rpm" || die "download failed: $rpm"
      sudo dnf install -y "/tmp/hostwise-${VERSION}-1.x86_64.rpm"
      rm -f "/tmp/hostwise-${VERSION}-1.x86_64.rpm"
      say "  ✅ HostWise installed."
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
      url="$BASE_URL/downloads/$appimage"
      curl -fsSL "$url" -o "$HOME/.local/bin/$appimage" || die "download failed: $url"
      chmod +x "$HOME/.local/bin/$appimage"
      say ""
      say "  ✅ Installed to:  $HOME/.local/bin/$appimage"
      say "  Run it with:      $HOME/.local/bin/$appimage"
      say "  (If it won't launch, run it with --appimage-extract-and-run)"
    fi
    ;;
  *)
    die "unsupported OS: $os — on Windows, download the .exe installer from the site"
    ;;
esac
