"use client";

import { SectionCard } from "./section-card";
import { SettingRow, selectCls } from "./setting-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/contexts/settings-context";
import { useI18n } from "@/lib/i18n";
import { Briefcase } from "lucide-react";

const COUNTRIES = [
  "Morocco", "France", "Spain", "Portugal", "Italy", "Greece",
  "Germany", "United Kingdom", "United States", "United Arab Emirates",
];

const CURRENCIES = ["EUR", "USD", "GBP", "MAD", "AED", "CAD", "AUD", "CHF"];
const LANGUAGES = ["English", "Français", "Español", "العربية", "Deutsch"];

// Merged Profile + Business settings (one tab, no redundancy):
// - identity is the business name only (profile "Name" field removed)
// - default currency appears exactly once
// - email, language (was Profile) + country, tax rate, fiscal year (was Business)
export function BusinessSection() {
  const { get, updateSetting } = useSettings();
  const { t } = useI18n();

  return (
    <SectionCard
      title={t("settings.business")}
      icon={<Briefcase className="h-5 w-5" />}
      description={t("settings.businessDesc")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Business Name</Label>
          <Input
            className="mt-1"
            value={get("business_name", "")}
            onChange={(e) => updateSetting("business_name", e.target.value)}
            placeholder="Your business name"
          />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input
            className="mt-1"
            type="email"
            value={get("profile_email", "")}
            onChange={(e) => updateSetting("profile_email", e.target.value)}
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div className="mt-2 divide-y">
        <SettingRow label="Country" hint="Where your business is based">
          <select
            className={selectCls}
            value={get("country", "")}
            onChange={(e) => updateSetting("country", e.target.value)}
          >
            <option value="">— Select —</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Default Currency" hint="Used across the app for formatting & reports">
          <select
            className={selectCls}
            value={get("default_currency", "EUR")}
            onChange={(e) => updateSetting("default_currency", e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Language" hint="Formats dates & numbers; Arabic switches the UI to RTL">
          <select
            className={selectCls}
            value={get("language", "English")}
            onChange={(e) => updateSetting("language", e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Tax Rate" hint="Used in the Tax Summary">
          <Input
            type="number"
            className="h-9 w-24 text-right"
            value={get("tax_rate", 0)}
            min={0}
            max={100}
            onChange={(e) => updateSetting("tax_rate", parseFloat(e.target.value) || 0)}
          />
        </SettingRow>
        <SettingRow label="Fiscal Year Start">
          <select
            className={selectCls}
            value={get("fiscal_year_start", 1)}
            onChange={(e) => updateSetting("fiscal_year_start", parseInt(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2024, m - 1, 1).toLocaleDateString("en-US", { month: "long" })}
              </option>
            ))}
          </select>
        </SettingRow>
      </div>
    </SectionCard>
  );
}
