"use client";

import { useState } from "react";
import { SectionCard } from "./section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import {
  useMaintenanceStatus,
  useOptimizeDatabase,
  useResetDemoData,
  useResetAllData,
  useBackendLogs,
} from "@/hooks/use-api";
import { useBackend } from "@/contexts/backend-context";
import { useI18n } from "@/lib/i18n";
import { formatBytes } from "./backup-section";

// Merged Maintenance + Developer tab (one tab, no redundancy):
// database housekeeping + backend diagnostics + a single shared log viewer.
export function MaintenanceSection() {
  const { data: status, isLoading } = useMaintenanceStatus();
  const { t } = useI18n();
  const optimize = useOptimizeDatabase();
  const reset = useResetDemoData();
  const resetAll = useResetAllData();
  const { status: backendStatus, isReady, restartBackend } = useBackend();
  const [showLogs, setShowLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const logs = useBackendLogs(200);

  const apiUrl =
    (typeof window !== "undefined" &&
      "__TAURI_INTERNALS__" in window &&
      "get_backend_url" in window)
      ? "dynamic (Tauri)"
      : process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

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
    if (!confirm("Reset ALL data?\nThis deletes properties, reservations, revenues, expenses and categories. Your settings (currency, AI, business name) are kept. This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? This is destructive.")) return;
    resetAll.mutate(undefined, {
      onSuccess: (res) => alert(`All data reset: ${Object.entries(res.deleted).map(([k, v]) => `${k} (${v})`).join(", ")}`),
      onError: () => alert("Failed to reset all data."),
    });
  };

  const copyDiagnostics = async () => {
    const text = [
      "HostWise Diagnostics",
      `Backend status: ${backendStatus}`,
      `Backend ready: ${isReady}`,
      `API URL: ${apiUrl}`,
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
          <span className="font-mono text-xs">{apiUrl}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => optimize.mutate()} disabled={optimize.isPending}>
          {optimize.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Database className="mr-1.5 h-4 w-4" />}
          Optimize Database
        </Button>
        <Button variant="outline" size="sm" onClick={clearCache}>
          <Eraser className="mr-1.5 h-4 w-4" /> Clear Cache
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowLogs((v) => !v)}>
          <FileText className="mr-1.5 h-4 w-4" /> View Logs
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
    </SectionCard>
  );
}
