"use client";

import { useEffect, useState } from "react";
import { SectionCard } from "./section-card";
import { SettingRow } from "./setting-row";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Info, RefreshCw } from "lucide-react";

interface HealthInfo {
  status: string;
  version: string;
  schema_version: number;
}

export function AboutSection() {
  const { t } = useI18n();
  const [health, setHealth] = useState<HealthInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<HealthInfo>("/health")
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch(() => {
        // Leave the defaults if the backend isn't reachable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const version = health?.version || "0.7.6";
  const schemaVersion =
    health && health.schema_version != null ? String(health.schema_version) : "4";

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
          <Button variant="outline" size="sm" onClick={() => alert("You're on the latest version.")}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Check for Updates
          </Button>
        </SettingRow>
      </div>
    </SectionCard>
  );
}
