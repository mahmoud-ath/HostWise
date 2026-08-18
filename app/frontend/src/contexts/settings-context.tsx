"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { api } from "@/lib/api";
import { languageToLocale, isRtlLanguage, setAppLocale } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";

/** Mirrors the backend defaults in `backend/app/settings/defaults.py`. */
const DEFAULT_SETTINGS: Record<string, any> = {
  business_name: "HostWise",
  default_currency: "EUR",
  tax_rate: 20,
  fiscal_year_start: 1,
  country: "",
  timezone: "UTC",
  date_format: "DD/MM/YYYY",
  language: "English",
  ai_enabled: true,
  ai_provider: "hostwise",
  ai_api_key: "",
  ai_base_url: "https://api.openai.com/v1",
  ai_model: "gpt-4o-mini",
  ai_analysis_level: "detailed",
  ai_automatic_analysis: "daily",
  ai_language: "English",
  notify_profit_drops: true,
  notify_revenue_increase: true,
  notify_occupancy_falls: true,
  notify_backup_completed: true,
  notify_monthly_report: true,
  appearance_theme: "light",
  appearance_accent: "default",
  appearance_compact: false,
  appearance_animations: true,
  dashboard_default: "financial",
  dashboard_show_ai_summary: true,
  dashboard_show_forecast: true,
  dashboard_default_year: "current",
  import_encoding: "UTF-8",
  import_delimiter: ",",
  import_date_format: "DD/MM/YYYY",
  report_default: "annual",
  report_default_format: "pdf",
  report_auto_generate: "monthly",
  report_send_email: false,
};

interface SettingsContextType {
  /** Last persisted settings (committed to the backend). */
  settings: Record<string, any>;
  ready: boolean;
  /** Whether the working draft differs from what's persisted. */
  dirty: boolean;
  saving: boolean;
  /** Update a single field in the working draft (no network call yet). */
  updateSetting: (key: string, value: any) => void;
  /** Update several fields in the working draft. */
  updateSettings: (updates: Record<string, any>) => void;
  /** Send the whole draft to the backend in one request. Returns success. */
  save: () => Promise<boolean>;
  /** Discard unsaved draft changes (revert to persisted settings). */
  reset: () => void;
  /** Read from the draft — the UI previews edits live until Save is pressed. */
  get: (key: string, fallback?: any) => any;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // `settings` = last committed (persisted) values; `draft` = working copy.
  const [settings, setSettings] = useState<Record<string, any>>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<Record<string, any>>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const { setTheme } = useTheme();
  const queryClient = useQueryClient();

  const load = useCallback(async () => {
    try {
      const data = await api.get<Record<string, any>>("/settings");
      setSettings((prev) => ({ ...prev, ...data }));
      setDraft((prev) => ({ ...prev, ...data }));
    } catch {
      // Backend not ready yet — keep local defaults.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Draft updates only — no network call until the user presses Save.
  const updateSettings = useCallback((updates: Record<string, any>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateSetting = useCallback(
    (key: string, value: any) => updateSettings({ [key]: value }),
    [updateSettings]
  );

  const save = useCallback(async () => {
    setSaving(true);
    try {
      // Send ONLY the keys that actually changed — never the whole draft.
      // This avoids re-writing untouched defaults and keeps the masked AI key
      // placeholder (or any secret) from being echoed back to the backend.
      const changes: Record<string, any> = {};
      for (const k of Object.keys(draft)) {
        if (draft[k] !== settings[k]) changes[k] = draft[k];
      }
      const data = await api.put<Record<string, any>>("/settings", {
        settings: changes,
      });
      setSettings((prev) => ({ ...prev, ...data }));
      setDraft((prev) => ({ ...prev, ...data }));
      // The AI advisor report depends on AI settings — refresh it so the
      // page reflects the active engine (rules vs. the configured LLM).
      queryClient.invalidateQueries({ queryKey: ["ai-advisor"] });
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, settings, queryClient]);

  const reset = useCallback(() => {
    setDraft(settings);
  }, [settings]);

  const dirty = useMemo(
    () => Object.keys(draft).some((k) => draft[k] !== settings[k]),
    [draft, settings]
  );

  const get = useCallback(
    (key: string, fallback?: any) => {
      const v = draft[key];
      return v === undefined || v === null ? fallback : v;
    },
    [draft]
  );

  // ── Language side-effects: locale-aware dates/numbers + RTL direction ──
  // Driven by the *committed* settings so the UI only switches after Save.
  const language = settings.language ?? "English";
  useEffect(() => {
    setAppLocale(languageToLocale(language));
    document.documentElement.dir = isRtlLanguage(language) ? "rtl" : "ltr";
    document.documentElement.lang = languageToLocale(language);
  }, [language]);

  // ── Appearance side-effects (committed settings only — apply on Save) ──
  const theme = settings.appearance_theme ?? "light";
  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

  const accent = settings.appearance_accent ?? "default";
  const compact = !!settings.appearance_compact;
  const animations = settings.appearance_animations !== false;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accent;
    root.classList.toggle("compact", !!compact);
    root.classList.toggle("no-anim", !animations);
  }, [accent, compact, animations]);

  const value = useMemo(
    () => ({
      settings,
      ready,
      dirty,
      saving,
      updateSetting,
      updateSettings,
      save,
      reset,
      get,
    }),
    [settings, ready, dirty, saving, updateSetting, updateSettings, save, reset, get]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
