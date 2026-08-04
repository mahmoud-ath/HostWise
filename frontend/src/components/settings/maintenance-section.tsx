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
} from "lucide-react";
import {
  useMaintenanceStatus,
  useOptimizeDatabase,
  useResetDemoData,
  useBackendLogs,
} from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n";
import { formatBytes } from "./backup-section";

export function MaintenanceSection() {
  const { data: status, isLoading } = useMaintenanceStatus();
  const { t } = useI18n();
  const optimize = useOptimizeDatabase();
  const reset = useResetDemoData();
  const [showLogs, setShowLogs] = useState(false);
  const logs = useBackendLogs(200);

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
        <Button variant="destructive" size="sm" onClick={resetDemo} disabled={reset.isPending}>
          {reset.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
          Reset Demo Data
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
