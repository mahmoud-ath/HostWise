"use client";

import { useState } from "react";
import { SectionCard } from "./section-card";
import { SettingRow, selectCls } from "./setting-row";
import { Toggle } from "./toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useSettings } from "@/contexts/settings-context";
import { useI18n } from "@/lib/i18n";
import { Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react";

const PROVIDERS = [
  { id: "hostwise", label: "HostWise AI (built-in rules)" },
  { id: "openai", label: "OpenAI" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "anthropic", label: "Anthropic (OpenAI-compatible)" },
  { id: "ollama", label: "Local LLM / Ollama" },
];

// Recommended endpoint + model when switching to an external provider.
const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  anthropic: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  ollama: { baseUrl: "http://localhost:11434", model: "llama3" },
};

export function AISection() {
  const { get, updateSetting } = useSettings();
  const { t } = useI18n();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const isHostWise = get("ai_provider", "hostwise") === "hostwise";
  const hasKey = !!get("ai_api_key", "");

  const testConnection = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await api.post<{ ok: boolean; message: string }>("/ai/test-connection");
      setResult(res);
    } catch (err: any) {
      setResult({ ok: false, message: err.message || "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <SectionCard
      title={t("settings.ai")}
      icon={<Sparkles className="h-5 w-5" />}
      description={t("settings.aiDesc")}
    >
      <div className="divide-y">
        <SettingRow label="AI Enabled" hint="Turn insights and recommendations on/off">
          <Toggle
            checked={!!get("ai_enabled", true)}
            onChange={(v) => updateSetting("ai_enabled", v)}
          />
        </SettingRow>
        <SettingRow label="AI Provider" hint="HostWise rules engine, or your own LLM (OpenAI, DeepSeek…). External providers receive your data as JSON and power the advisor page.">
          <select
            className={selectCls}
            value={get("ai_provider", "hostwise")}
            onChange={(e) => {
              const provider = e.target.value;
              updateSetting("ai_provider", provider);
              const d = PROVIDER_DEFAULTS[provider];
              if (d) {
                updateSetting("ai_base_url", d.baseUrl);
                updateSetting("ai_model", d.model);
              }
            }}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </SettingRow>

        {!isHostWise && (
          <>
            <SettingRow label="API Key" hint="Stored locally, sent only to your provider. Saved keys are shown masked.">
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  className="h-9 w-64"
                  value={get("ai_api_key", "")}
                  onChange={(e) => updateSetting("ai_api_key", e.target.value)}
                  placeholder="sk-..."
                />
                {hasKey && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => updateSetting("ai_api_key", "")}
                    title="Remove the saved API key"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </SettingRow>
            <SettingRow label="Base URL" hint="OpenAI-compatible endpoint">
              <Input
                className="h-9 w-64"
                value={get("ai_base_url", "https://api.openai.com/v1")}
                onChange={(e) => updateSetting("ai_base_url", e.target.value)}
              />
            </SettingRow>
            <SettingRow label="Model">
              <Input
                className="h-9 w-64"
                value={get("ai_model", "gpt-4o-mini")}
                onChange={(e) => updateSetting("ai_model", e.target.value)}
                placeholder="gpt-4o-mini / llama3"
              />
            </SettingRow>
            <SettingRow label="Connection">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={testConnection} disabled={testing || !hasKey}>
                  {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Test Connection
                </Button>
                {hasKey ? (
                  <Badge variant="secondary">Key saved</Badge>
                ) : (
                  <Badge variant="outline">No key</Badge>
                )}
              </div>
            </SettingRow>
            {result && (
              <div
                className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                  result.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                }`}
              >
                {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{result.message}</span>
              </div>
            )}
            <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">What is sent to your LLM provider?</p>
              <p>
                With an external provider enabled, HostWise sends your <span className="font-medium">real portfolio data</span> as JSON to
                that provider to generate the advisor report: current metrics (net revenue, profit, expenses),
                month-over-month growth, the monthly breakdown, expense categories, and the property ranking.
                Your API key is only sent to that provider&apos;s endpoint. The built-in HostWise rules engine (no
                external provider) keeps everything 100% local.
              </p>
            </div>
          </>
        )}

        <SettingRow label="Analysis Level" hint="Detailed includes property-level reviews">
          <select
            className={selectCls}
            value={get("ai_analysis_level", "detailed")}
            onChange={(e) => updateSetting("ai_analysis_level", e.target.value)}
          >
            <option value="summary">Summary</option>
            <option value="detailed">Detailed</option>
            <option value="expert">Expert</option>
          </select>
        </SettingRow>
        <SettingRow label="Automatic Analysis" hint="How often the AI reviews your data">
          <select
            className={selectCls}
            value={get("ai_automatic_analysis", "daily")}
            onChange={(e) => updateSetting("ai_automatic_analysis", e.target.value)}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="off">Off</option>
          </select>
        </SettingRow>
        <SettingRow label="AI Language">
          <select
            className={selectCls}
            value={get("ai_language", "English")}
            onChange={(e) => updateSetting("ai_language", e.target.value)}
          >
            {["English", "Français", "Español", "العربية", "Deutsch"].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </SettingRow>
      </div>
    </SectionCard>
  );
}
