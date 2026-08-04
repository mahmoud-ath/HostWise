"use client";

import { ReportSection } from "./report-section";
import { BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { PortfolioReport, KpiValue } from "@/lib/report-types";

interface KpiRow {
  key: keyof PortfolioReport["kpi_comparison"];
  label: string;
  format: (v: number, currency: string) => string;
}

const ROWS: KpiRow[] = [
  { key: "revenue", label: "Revenue", format: (v, c) => formatCurrency(v, c) },
  { key: "profit", label: "Profit", format: (v, c) => formatCurrency(v, c) },
  { key: "expenses", label: "Expenses", format: (v, c) => formatCurrency(v, c) },
];

function Change({ change }: { change: number | null }) {
  if (change === null || change === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  const positive = change >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-semibold ${
        positive ? "text-success" : "text-destructive"
      }`}
    >
      {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
      {positive ? "+" : ""}
      {change.toFixed(1)}%
    </span>
  );
}

export function KpiComparison({ report }: { report: PortfolioReport }) {
  const kpi = report.kpi_comparison;

  return (
    <ReportSection
      title="Financial KPIs"
      icon={<BarChart3 className="h-5 w-5" />}
      description={
        report.previous_period
          ? `${report.previous_period.label} vs ${report.period?.label ?? report.year}`
          : `Previous year (${report.year - 1}) vs ${report.year}`
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">KPI</th>
              <th className="pb-2 pr-4 font-medium">Previous</th>
              <th className="pb-2 pr-4 font-medium">Current</th>
              <th className="pb-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const value: KpiValue = kpi[row.key];
              if (!value) return null;
              return (
                <tr key={row.key} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{row.label}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {row.format(value.previous, report.currency)}
                  </td>
                  <td className="py-3 pr-4 font-semibold">
                    {row.format(value.current, report.currency)}
                  </td>
                  <td className="py-3">
                    <Change change={value.change_pct} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ReportSection>
  );
}
