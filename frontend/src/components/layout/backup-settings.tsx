"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Download, Trash2, RefreshCw, RotateCcw } from "lucide-react";

interface Backup {
  name: string;
  size: number;
  created: string;
  path: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export function BackupSettings() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const data = await api.get<Backup[]>("/backups/");
      setBackups(data);
    } catch {
      // Backups API might not be available
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      await api.post("/backups/create");
      await loadBackups();
    } catch (err) {
      console.error("Failed to create backup:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (name: string) => {
    if (!confirm(`Restore database from "${name}"?\nA safety backup will be created first.`)) return;
    try {
      await api.post(`/backups/restore/${encodeURIComponent(name)}`);
      alert("Database restored! The app will restart.");
      window.location.reload();
    } catch (err) {
      alert("Failed to restore backup. Check logs for details.");
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete backup "${name}"?`)) return;
    try {
      await api.delete(`/backups/${encodeURIComponent(name)}`);
      await loadBackups();
    } catch (err) {
      console.error("Failed to delete backup:", err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" /> Database Backups
        </CardTitle>
        <CardDescription>
          Automatic backups are created daily. You can also create manual backups.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateBackup}
            disabled={creating}
            className="gap-2"
          >
            {creating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {creating ? "Creating..." : "Create Backup Now"}
          </Button>
          <Button variant="ghost" size="sm" onClick={loadBackups} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Loading backups...</div>
        ) : backups.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No backups yet. Create your first backup to protect your data.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {backups.map((b) => (
              <div
                key={b.name}
                className="flex items-center justify-between p-2 rounded-md border text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-mono text-xs">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(b.created)} · {formatSize(b.size)}
                  </p>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRestore(b.name)}
                    title="Restore"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(b.name)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
