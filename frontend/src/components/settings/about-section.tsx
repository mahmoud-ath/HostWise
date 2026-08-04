"use client";

import { SectionCard } from "./section-card";
import { SettingRow } from "./setting-row";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Info, RefreshCw } from "lucide-react";

export function AboutSection() {
  const { t } = useI18n();
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
          <span className="text-sm text-muted-foreground">v0.5.0</span>
        </SettingRow>
        <SettingRow label="Database Version">
          <span className="text-sm text-muted-foreground">5</span>
        </SettingRow>
        <SettingRow label="Backend Version">
          <span className="text-sm text-muted-foreground">0.1.0</span>
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
