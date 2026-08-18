"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "./section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  Wrench,
  Database,
  Trash2,
  Eraser,
  FileText,
  Loader2,
  CheckCircle2,
  RefreshCw,
  ClipboardCopy,
  Download,
} from "lucide-react";
import {
  useMaintenanceStatus,
  useOptimizeDatabase,
  useCleanupData,
  useResetDemoData,
  useResetAllData,
  useBackendLogs,
} from "@/hooks/use-api";
import { useBackend } from "@/contexts/backend-context";
import { useI18n } from "@/lib/i18n";
import { formatBytes } from "./backup-section";
import { getLogs, formatLogs, clearLogs, type LogEntry } from "@/lib/logger";

// Merged Maintenance + Developer tab (one tab, no redundancy):
// database housekeeping + backend diagnostics + a single shared log viewer.
export function MaintenanceSection() {
  const { data: status, isLoading } = useMaintenanceStatus();
  const { t } = useI18n();
  const optimize = useOptimizeDatabase();
  const cleanup = useCleanupData();
  const reset = useResetDemoData();
  const resetAll = useResetAllData();
  const { status: backendStatus, isReady, restartBackend } = useBackend();
  const [showLogs, setShowLogs] = useState(false);
  const [showClientLogs, setShowClientLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clientLogs, setClientLogs] = useState<LogEntry[]>([]);
  const logs = useBackendLogs(200);

  useEffect(() => {
    if (showClientLogs) setClientLogs(getLogs());
  }, [showClientLogs]);

  const exportClientLogs = () => {
    const blob = new Blob([formatLogs(getLogs())], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hostwise-client-logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Resolve the ACTUAL backend URL the app is talking to (via the API client,
  // which calls get_backend_url in Tauri or the /api/v1 proxy in the browser).
  const [backendUrl, setBackendUrl] = useState<string>("resolving…");
  useEffect(() => {
    let active = true;
    api
      .getApiBaseUrl()
      .then((url) => active && setBackendUrl(url))
      .catch((err) =>
        active && setBackendUrl(err instanceof Error ? err.message : String(err))
      );
    return () => {
      active = false;
    };
  }, []);

  const clearCache = () => {
    if (!confirm("Clear cached application data? Your data is safe; only cached values are removed.")) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("hostwise_") || k.startsWith("report_"))
        .forEach((k) => localStorage.removeItem(k));
      alert("Cache cleared.");
    } catch {
      alert("Could not clear cache.");
    }
  };

  const resetDemo = () => {
    if (!confirm("Reset demo data?\nThis deletes all revenues, expenses and reservations. This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? This is destructive.")) return;
    reset.mutate(undefined, {
      onSuccess: (res) => alert(`Demo data reset: ${Object.entries(res.deleted).map(([k, v]) => `${k} (${v})`).join(", ")}`),
      onError: () => alert("Failed to reset demo data."),
    });
  };

  const resetAllData = () => {
    if (!confirm("Reset ALL data?\nThis deletes everything — properties, reservations, revenues, expenses, categories, notifications, AND all settings (business name, currency, AI provider, API keys, appearance). The app returns to its very first-run state. This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? This is destructive.")) return;
    resetAll.mutate(undefined, {
      onSuccess: (res) => {
        alert(`Factory reset complete: ${Object.entries(res.deleted).map(([k, v]) => `${k} (${v})`).join(", ")} deleted. The app is back to its first-run state.`);
        // Reload so the app re-reads the cleared settings (first-run defaults).
        window.location.reload();
      },
      onError: () => alert("Failed to reset all data."),
    });
  };

  const runCleanup = () => {
    if (!confirm("Permanently delete records you soft-deleted more than 30 days ago? This frees space and cannot be undone.")) return;
    cleanup.mutate(30, {
      onSuccess: (res) => {
        const total = Object.values(res.purged).reduce((s, n) => s + n, 0);
        alert(total > 0
          ? `Cleanup complete: permanently removed ${total} old record(s).`
          : "Cleanup complete: nothing old to remove.");
      },
      onError: () => alert("Cleanup failed."),
    });
  };

  const copyDiagnostics = async () => {
    const text = [
      "HostWise Diagnostics",
      `Backend status: ${backendStatus}`,
      `Backend ready: ${isReady}`,
      `API URL: ${backendUrl}`,
      `User agent: ${navigator.userAgent}`,
      `Screen: ${window.screen.width}x${window.screen.height}`,
      `Local time: ${new Date().toISOString()}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <SectionCard
      title={t("settings.maintenance")}
      icon={<Wrench className="h-5 w-5" />}
      description={t("settings.maintenanceDesc")}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Database Size</p>
          <p className="mt-0.5 text-sm font-semibold">
            {isLoading ? "—" : formatBytes(status?.database_size ?? 0)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Integrity:{" "}
            {isLoading ? "…" : status?.integrity === "ok" ? "OK" : status?.integrity === "error" ? "ERROR" : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Backups</p>
          <p className="mt-0.5 text-sm font-semibold">
            {isLoading ? "—" : `${status?.backup_count ?? 0} · ${formatBytes(status?.backups_size ?? 0)}`}
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Log File</p>
          <div className="mt-0.5 text-sm font-semibold">
            {isLoading ? "—" : status?.log_file_available ? <Badge variant="success">Available</Badge> : <Badge variant="secondary">Stdout only</Badge>}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
          <span className="text-muted-foreground">Backend Status</span>
          <Badge variant={isReady ? "success" : "destructive"} className="capitalize">{backendStatus}</Badge>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
          <span className="text-muted-foreground">API URL</span>
          <span className="font-mono text-xs break-all text-right" title={backendUrl}>
            {backendUrl}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
          <span className="text-muted-foreground">Security</span>
          <div className="flex items-center gap-1.5">
            {status?.security?.cors_restricted ? (
              <Badge variant="success">CORS restricted</Badge>
            ) : (
              <Badge variant="destructive">CORS open</Badge>
            )}
            {status?.security?.default_jwt_secret ? (
              <Badge variant="destructive">Default JWT secret</Badge>
            ) : (
              <Badge variant="success">JWT secret set</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => optimize.mutate()} disabled={optimize.isPending}>
          {optimize.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Database className="mr-1.5 h-4 w-4" />}
          Optimize Database
        </Button>
        <Button variant="outline" size="sm" onClick={runCleanup} disabled={cleanup.isPending} title="Permanently remove soft-deleted records older than 30 days">
          {cleanup.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
          Clean Up Deleted Records
        </Button>
        <Button variant="outline" size="sm" onClick={clearCache}>
          <Eraser className="mr-1.5 h-4 w-4" /> Clear Cache
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowLogs((v) => !v)}>
          <FileText className="mr-1.5 h-4 w-4" /> View Logs
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowClientLogs((v) => !v)}>
          <FileText className="mr-1.5 h-4 w-4" /> Client Logs
        </Button>
        <Button variant="outline" size="sm" onClick={exportClientLogs} title="Download the client-side error/event log">
          <Download className="mr-1.5 h-4 w-4" /> Export Client Logs
        </Button>
        <Button variant="outline" size="sm" onClick={restartBackend}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Restart Backend
        </Button>
        <Button variant="outline" size="sm" onClick={copyDiagnostics}>
          <ClipboardCopy className="mr-1.5 h-4 w-4" />
          {copied ? "Copied!" : "Copy Diagnostics"}
        </Button>
        <Button variant="destructive" size="sm" onClick={resetDemo} disabled={reset.isPending}>
          {reset.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
          Reset Demo Data
        </Button>
        <Button variant="destructive" size="sm" onClick={resetAllData} disabled={resetAll.isPending}>
          {resetAll.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Database className="mr-1.5 h-4 w-4" />}
          Reset All Data
        </Button>
      </div>

      {optimize.data && (
        <p className="mt-3 flex items-center gap-1.5 text-sm">
          <CheckCircle2 className="h-4 w-4 text-success" />
          {optimize.data.ok
            ? `Optimized: ${formatBytes(optimize.data.before)} → ${formatBytes(optimize.data.after)} (${formatBytes(optimize.data.freed)} freed)`
            : optimize.data.message}
        </p>
      )}

      {showLogs && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs font-mono">
          {logs.isLoading
            ? "Loading logs..."
            : logs.data?.content || "No log file available in this environment."}
        </pre>
      )}

      {showClientLogs && (
        <div className="mt-3 rounded-md border bg-muted/40">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-medium">Client log ({clientLogs.length} entries, newest last)</span>
            <button
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => {
                clearLogs();
                setClientLogs([]);
              }}
            >
              Clear
            </button>
          </div>
          <pre className="max-h-64 overflow-auto p-3 text-xs font-mono">
            {clientLogs.length
              ? clientLogs
                  .map((e) => `[${e.ts}] ${e.level.toUpperCase()} ${e.msg}${e.detail ? ` — ${e.detail}` : ""}`)
                  .join("\n")
              : "No client-side events captured yet."}
          </pre>
        </div>
      )}
    </SectionCard>
  );
}
