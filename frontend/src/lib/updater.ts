/**
 * Tauri Updater integration.
 *
 * Checks the production update endpoint (GitHub Releases `latest.json`) for a
 * newer HostWise version, downloads the signed installer and installs it.
 *
 * - Browser dev mode (Next dev server) is a no-op — updates only exist in the
 *   desktop app.
 * - All failures are caught and logged via the client logger; an unreachable
 *   update server must never break the app.
 * - The installer is verified against the embedded public key by the updater
 *   plugin before it runs. User data is untouched: the database lives in the
 *   per-OS app-data dir, not inside the app bundle.
 */

import { isTauri } from "./download";
import { logWarn, logError } from "./logger";

export interface UpdateInfo {
  /** Version of the available update (e.g. "0.8.1"). */
  version: string;
  /** Version currently installed. */
  currentVersion: string;
  /** Rough download progress 0..1 while downloading. */
  progress?: number;
}

export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; info: UpdateInfo }
  | { status: "none" }
  | { status: "downloading"; info: UpdateInfo; progress: number }
  | { status: "installing"; info: UpdateInfo }
  | { status: "error"; message: string };

/** Returns the available update, or null when up-to-date / unavailable. */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return null;
    return { version: update.version, currentVersion: update.currentVersion };
  } catch (err) {
    logWarn(
      "Update check failed",
      err instanceof Error ? err.message : String((err as unknown) ?? "")
    );
    return null;
  }
}

/**
 * Download and install the available update. Returns true when an update was
 * downloaded and handed to the OS installer. After `install()` resolves the
 * app usually restarts itself.
 */
export async function downloadAndInstall(
  onProgress?: (fraction: number) => void
): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return false;
    let total = 0;
    let received = 0;
    await update.download((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? 0;
      } else if (event.event === "Progress") {
        received += event.data.chunkLength ?? 0;
        if (total > 0) onProgress?.(Math.min(1, received / total));
      }
    });
    await update.install();
    return true;
  } catch (err) {
    logError(
      "Update install failed",
      err instanceof Error ? err.message : String((err as unknown) ?? "")
    );
    return false;
  }
}
