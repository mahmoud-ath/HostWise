"use client";

import { SectionCard } from "./section-card";
import { SettingRow, selectCls } from "./setting-row";
import { useSettings } from "@/contexts/settings-context";
import { Bell } from "lucide-react";

const NOTIFY_TOGGLES: { key: string; label: string; hint: string }[] = [
  { key: "notify_profit_drops", label: "Profit drops", hint: "When monthly profit falls vs the previous month" },
  { key: "notify_revenue_increase", label: "Revenue increases", hint: "When monthly revenue grows vs the previous month" },
  { key: "notify_occupancy_falls", label: "Occupancy falls", hint: "When occupancy drops vs the previous month" },
  { key: "notify_backup_completed", label: "Backup completed", hint: "After a successful data backup" },
  { key: "notify_monthly_report", label: "Report ready", hint: "When a scheduled report is generated" },
];

export function NotificationsSection() {
  const { get, updateSetting } = useSettings();

  return (
    <SectionCard
      title="Notifications"
      icon={<Bell className="h-5 w-5" />}
      description="Choose what HostWise tells you about. Notifications appear in the bell at the top-right."
    >
      <div className="divide-y">
        {NOTIFY_TOGGLES.map((row) => (
          <SettingRow key={row.key} label={row.label} hint={row.hint}>
            <label className="flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={Boolean(get(row.key, true))}
                onChange={(e) => updateSetting(row.key, e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
            </label>
          </SettingRow>
        ))}
        <SettingRow label="Auto-generate report" hint="Schedule for the 'report ready' notification">
          <select
            className={selectCls}
            value={get("report_auto_generate", "monthly")}
            onChange={(e) => updateSetting("report_auto_generate", e.target.value)}
          >
            <option value="off">Off</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </SettingRow>
        <SettingRow label="Send report by email" hint="Email delivery is planned — notifications are in-app for now">
          <label className="flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={Boolean(get("report_send_email", false))}
              onChange={(e) => updateSetting("report_send_email", e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
        </SettingRow>
      </div>
    </SectionCard>
  );
}
