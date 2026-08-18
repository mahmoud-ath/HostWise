/**
 * Lightweight client-side logger.
 *
 * Captures uncaught errors / rejected promises and important operations into a
 * ring buffer kept in localStorage so the user can inspect or export them
 * (Maintenance → client logs). Never stores sensitive data — request bodies and
 * Authorization headers are not logged here.
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  detail?: string;
}

const KEY = "hostwise_client_logs";
const MAX = 200;

let buffer: LogEntry[] = [];

function load(): void {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    buffer = Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
  } catch {
    buffer = [];
  }
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(buffer.slice(-MAX)));
  } catch {
    // storage full / unavailable — drop oldest entries
    buffer = buffer.slice(-Math.floor(MAX / 2));
    try {
      localStorage.setItem(KEY, JSON.stringify(buffer));
    } catch {
      /* ignore */
    }
  }
}

export function getLogs(): LogEntry[] {
  load();
  return [...buffer];
}

export function clearLogs(): void {
  buffer = [];
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function log(level: LogLevel, msg: string, detail?: string): void {
  load();
  buffer.push({ ts: new Date().toISOString(), level, msg, detail });
  persist();
}

export function logInfo(msg: string, detail?: string): void {
  log("info", msg, detail);
}
export function logWarn(msg: string, detail?: string): void {
  log("warn", msg, detail);
}
export function logError(msg: string, detail?: string): void {
  log("error", msg, detail);
}

/** Format logs for a text export. */
export function formatLogs(entries: LogEntry[]): string {
  return entries
    .map((e) => `[${e.ts}] ${e.level.toUpperCase()} ${e.msg}${e.detail ? ` — ${e.detail}` : ""}`)
    .join("\n");
}

/** Install global error handlers. Call once on app start. */
export function initLogging(): void {
  if (typeof window === "undefined") return;
  load();
  window.addEventListener("error", (e) => {
    logError(
      e.message || "Uncaught error",
      e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined
    );
  });
  window.addEventListener("unhandledrejection", (e) => {
    logError(
      "Unhandled promise rejection",
      e.reason instanceof Error ? e.reason.message : String((e.reason as unknown) ?? "")
    );
  });
}
