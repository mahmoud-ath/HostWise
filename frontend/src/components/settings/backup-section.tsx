"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "./section-card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { useBackupStatus } from "@/hooks/use-api";
import { useBackend } from "@/contexts/backend-context";
import { useI18n } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { Database, Download, RefreshCw, RotateCcw, Trash2, CalendarClock, Upload } from "lucide-react";

interface Backup {
  name: string;
  size: number;
  created: string;
  path: string;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

export function BackupSection() {
  const { data: status, isLoading } = useBackupStatus();
  const { t } = useI18n();
  const { restartBackend } = useBackend();
  const queryClient = useQueryClient();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refreshStatus = () => {
    // Keep the stat cards (last/next backup, storage) in sync with the list.
    queryClient.invalidateQueries({ queryKey: ["backup-status"] });
  };

  const loadBackups = async () => {
    try {
      setBackups(await api.get<Backup[]>("/backups"));
    } catch {
      // ignore
    }
  };

  const refreshAll = async () => {
    refreshStatus();
    await loadBackups();
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const createBackup = async () => {
    setCreating(true);
    try {
      await api.post("/backups/create");
      await refreshAll();
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const uploadBackup = async (file: File) => {
    setUploading(true);
    try {
      const host = await api.getApiHost();
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch(`${host}/api/v1/backups/upload`, { method: "POST", body: formData });
      if (!resp.ok) throw new Error("Upload failed");
      await refreshAll();
    } catch (err) {
      alert("Failed to upload backup.");
    } finally {
      setUploading(false);
    }
  };

  const restore = async (name: string) => {
    if (!confirm(`Restore database from "${name}"?\nA safety backup will be created first.`)) return;
    try {
      await api.post(`/backups/restore/${encodeURIComponent(name)}`);
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        // The backend is embedded in the desktop process — restart it so it
        // reopens the restored database from disk (a plain reload keeps the
        // old open connection and the restore appears to do nothing).
        await restartBackend();
      }
      window.location.reload();
    } catch {
      alert("Failed to restore backup.");
    }
  };

  const download = async (b: Backup) => {
    try {
      await downloadFile(`/backups/download/${encodeURIComponent(b.name)}`, b.name);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const remove = async (name: string) => {
    try {
      await api.delete(`/backups/${encodeURIComponent(name)}`);
      await refreshAll();
    } catch {
      // ignore
    }
  };

  return (
    <SectionCard
      title={t("settings.backup")}
      icon={<Database className="h-5 w-5" />}
      description={t("settings.backupDesc")}
      action={
        <Button variant="outline" size="sm" onClick={createBackup} disabled={creating}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${creating ? "animate-spin" : ""}`} />
          {creating ? "Creating..." : "Backup Now"}
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Automatic Backup" value={status?.schedule === "daily" ? "Daily" : "—"} />
        <Stat
          label="Last Backup"
          value={status?.last_backup ? formatDateTime(status.last_backup.created) : "Never"}
        />
        <Stat
          label="Next Backup"
          value={status?.next_backup ? formatDateTime(status.next_backup) : "—"}
        />
        <Stat
          label="Storage"
          value={`${status?.backup_count ?? 0} backups · ${formatBytes(status?.total_size ?? 0)}`}
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label className="cursor-pointer">
          <span className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent">
            <Upload className="mr-1.5 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload Backup"}
          </span>
          <input
            type="file"
            accept=".db"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadBackup(f);
              e.target.value = "";
            }}
          />
        </label>
        <span className="text-xs text-muted-foreground">
          Restore from a previously downloaded <code className="font-mono">.db</code> file.
        </span>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-2">Loading backups...</p>
        ) : backups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No backups yet — create your first backup to protect your data.
          </p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {backups.map((b) => (
              <div key={b.name} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(b.created)} · {formatBytes(b.size)}
                  </p>
                </div>
                <div className="ml-2 flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => download(b)} title="Download">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => restore(b.name)} title="Restore">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => remove(b.name)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        Retention: {status?.retention.daily ?? 7} daily, {status?.retention.weekly ?? 4} weekly,
        {status?.retention.monthly ?? 3} monthly.
      </p>
    </SectionCard>
  );
}
