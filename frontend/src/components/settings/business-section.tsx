"use client";

import { SectionCard } from "./section-card";
import { SettingRow, selectCls } from "./setting-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/contexts/settings-context";
import { useI18n } from "@/lib/i18n";
import { Building2 } from "lucide-react";

const COUNTRIES = [
  "Morocco", "France", "Spain", "Portugal", "Italy", "Greece",
  "Germany", "United Kingdom", "United States", "United Arab Emirates",
];

export function BusinessSection() {
  const { get, updateSetting } = useSettings();
  const { t } = useI18n();

  return (
    <SectionCard
      title={t("settings.business")}
      icon={<Building2 className="h-5 w-5" />}
      description={t("settings.businessDesc")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Business Name</Label>
          <Input
            value={get("business_name", "")}
            onChange={(e) => updateSetting("business_name", e.target.value)}
            className="mt-1"
            placeholder="Your business name"
          />
        </div>
        <div>
          <Label className="text-xs">Country</Label>
          <select
            className={`${selectCls} mt-1 w-full`}
            value={get("country", "")}
            onChange={(e) => updateSetting("country", e.target.value)}
          >
            <option value="">— Select —</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-2 divide-y">
        <SettingRow label="Default Currency" hint="Used when generating reports">
          <select
            className={selectCls}
            value={get("default_currency", "EUR")}
            onChange={(e) => updateSetting("default_currency", e.target.value)}
          >
            {["EUR", "USD", "GBP", "MAD", "AED", "CAD", "AUD", "CHF"].map((c) => (
              <option key={c} value={c}>{c}</option>
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
