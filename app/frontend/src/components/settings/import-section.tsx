"use client";

import { SectionCard } from "./section-card";
import { SettingRow, selectCls } from "./setting-row";
import { useSettings } from "@/contexts/settings-context";
import { useI18n } from "@/lib/i18n";
import { FileUp } from "lucide-react";

export function ImportSection() {
  const { get, updateSetting } = useSettings();
  const { t } = useI18n();

  return (
    <SectionCard
      title={t("settings.dataImport")}
      icon={<FileUp className="h-5 w-5" />}
      description={t("settings.dataImportDesc")}
    >
      <div className="divide-y">
        <SettingRow label="Default Encoding" hint="Character encoding for CSV files">
          <select
            className={selectCls}
            value={get("import_encoding", "UTF-8")}
            onChange={(e) => updateSetting("import_encoding", e.target.value)}
          >
            {["UTF-8", "ISO-8859-1", "Windows-1252", "UTF-16"].map((enc) => (
              <option key={enc} value={enc}>{enc}</option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Delimiter" hint="Column separator">
          <select
            className={selectCls}
            value={get("import_delimiter", ",")}
            onChange={(e) => updateSetting("import_delimiter", e.target.value)}
          >
            {[",", ";", "\t", "|"].map((d) => (
              <option key={d} value={d}>
                {d === "\t" ? "Tab" : d}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Date Format" hint="How dates appear in your files">
          <select
            className={selectCls}
            value={get("import_date_format", "DD/MM/YYYY")}
            onChange={(e) => updateSetting("import_date_format", e.target.value)}
          >
            {["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </SettingRow>
      </div>
    </SectionCard>
  );
}
