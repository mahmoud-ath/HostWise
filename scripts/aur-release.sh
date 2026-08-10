#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# HostWise — AUR release helper (publishes to the Arch User Repository)
# ═══════════════════════════════════════════════════════════════════════
# Regenerates packaging/aur/{PKGBUILD,.SRCINFO} for the current version
# (downloading the release AppImage + computing its sha256), then pushes the
# package to the AUR.
#
# Usage:
#   scripts/aur-release.sh              # use version from tauri.conf.json
#   scripts/aur-release.sh 0.8.1        # explicit version
#
# Requirements:
#   - An AUR account (https://aur.archlinux.org) with your SSH public key
#     added under "My Account → SSH Public Key".
#   - The AppImage release must already be published on GitHub (release.yml).
#
# If your AUR SSH key is not configured, the script stops before pushing and
# prints the exact manual steps.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUR_DIR="$ROOT/packaging/aur"
PKGNAME="hostwise-bin"
AUR_GIT="ssh://aur@aur.archlinux.org/$PKGNAME.git"

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  VERSION="$(node -p "require('$ROOT/frontend/src-tauri/tauri.conf.json').version")"
fi
echo "══ HostWise AUR release — v$VERSION ══"

# 1. Download the release AppImage + compute its sha256.
APPIMAGE="HostWise_${VERSION}_amd64.AppImage"
URL="https://github.com/mahmoud-ath/HostWise/releases/download/v${VERSION}/${APPIMAGE}"
TMP_APP="$(mktemp --suffix=.AppImage)"
trap 'rm -f "$TMP_APP"' EXIT
echo "Downloading $URL"
curl -fL -o "$TMP_APP" "$URL"
SHA256="$(sha256sum "$TMP_APP" | awk '{print $1}')"
echo "sha256: $SHA256"

LICENSE_SHA="$(sha256sum "$AUR_DIR/LICENSE" | awk '{print $1}')"

# 2. Regenerate PKGBUILD + .SRCINFO (kept in sync with the templates below).
cat > "$AUR_DIR/PKGBUILD" <<PKG
# Maintainer: HostWise <markuspub4@gmail.com>
# Contributor: mahmoud-ath <markuspub4@gmail.com>

pkgname=$PKGNAME
pkgver=$VERSION
pkgrel=1
pkgdesc="AI-powered financial intelligence for vacation rental hosts (AppImage)"
arch=('x86_64')
url="https://github.com/mahmoud-ath/HostWise"
license=('custom:HostWise')
depends=('fuse2' 'gtk3' 'libayatana-appindicator' 'webkit2gtk-4.1')
provides=('hostwise')
conflicts=('hostwise')
source=("hostwise-\${pkgver}.AppImage::https://github.com/mahmoud-ath/HostWise/releases/download/v\${pkgver}/HostWise_\${pkgver}_amd64.AppImage"
        'LICENSE')
sha256sums=('$SHA256'
            '$LICENSE_SHA')

package() {
  # Install the AppImage as a plain executable (it extracts to ~/.cache on run).
  install -Dm755 "\$srcdir/hostwise-\${pkgver}.AppImage" "\$pkgdir/usr/bin/hostwise"
  install -Dm644 "\$srcdir/LICENSE" "\$pkgdir/usr/share/licenses/\$pkgname/LICENSE"

  # Desktop entry so HostWise shows in the application menu.
  install -Dm644 /dev/stdin "\$pkgdir/usr/share/applications/hostwise.desktop" <<'EOF'
[Desktop Entry]
Name=HostWise
Comment=AI-powered financial intelligence for vacation rental hosts
Exec=/usr/bin/hostwise
Type=Application
Categories=Office;Finance;
Terminal=false
EOF
}
PKG

cat > "$AUR_DIR/.SRCINFO" <<SRC
pkgbase = $PKGNAME
	pkgdesc = AI-powered financial intelligence for vacation rental hosts (AppImage)
	pkgver = $VERSION
	pkgrel = 1
	url = https://github.com/mahmoud-ath/HostWise
	arch = x86_64
	license = custom:HostWise
	depends = fuse2
	depends = gtk3
	depends = libayatana-appindicator
	depends = webkit2gtk-4.1
	provides = hostwise
	conflicts = hostwise
	source = hostwise-$VERSION.AppImage::https://github.com/mahmoud-ath/HostWise/releases/download/v$VERSION/HostWise_${VERSION}_amd64.AppImage
	source = LICENSE
	sha256sums = $SHA256
	sha256sums = $LICENSE_SHA

pkgname = $PKGNAME
SRC

echo "Wrote $AUR_DIR/PKGBUILD and $AUR_DIR/.SRCINFO"
echo "--- local check (makepkg --printsrcinfo should match .SRCINFO) ---"

# 3. Push to the AUR (requires the user's AUR SSH key).
if ssh -o BatchMode=yes -o ConnectTimeout=10 aur@aur.archlinux.org true 2>/dev/null; then
  TMP_REPO="$(mktemp -d)"
  trap 'rm -rf "$TMP_REPO"; rm -f "$TMP_APP"' EXIT
  echo "Cloning $AUR_GIT"
  git clone "$AUR_GIT" "$TMP_REPO/repo"
  cp "$AUR_DIR/PKGBUILD" "$AUR_DIR/.SRCINFO" "$AUR_DIR/LICENSE" "$TMP_REPO/repo/"
  (cd "$TMP_REPO/repo" && git add -A && git -c user.name="HostWise" -c user.email="markuspub4@gmail.com" \
    commit -m "v$VERSION" && git push origin master)
  echo "✅ Published $PKGNAME v$VERSION to the AUR"
else
  echo
  echo "AUR SSH key not configured — stopping before push. To publish:"
  echo "  1. Register/login at https://aur.archlinux.org"
  echo "  2. Add your SSH public key: My Account → SSH Public Key"
  echo "  3. Then run:"
  echo "     git clone ssh://aur@aur.archlinux.org/$PKGNAME.git /tmp/$PKGNAME"
  echo "     cp $AUR_DIR/PKGBUILD $AUR_DIR/.SRCINFO $AUR_DIR/LICENSE /tmp/$PKGNAME/"
  echo "     cd /tmp/$PKGNAME && git add -A"
  echo "     git -c user.name='HostWise' -c user.email='markuspub4@gmail.com' commit -m 'v$VERSION'"
  echo "     git push origin master"
  exit 1
fi
