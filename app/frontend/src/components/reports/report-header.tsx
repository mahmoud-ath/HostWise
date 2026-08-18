"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, CalendarRange, Loader2, Printer } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { downloadFile } from "@/lib/download";
import type { PortfolioReport } from "@/lib/report-types";
import { isCustomPeriod, normalizeRange, type ReportPeriod } from "@/lib/report-period";

const CURRENCIES = ["EUR", "USD", "GBP", "MAD", "AED", "CAD", "AUD", "CHF"];
const MAX_YEAR_RANGE = 6;

export function ReportHeader({
  report,
  period,
  onPeriodChange,
  currency,
  onCurrencyChange,
  loading,
}: {
  report?: PortfolioReport;
  period: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  loading: boolean;
}) {
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: MAX_YEAR_RANGE }, (_, i) => currentYear - i);
  const isCustom = isCustomPeriod(period);
  const activeYear = period.year ?? currentYear;
  if (!years.includes(activeYear)) years.unshift(activeYear);
  years.sort((a, b) => b - a);
  const [customStart, setCustomStart] = useState(period.start || "");
  const [customEnd, setCustomEnd] = useState(period.end || "");

  const canExport = !!report;
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!report) return;
    setGenerating(true);
    try {
      const params = new URLSearchParams();
      params.set("format", "pdf");
      if (period.year) params.set("year", String(period.year));
      if (period.start) params.set("start_date", period.start);
      if (period.end) params.set("end_date", period.end);
      params.set("currency", currency);
      // Desktop opens a native "Save As" dialog; the browser downloads.
      await downloadFile(`/reports/export?${params.toString()}`, "hostwise-report.pdf");
    } catch (err) {
      console.error("Could not export report:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handlePeriodChange = (value: string) => {
    if (value === "custom") {
      const start = customStart || `${activeYear}-01-01`;
      const end = customEnd || `${activeYear}-12-31`;
      setCustomStart(start);
      setCustomEnd(end);
      onPeriodChange({ start, end });
    } else {
      onPeriodChange({ year: parseInt(value, 10) });
    }
  };

  const handleCustomStart = (value: string) => {
    setCustomStart(value);
    if (value && customEnd) {
      const { start, end } = normalizeRange(value, customEnd);
      setCustomStart(start);
      setCustomEnd(end);
      onPeriodChange({ start, end });
    }
  };

  const handleCustomEnd = (value: string) => {
    setCustomEnd(value);
    if (customStart && value) {
      const { start, end } = normalizeRange(customStart, value);
      setCustomStart(start);
      setCustomEnd(end);
      onPeriodChange({ start, end });
    }
  };

  const selectCls =
    "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <CalendarRange className="h-7 w-7 text-primary" />
              {t("pages.reports.title")}
            </h1>
            <p className="mt-1 text-muted-foreground">{t("pages.reports.subtitle")}</p>
            {report && (
              <p className="mt-1 text-xs text-muted-foreground">
                {report.organization} · {report.period?.label ?? report.year} · Generated{" "}
                {formatDate(report.generated_at)} · {report.currency}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <select
              className={selectCls}
              value={isCustom ? "custom" : String(activeYear)}
              onChange={(e) => handlePeriodChange(e.target.value)}
              aria-label="Report period"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y === currentYear ? `This year (${y})` : y}
                </option>
              ))}
              <option value="custom">Custom range…</option>
            </select>
            {isCustom && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  className={selectCls}
                  value={customStart}
                  onChange={(e) => handleCustomStart(e.target.value)}
                  aria-label="Start date"
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="date"
                  className={selectCls}
                  value={customEnd}
                  onChange={(e) => handleCustomEnd(e.target.value)}
                  aria-label="End date"
                />
              </div>
            )}
            <select
              className={selectCls}
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value)}
              aria-label="Report currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={!canExport} onClick={() => window.print()} title="Open the print dialog to save a styled PDF (KPI cards, charts, tables)">
                <Printer className="mr-1.5 h-4 w-4" />
                Print / Save PDF
              </Button>
              <Button variant="outline" size="sm" disabled={!canExport || generating} onClick={handleGenerate} title="Download PDF (generated by the backend)">
                <FileText className="mr-1.5 h-4 w-4" />
                {generating ? "Generating…" : "Generate Report"}
              </Button>
              {(loading || generating) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
