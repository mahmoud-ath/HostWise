/**
 * True when the webview is running inside the Tauri desktop shell (vs. a plain
 * browser — `next dev`, Playwright e2e, or a hosted preview).
 */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
