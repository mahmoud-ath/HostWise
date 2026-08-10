#!/usr/bin/env node
/**
 * Generate the Tauri updater manifest (`latest.json`) from built installer
 * artifacts, then upload it (with the installers + signatures) to the GitHub
 * Release for the given tag.
 *
 * Usage:
 *   node scripts/generate-latest-json.mjs [--tag v0.8.1] [--bundle-dir=<path>] [--dry-run]
 *
 * Reads installers + `.sig` files from the bundle dir (default
 * `src-tauri/target/release/bundle`), maps each to its Tauri update target,
 * and writes `latest.json` into it. When `--tag` is given and `gh` is
 * available, uploads everything to the release (this is the step that makes
 * the built-in updater work). `--bundle-dir` lets CI merge installers from
 * all three OS jobs into one directory before generating the manifest.
 *
 * The app must have been built with `createUpdaterArtifacts: true` AND
 * `TAURI_SIGNING_PRIVATE_KEY` (+ password) set, otherwise there are no `.sig`
 * files and the manifest cannot be produced.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const argTag = process.argv.find((a) => a.startsWith("--tag="))?.split("=")[1];
const argBundleDir = process.argv.find((a) => a.startsWith("--bundle-dir="))?.split("=")[1];
const dryRun = process.argv.includes("--dry-run");

// Normalize the bundle dir: if it is a subdir of the default bundle dir
// (e.g. .../bundle/nsis), treat the parent as the root so the subdir name is
// still used to derive the Tauri target.
let bundleDir = argBundleDir ? join(root, argBundleDir) : join(root, "src-tauri", "target", "release", "bundle");
if (existsSync(bundleDir)) {
  const parent = join(bundleDir, "..");
  const base = basename(bundleDir);
  if (["nsis", "msi", "dmg", "app", "deb", "rpm", "appimage"].includes(base) && existsSync(parent)) {
    bundleDir = parent;
  }
}

const argTag = process.argv.find((a) => a.startsWith("--tag="))?.split("=")[1];
const dryRun = process.argv.includes("--dry-run");

function tauriTarget(bundleSub, file) {
  const lower = file.toLowerCase();
  if (bundleSub === "nsis" && lower.endsWith(".exe")) return "windows-x86_64";
  if (bundleSub === "msi" && lower.endsWith(".msi")) return "windows-x86_64";
  if (bundleSub === "dmg" && lower.endsWith(".dmg")) {
    if (/arm64|aarch64|universal/.test(lower)) return "darwin-aarch64";
    return "darwin-x86_64";
  }
  if (bundleSub === "app" && lower.endsWith(".tar.gz")) return "darwin-x86_64";
  if (bundleSub === "deb" && lower.endsWith(".deb")) return "linux-x86_64";
  if (bundleSub === "rpm" && lower.endsWith(".rpm")) return "linux-x86_64";
  if (bundleSub === "appimage" && lower.endsWith(".appimage")) return "linux-x86_64";
  return null;
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

const tauriConf = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const version = tauriConf.version;
const repo = "mahmoud-ath/HostWise";
const baseUrl = `https://github.com/${repo}/releases/latest/download`;

const platforms = {};
const uploadFiles = [];
let notes = `HostWise v${version}`;

if (!existsSync(bundleDir)) {
  console.error(`Bundle dir not found: ${bundleDir}`);
  console.error("Build first with: TAURI_SIGNING_PRIVATE_KEY=... bunx tauri build");
  process.exit(1);
}

for (const sub of readdirSync(bundleDir)) {
  const subDir = join(bundleDir, sub);
  if (!statSync(subDir).isDirectory()) continue;
  for (const file of readdirSync(subDir)) {
    const target = tauriTarget(sub, file);
    if (!target) continue;
    const installerPath = join(subDir, file);
    const sigPath = `${installerPath}.sig`;
    if (!existsSync(sigPath)) {
      console.warn(`Skipping ${file}: missing .sig (not built with signing key)`);
      continue;
    }
    const signature = readFileSync(sigPath, "utf8").trim();
    const url = `${baseUrl}/${encodeURIComponent(file)}`;
    // Prefer a better installer if one already mapped (e.g. AppImage over deb).
    platforms[target] = { url, signature, sha256: sha256(installerPath) };
    uploadFiles.push(installerPath, sigPath);
    console.log(`Mapped ${target} <- ${file}`);
  }
}

if (Object.keys(platforms).length === 0) {
  console.error("No signed installers found. Rebuild with the signing key set.");
  process.exit(1);
}

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms,
};
const manifestPath = join(bundleDir, "latest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote ${manifestPath}`);

if (dryRun) {
  console.log("Dry run — not uploading.");
  process.exit(0);
}

if (!argTag) {
  console.log("No --tag given — manifest written locally, not uploaded.");
  process.exit(0);
}

// Upload everything to the GitHub Release for the tag.
try {
  execFileSync("gh", ["release", "upload", argTag, manifestPath, ...uploadFiles, "--clobber"], {
    stdio: "inherit",
  });
  console.log(`Uploaded installers + latest.json to GitHub release ${argTag}`);
} catch (err) {
  console.error(
    `Failed to upload. Ensure the release ${argTag} exists (gh release create ${argTag}) and gh is authenticated.`
  );
  console.error(String(err?.stderr || err));
  process.exit(1);
}
