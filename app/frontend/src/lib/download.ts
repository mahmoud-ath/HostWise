import { api } from "@/lib/api";

/** True when running inside the Tauri desktop shell. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Download a generated file from the backend.
 * - Desktop: a native "Save As" dialog lets the user choose where to save.
 * - Browser: a standard download starts (the browser picks the location).
 *
 * `endpoint` is relative under `/api/v1` (e.g. `/settings/export`,
 * `/backups/download/name`). Returns false if the user cancelled the dialog.
 */
export async function downloadFile(
  endpoint: string,
  filename: string
): Promise<boolean> {
  const host = await api.getApiHost();
  const url = `${host}/api/v1${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed (HTTP ${resp.status})`);
  const bytes = new Uint8Array(await resp.arrayBuffer());

  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await save({ defaultPath: filename });
    if (!path) return false;
    await invoke("save_file", { path, bytes });
    return true;
  }

  const blob = new Blob([bytes]);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
  return true;
}
