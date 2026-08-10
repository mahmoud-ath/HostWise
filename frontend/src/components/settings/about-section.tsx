"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "./section-card";
import { SettingRow } from "./setting-row";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { isTauri } from "@/lib/download";
import { checkForUpdates, downloadAndInstall } from "@/lib/updater";
import { Info, RefreshCw, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface HealthInfo {
  status: string;
  version: string;
  schema_version: number;
}

export function AboutSection() {
  const { t } = useI18n();
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The health endpoint lives OUTSIDE /api/v1 (at /api/health), so it must
    // be fetched from the bare host, not through the API base URL.
    api
      .getApiHost()
      .then(async (host) => {
        const res = await fetch(`${host}/api/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as HealthInfo;
      })
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch(() => {
        // Leave defaults if the backend isn't reachable yet.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const version = health?.version || "—";
  const schemaVersion =
    health && health.schema_version != null ? String(health.schema_version) : "—";

  const checkUpdates = async () => {
    setChecking(true);
    setUpdateMsg(null);
    const info = await checkForUpdates();
    setChecking(false);
    if (!info) {
      setUpdateMsg(
        isTauri()
          ? "You're up to date."
          : "Updates are handled by the desktop app."
      );
      return;
    }
    setUpdateMsg(`HostWise ${info.version} is available — downloading…`);
    const ok = await downloadAndInstall();
    setUpdateMsg(
      ok ? "Update installed — the app will restart." : "Update failed. Please try again later."
    );
  };

  return (
    <SectionCard
      title={t("settings.aboutTitle")}
      icon={<Info className="h-5 w-5" />}
      description={t("settings.aboutDesc")}
    >
      <div className="divide-y">
        <SettingRow label="Application">
          <span className="text-sm font-semibold">HostWise</span>
        </SettingRow>
        <SettingRow label="Version">
          <span className="text-sm text-muted-foreground">v{version}</span>
        </SettingRow>
        <SettingRow label="Database Version">
          <span className="text-sm text-muted-foreground">{schemaVersion}</span>
        </SettingRow>
        <SettingRow label="Backend Version">
          <span className="text-sm text-muted-foreground">{version}</span>
        </SettingRow>
        <SettingRow label="License">
          <span className="text-sm text-muted-foreground">Beta</span>
        </SettingRow>
        <SettingRow label="Updates">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={checkUpdates}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Check for Updates
            </Button>
            {updateMsg && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {updateMsg.includes("installed") || updateMsg.includes("up to date") ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : updateMsg.includes("failed") ? (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {updateMsg}
              </span>
            )}
          </div>
        </SettingRow>
      </div>
    </SectionCard>
  );
}
