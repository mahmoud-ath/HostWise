"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/contexts/settings-context";
import { CheckCircle2, Loader2, Server, Database, Brain, User } from "lucide-react";
import { Logo } from "./logo";

const WELCOME_KEY = "hostwise_welcome_shown_v3";

const CURRENCIES = ["EUR", "USD", "GBP", "MAD", "AED", "CAD", "AUD", "CHF"];
const LANGUAGES = ["English", "Français", "Español", "العربية", "Deutsch"];

interface SetupStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: "pending" | "running" | "done";
}

export function WelcomeWizard() {
  const { t } = useI18n();
  const { ready, settings, updateSettings, save } = useSettings();
  const [show, setShow] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currency, setCurrency] = useState<string>((settings.default_currency as string) || "EUR");
  const [language, setLanguage] = useState<string>((settings.language as string) || "English");
  const [saving, setSaving] = useState(false);

  const [steps, setSteps] = useState<SetupStep[]>([
    { id: "backend", label: t("wizard.connecting"), icon: <Server className="h-4 w-4" />, status: "pending" },
    { id: "database", label: t("wizard.preparing"), icon: <Database className="h-4 w-4" />, status: "pending" },
    { id: "modules", label: t("wizard.loading"), icon: <Brain className="h-4 w-4" />, status: "pending" },
  ]);

  useEffect(() => {
    if (!localStorage.getItem(WELCOME_KEY)) {
      setShow(true);
    }
  }, []);

  // Pre-fill from settings that may already exist (e.g. after a reinstall),
  // so the wizard is coherent with what's already stored on this device.
  useEffect(() => {
    if (ready && show) {
      setName((prev) => prev || (settings.business_name && settings.business_name !== "HostWise" ? settings.business_name : ""));
      setEmail((prev) => prev || settings.profile_email || "");
    }
  }, [ready, show, settings.business_name, settings.profile_email]);

  const runSteps = useCallback(async () => {
    setError(null);
    // Step 1: wait for backend
    setSteps((prev) => prev.map((s, i) => ({ ...s, status: i === 0 ? "running" : "pending" } as SetupStep)));
    const host = await api.getApiHost();
    let ok = false;
    for (let i = 0; i < 30; i++) {
      try {
        const resp = await fetch(`${host}/api/health`);
        if (resp.ok) {
          ok = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!ok) {
      setError(t("wizard.connectError"));
      return;
    }
    setSteps((prev) => prev.map((s, i) => ({ ...s, status: i <= 0 ? "done" : "pending" } as SetupStep)));

    // Step 2: initialize database tables
    setSteps((prev) => prev.map((s, i) => ({ ...s, status: i < 1 ? "done" : i === 1 ? "running" : "pending" } as SetupStep)));
    try {
      await api.post("/setup/initialize", {});
    } catch {
      // Already initialized or tables exist — non-fatal.
    }
    setSteps((prev) => prev.map((s, i) => ({ ...s, status: i <= 1 ? "done" : "pending" } as SetupStep)));

    // Step 3: ready (no auth, no default credentials)
    setSteps((prev) => prev.map((s, i) => ({ ...s, status: i <= 2 ? "done" : "pending" } as SetupStep)));
    setConnected(true);
  }, []);

  useEffect(() => {
    if (show) runSteps();
  }, [show, runSteps]);

  const saveProfile = async () => {
    const businessName = name.trim();
    if (!businessName) return;
    setSaving(true);
    try {
      // Persist through the settings context so the sidebar/dashboard and the
      // language/currency side-effects apply immediately (not just on reload).
      updateSettings({
        business_name: businessName,
        profile_email: email.trim() || "",
        profile_name: businessName,
        default_currency: currency,
        language: language,
      });
      await save();
      // Keep the legacy setup endpoint in sync (DB init + profile row) so a
      // reinstall that calls /setup/initialize still has coherent data.
      await api
        .post("/setup/initialize", {
          name: businessName,
          email: email.trim() || undefined,
        })
        .catch(() => undefined);
    } catch {
      // ignore — local app; the wizard can still be dismissed.
    }
    localStorage.setItem(WELCOME_KEY, "true");
    setSaving(false);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="mx-4 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center">
            <Logo size={64} rounded="rounded-2xl" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">HostWise</h1>
          <p className="mt-2 text-muted-foreground">{t("app.tagline")}</p>
        </div>

        {!connected ? (
          <>
            <div className="mb-8 space-y-3">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    step.status === "running"
                      ? "border-primary bg-primary/5"
                      : step.status === "done"
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                      : "border-border"
                  }`}
                >
                  <div className="shrink-0">
                    {step.status === "running" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : step.status === "done" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      step.status === "running"
                        ? "text-primary"
                        : step.status === "done"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="ml-auto text-muted-foreground/50">{step.icon}</span>
                </div>
              ))}
            </div>

            <div className="mb-6 h-1.5 w-full rounded-full bg-secondary">
              <div className="h-1.5 rounded-full bg-primary transition-all duration-500" style={{ width: "100%" }} />
            </div>

            {error && (
              <div className="text-center">
                <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
                <Button size="lg" variant="outline" className="w-full" onClick={() => runSteps()}>
                  {t("wizard.retry")}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">{t("wizard.title")}</h2>
                <p className="text-xs text-muted-foreground">{t("wizard.subtitle")}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("wizard.yourName")}</Label>
              <Input
                className="mt-1"
                placeholder={t("wizard.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs">{t("wizard.email")}</Label>
              <Input
                className="mt-1"
                type="email"
                placeholder={t("wizard.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Default currency</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Language</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <Button size="lg" className="w-full" onClick={saveProfile} disabled={!name.trim() || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("wizard.getStarted")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
