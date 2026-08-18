"use client";

import { SectionCard } from "./section-card";
import { SettingRow, selectCls } from "./setting-row";
import { Toggle } from "./toggle";
import { useSettings } from "@/contexts/settings-context";
import { Palette } from "lucide-react";

const ACCENTS = [
  { id: "default", label: "HostWise", color: "rgb(255, 56, 92)" },
  { id: "blue", label: "Blue", color: "rgb(59, 130, 246)" },
  { id: "green", label: "Green", color: "rgb(16, 150, 100)" },
  { id: "purple", label: "Purple", color: "rgb(124, 58, 237)" },
  { id: "orange", label: "Orange", color: "rgb(234, 88, 12)" },
];

export function AppearanceSection() {
  const { get, updateSetting } = useSettings();

  return (
    <SectionCard
      title="Appearance"
      icon={<Palette className="h-5 w-5" />}
      description="Theme, accent color, and interface density."
    >
      <div className="divide-y">
        <SettingRow label="Theme" hint="Applies across the whole app">
          <select
            className={selectCls}
            value={get("appearance_theme", "light")}
            onChange={(e) => updateSetting("appearance_theme", e.target.value)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </SettingRow>

        <div className="py-2.5">
          <p className="text-sm font-medium">Accent Color</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => updateSetting("appearance_accent", a.id)}
                title={a.label}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 ${
                  get("appearance_accent", "default") === a.id
                    ? "border-foreground"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: a.color }}
              >
                {get("appearance_accent", "default") === a.id && (
                  <span className="text-xs text-white font-bold">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <SettingRow label="Compact Mode" hint="Tighter spacing throughout the app">
          <Toggle
            checked={!!get("appearance_compact", false)}
            onChange={(v) => updateSetting("appearance_compact", v)}
          />
        </SettingRow>
        <SettingRow label="Animations" hint="Enable transitions and motion">
          <Toggle
            checked={!!get("appearance_animations", true)}
            onChange={(v) => updateSetting("appearance_animations", v)}
          />
        </SettingRow>
      </div>
    </SectionCard>
  );
}
