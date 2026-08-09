"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/contexts/settings-context";
import { useConfirmLeave } from "@/hooks/use-confirm-leave";
import { BusinessSection } from "@/components/settings/business-section";
import { AISection } from "@/components/settings/ai-section";
import { BackupSection } from "@/components/settings/backup-section";
import { ImportSection } from "@/components/settings/import-section";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { SecuritySection } from "@/components/settings/security-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { MaintenanceSection } from "@/components/settings/maintenance-section";
import { AboutSection } from "@/components/settings/about-section";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  Brain,
  Palette,
  Shield,
  Database,
  Upload,
  Wrench,
  Info,
  Bell,
} from "lucide-react";

const TABS = [
  { id: "business", labelKey: "settings.business", label: "Business", icon: Briefcase, content: <BusinessSection /> },
  { id: "ai", labelKey: "settings.ai", label: "AI Advisor", icon: Brain, content: <AISection /> },
  { id: "appearance", label: "Appearance", icon: Palette, content: <AppearanceSection /> },
  { id: "security", labelKey: "settings.security", label: "Security", icon: Shield, content: <SecuritySection /> },
  { id: "backup", labelKey: "settings.backup", label: "Backup", icon: Database, content: <BackupSection /> },
  { id: "notifications", labelKey: "settings.notifications", label: "Notifications", icon: Bell, content: <NotificationsSection /> },
  { id: "import", labelKey: "settings.dataImport", label: "Import", icon: Upload, content: <ImportSection /> },
  { id: "maintenance", labelKey: "settings.maintenance", label: "Maintenance", icon: Wrench, content: <MaintenanceSection /> },
  { id: "about", labelKey: "settings.aboutTitle", label: "About", icon: Info, content: <AboutSection /> },
] as const;

export default function SettingsPage() {
  const { t } = useI18n();
  const { save, reset, dirty, saving } = useSettings();
  const [feedback, setFeedback] = useState<"idle" | "saved" | "failed">("idle");

  // Never let unsaved edits be silently dropped when leaving the page.
  useConfirmLeave(dirty);

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

        <Tabs defaultValue="business" orientation="vertical" className="flex gap-6">
          <TabsList className="flex h-auto w-52 shrink-0 flex-col items-stretch justify-start gap-1 rounded-lg p-1.5">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="justify-start gap-2 rounded-md px-3 py-2 text-sm"
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                {"labelKey" in tab ? t(tab.labelKey) : tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="min-w-0 flex-1">
            {TABS.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-0">
                {tab.content}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </AppShell>
  );
}
