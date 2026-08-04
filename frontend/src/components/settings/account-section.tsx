"use client";

import { SectionCard } from "./section-card";
import { SettingRow, selectCls } from "./setting-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/contexts/settings-context";
import { useI18n } from "@/lib/i18n";
import { User } from "lucide-react";

export function AccountSection() {
  const { get, updateSetting } = useSettings();
  const { t } = useI18n();

  return (
    <SectionCard
      title={t("settings.profile")}
      icon={<User className="h-5 w-5" />}
      description={t("settings.profileDesc")}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Name</Label>
          <Input
            className="mt-1"
            value={get("profile_name", "")}
            onChange={(e) => updateSetting("profile_name", e.target.value)}
            placeholder="Your name"
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
        <SettingRow label="Currency" hint="Used across the app for formatting">
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
        <SettingRow label="Language" hint="Formats dates & numbers; Arabic switches the UI to RTL">
          <select
            className={selectCls}
            value={get("language", "English")}
            onChange={(e) => updateSetting("language", e.target.value)}
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
