"use client";

import { useState } from "react";
import { SectionCard } from "./section-card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useWipeAllData } from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n";
import { Lock, Download, Trash2, Loader2, CheckCircle2 } from "lucide-react";

export function SecuritySection() {
  const { t } = useI18n();
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const wipeAll = useWipeAllData();

  const exportData = async () => {
    setExporting(true);
    try {
      const host = await api.getApiHost();
      // Direct navigation triggers the file download (multi-sheet Excel).
      window.location.href = `${host}/api/v1/settings/export`;
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      alert("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const wipe = () => {
    if (!confirm("Delete account?\nThis permanently removes all properties, reservations, revenues and expenses.")) return;
    if (!confirm("Are you absolutely sure? This starts you fresh and cannot be undone.")) return;
    wipeAll.mutate(undefined, {
      onSuccess: () => {
        alert("All data deleted. You're starting fresh.");
        window.location.reload();
      },
      onError: () => alert("Failed to delete data."),
    });
  };

  return (
    <SectionCard
      title={t("settings.security")}
      icon={<Lock className="h-5 w-5" />}
      description={t("settings.securityDesc")}
    >
      <div className="divide-y">
        <div className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-sm font-medium">Export Account Data</p>
            <p className="text-xs text-muted-foreground">
              Download everything (properties, revenue, expenses, reservations) as an Excel workbook with one tab per section.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
            {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
            Export
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-sm font-medium">Delete Account</p>
            <p className="text-xs text-muted-foreground">
              Remove all data and start fresh. Settings and profile are kept.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={wipe} disabled={wipeAll.isPending}>
            {wipeAll.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
            Delete
          </Button>
        </div>
      </div>
      {done && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Download started.
        </p>
      )}
    </SectionCard>
  );
}
