# HostWise on the AUR (Arch User Repository)

> HostWise is published to the AUR as **`hostwise-bin`** — a prebuilt binary
> package that downloads the official **AppImage** from the GitHub release.
> It installs as `/usr/bin/hostwise` with a desktop entry and a custom license.

---

## 1. What's in `packaging/aur/`

| File | Purpose |
|---|---|
| `PKGBUILD` | Arch build script (binary package: fetches the AppImage, installs it) |
| `.SRCINFO` | Machine-readable package metadata (required by the AUR) |
| `LICENSE` | The proprietary license text installed to `/usr/share/licenses/` |

The package:
- `pkgname = hostwise-bin` (name confirmed free in the AUR)
- Installs the release **AppImage** as `/usr/bin/hostwise` (`chmod +x`)
- Adds a `.desktop` entry so it appears in the application menu
- Depends on the Tauri v2 runtime on Arch: `fuse2`, `gtk3`,
  `libayatana-appindicator`, `webkit2gtk-4.1`
- `provides/conflicts = hostwise`

---

## 2. Publishing a new version

One command (after the GitHub release for that version exists):

```bash
scripts/aur-release.sh            # uses the version from tauri.conf.json
scripts/aur-release.sh 0.8.1      # or be explicit
```

The script:
1. Downloads `HostWise_<ver>_amd64.AppImage` and computes its `sha256`.
2. Regenerates `PKGBUILD` + `.SRCINFO` with the new version + hashes.
3. If your AUR SSH key is configured, clones
   `ssh://aur@aur.archlinux.org/hostwise-bin.git`, commits, and pushes.
   Otherwise it prints the exact manual steps.

---

## 3. First-time setup (required once)

1. **Register an AUR account** at <https://aur.archlinux.org> (AUR login is
   separate from GitHub).
2. **Add your SSH public key:** AUR → *My Account* → *SSH Public Key*
   (the same key used for GitHub works, e.g. `~/.ssh/id_ed25519.pub`).
3. Now `scripts/aur-release.sh` can push.

### Manual push (if you prefer not to use the script's SSH check)
```bash
git clone ssh://aur@aur.archlinux.org/hostwise-bin.git /tmp/hostwise-bin
cp packaging/aur/PKGBUILD packaging/aur/.SRCINFO packaging/aur/LICENSE /tmp/hostwise-bin/
cd /tmp/hostwise-bin
git add -A
git -c user.name="HostWise" -c user.email="markuspub4@gmail.com" commit -m "v0.8.1"
git push origin master
```

> The AUR repo's default branch is `master` (not `main`).

---

## 4. How Arch users install it

```bash
# AUR helper (paru / yay)
paru -S hostwise-bin        # or: yay -S hostwise-bin

# or manually
git clone https://aur.archlinux.org/hostwise-bin.git
cd hostwise-bin
makepkg -si
```

---

## 5. Updating the package (bump rules)

The AUR requires `pkgrel` to be bumped for **any** change to `PKGBUILD` (even
same-version rebuilds). The script resets `pkgrel=1` per version; if you ever
change the `PKGBUILD` without bumping the version, raise `pkgrel` to `2`, `3`, …

Run `makepkg --printsrcinfo > .SRCINFO` (on Arch) after editing `PKGBUILD` to
keep `.SRCINFO` in sync — or just re-run `scripts/aur-release.sh`.

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Permission denied (publickey)` on push | Your AUR SSH key isn't registered. Add it under AUR → My Account → SSH Public Key. |
| `Repository 'hostwise-bin' does not exist` on clone | The AUR package page must be created first (nobody owns it). If the push fails with this, submit via the web UI first, or rename the package. |
| AUR flag "hash mismatch" | The AppImage sha256 changed (e.g. re-built release). Re-run `scripts/aur-release.sh` to refresh hashes. |
| AppImage won't run (newer releases) | The AppImage is repacked in CI to use the **system** WebKitGTK (the bundled one crashed on many GPUs: "Could not create default EGL display: EGL_BAD_PARAMETER"). It therefore **requires** `webkit2gtk-4.1` + `gtk3` installed (already in `depends`). On Arch/Manjaro: `sudo pacman -S webkit2gtk-4.1 gtk3 fuse2`. |
| AppImage won't run (old ≤ v0.8.1 releases) | The old AppImage bundles a broken WebKitGTK. Workaround: install the `.deb` equivalent, or re-run `scripts/aur-release.sh` after the next release (which repacks the AppImage), or run with system webkit: extract with `./HostWise*.AppImage --appimage-extract` and launch `squashfs-root/usr/bin/hostwise` after moving the bundled `libwebkit2gtk-4.1.so.0` out of `squashfs-root/usr/lib`. |
| AppImage won't start at all (FUSE) | Missing `fuse2` (dependency should install it). If you disabled FUSE, run `hostwise --appimage-extract-and-run`. |
