# HostWise — Releasing & Auto-Updates

> How to cut a release that ships through the **built-in Tauri Updater**, how
> the signing keys work, and why **user data survives updates**.

---

## 1. How updates work

- The app embeds the **Tauri updater plugin** (`tauri-plugin-updater`).
- On startup the frontend checks the update endpoint:
  `https://github.com/mahmoud-ath/HostWise/releases/latest/download/latest.json`
- `latest.json` maps each OS target to a **signed installer** (URL + minisign
  signature + sha256). The plugin downloads the installer for the current
  platform, verifies it against the **public key embedded in the app**, then
  hands it to the OS installer (`passive` mode on Windows, standard flow on
  macOS/Linux).
- When an update is found, a **banner** appears (bottom-right) with
  *"Download & Install"* and live progress. Failures are silent and logged —
  an unreachable update server never blocks the app.

**User data survives updates by construction:** the SQLite database, backups,
uploads and logs live in the per-OS **app-data directory**, not inside the app
bundle:

| OS | Data directory |
|---|---|
| Linux | `$XDG_DATA_HOME/hostwise` → `~/.local/share/hostwise` |
| macOS | `~/Library/Application Support/hostwise` |
| Windows | `%APPDATA%\hostwise` |

Installers replace only the application files. Additionally, every production
launch creates an **automatic backup** if the newest is older than 24 h
(`hostwise_auto_*.db`, keeping the newest 7) — so even a botched update can be
rolled back from `Settings → Maintenance → Backups`.

---

## 2. Signing keys (read this first)

Tauri updates must be **signed** or they are rejected. The keypair is generated
with the Tauri CLI:

```bash
cd frontend
bunx tauri signer generate -w ~/.tauri/hostwise.key -p '<a-strong-passphrase>'
```

- **Private key:** `~/.tauri/hostwise.key` (also write the passphrase to
  `~/.tauri/hostwise.pass`, `chmod 600`). This is the only thing that can sign
  updates. **Never commit it.** It is already covered by `.gitignore` guards
  (`*.key`, `*.pass`, `.tauri/`).
- **Public key:** `~/.tauri/hostwise.key.pub` — this one is **embedded in the
  app** via `frontend/src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.
  Already done for the current key.
- **If you lose the private key or passphrase you can never publish another
  update** — back it up (password manager / offline drive). Rotating the key
  requires shipping a new installer with the new pubkey first (the updater
  rejects signatures from unknown keys).

> The current keypair was generated on 2026-08-10 and lives at
> `~/.tauri/` on the dev machine. Keep it safe.

---

## 3. Building a signed release (local, current OS)

```bash
scripts/release.sh v0.8.1          # build + sign + latest.json + upload
scripts/release.sh --no-upload     # build + sign + latest.json locally only
```

What it does:
1. Reads the signing key from `~/.tauri/` (or `TAURI_SIGNING_PRIVATE_KEY*` env).
2. `bunx tauri build --bundles <os defaults>` with `createUpdaterArtifacts: true`,
   producing the installer **plus a `<installer>.sig` signature file**.
3. Runs `frontend/scripts/generate-latest-json.mjs` → `latest.json` (merges all
   installers, computes sha256, reads signatures).
4. With a tag: uploads installers + `.sig` + `latest.json` to the GitHub
   Release via `gh release upload --clobber`.

**The normal release flow:**

```bash
git add -A && git commit -m "v0.8.1: ..."
git tag -a v0.8.1 -m "v0.8.1: ..."
git push origin main
git push origin v0.8.1          # starts CI (optional cross-OS builds)
scripts/release.sh v0.8.1       # local signed build + upload to the release
```

> `latest.json` **must be on the release with that exact filename** (the app
> polls `…/releases/latest/download/latest.json`). Uploading it is what
> activates the in-app updater.

---

## 4. CI pipeline (cross-OS)

`.github/workflows/release.yml` (triggered by `v*` tags):

- **windows / macos / linux** jobs build signed installers and upload them +
  their `.sig` files to the GitHub Release.
- **updater-manifest** job (runs after all three) merges every OS installer
  into one bundle dir, regenerates `latest.json`, and uploads it to the
  release.

The CI jobs need two **repository secrets** (Settings → Secrets → Actions):

| Secret | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | contents of `~/.tauri/hostwise.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | contents of `~/.tauri/hostwise.pass` |

Without them `tauri build` cannot create the `.sig` files and the job fails.
(Optional, unchanged: `WINDOWS_CERT_BASE64`/`WINDOWS_CERT_PASSWORD` for
Authenticode, `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID` for
notarization — these make installers less scary to SmartScreen/Gatekeeper but
are separate from the updater signing.)

> On this machine only **Linux** bundles can be produced locally
> (`.deb` + `.rpm`; AppImage is best-effort). Windows/macOS installers are
> produced by CI on their native runners.

---

## 5. Versioning

Bump **all four** places to the same value:

- `frontend/src-tauri/tauri.conf.json` → `version`
- `frontend/src-tauri/Cargo.toml` → `version`
- `backend-rs/Cargo.toml` → `version`
- `frontend/package.json` → `version`

The updater compares the installed version (from `tauri.conf.json` at build
time) against `latest.json`'s `version`. A release that does not bump the
version will never be offered.

---

## 6. Testing the update flow

1. Build a signed installer for a **new** version (`v0.8.1`) and publish it to
   a GitHub release with `latest.json`.
2. Run the currently installed `v0.8.0` app → within a few seconds the banner
   shows *"HostWise 0.8.1 is available"*.
3. Click **Download & Install** → progress → OS installer runs → app restarts.
4. Verify the version in `Settings → About` is `0.8.1` and **all data is still
   present** (DB lives in the app-data dir).
5. Optional: before installing, create a manual backup (`Settings →
   Maintenance`) as a rollback safety net.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Banner never appears | Endpoint unreachable, or `latest.json` missing from the release, or version not bumped. `curl https://github.com/mahmoud-ath/HostWise/releases/latest/download/latest.json` should return JSON. |
| "Update failed" on install | Signature mismatch — rebuild with the **same** keypair that's in `tauri.conf.json`. Check `TAURI_SIGNING_PRIVATE_KEY`/password are the correct pair. |
| CI fails with signing error | `TAURI_SIGNING_PRIVATE_KEY` / `_PASSWORD` secrets missing or wrong on the repo. |
| Data "gone" after update | It isn't — it's in the app-data dir (see §1). If the DB file is intact, use `Settings → Maintenance → Backups → Restore`. |
