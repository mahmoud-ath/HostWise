"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/contexts/settings-context";
import { AccountSection } from "@/components/settings/account-section";
import { BusinessSection } from "@/components/settings/business-section";
import { AISection } from "@/components/settings/ai-section";
import { BackupSection } from "@/components/settings/backup-section";
import { ImportSection } from "@/components/settings/import-section";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { SecuritySection } from "@/components/settings/security-section";
import { MaintenanceSection } from "@/components/settings/maintenance-section";
import { AboutSection } from "@/components/settings/about-section";
import { DeveloperSection } from "@/components/settings/developer-section";
import { Settings as SettingsIcon, Save, RotateCcw, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const { t } = useI18n();
  const { save, reset, dirty, saving } = useSettings();
  const [feedback, setFeedback] = useState<"idle" | "saved" | "failed">("idle");

  const handleSave = async () => {
    const ok = await save();
    setFeedback(ok ? "saved" : "failed");
    setTimeout(() => setFeedback("idle"), 2500);
  };

  const handleDiscard = () => {
    reset();
    setFeedback("idle");
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t("pages.settings.title")}</h1>
              <p className="mt-1 text-muted-foreground">{t("pages.settings.subtitle")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {dirty && (
              <Badge variant="secondary" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {t("settings.unsaved")}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={!dirty || saving}
              title={t("settings.discard")}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {t("settings.discard")}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || saving}
              className={feedback === "saved" ? "bg-emerald-600 text-white" : ""}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : feedback === "saved" ? (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              {feedback === "saved" ? t("settings.saved") : feedback === "failed" ? t("settings.saveFailed") : t("settings.save")}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <AccountSection />
            <BusinessSection />
            <AISection />
            <AppearanceSection />
            <SecuritySection />
          </div>
          <div className="space-y-6">
            <BackupSection />
            <ImportSection />
            <MaintenanceSection />
            <AboutSection />
            <DeveloperSection />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
