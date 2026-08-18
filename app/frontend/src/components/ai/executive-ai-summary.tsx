"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ReportSection } from "@/components/reports/report-section";
import { Brain, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useSettings } from "@/contexts/settings-context";
import type { AdvisorReport } from "@/lib/ai-types";

export function ExecutiveAISummary({ report }: { report: AdvisorReport }) {
  const m =
    report.current_metrics && typeof report.current_metrics === "object"
      ? report.current_metrics
      : ({} as AdvisorReport["current_metrics"]);
  const { get } = useSettings();
  const currency = get("default_currency", "EUR") as string;

  const metrics = [
    { label: "Net Revenue", value: formatCurrency(m.net_revenue, currency) },
    { label: "Profit", value: formatCurrency(m.profit, currency) },
    { label: "Profit Margin", value: `${m.profit_margin}%` },
    { label: "Total Expenses", value: formatCurrency(m.total_expenses, currency) },
  ];

  const growth = m.revenue_growth_yoy;

  return (
    <ReportSection
      title="Executive AI Summary"
      icon={<Brain className="h-5 w-5" />}
      description="A plain-language read on your portfolio"
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-foreground/90">
          {report.executive_summary}
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((s) => (
            <Card key={s.label} className="border-0 bg-muted/40">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-0.5 text-lg font-bold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Year-over-year revenue:</span>
          {growth === null || growth === undefined ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Minus className="h-4 w-4" /> n/a
            </span>
          ) : growth >= 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <TrendingUp className="h-4 w-4" /> +{growth}%
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-destructive">
              <TrendingDown className="h-4 w-4" /> {growth}%
            </span>
          )}
        </div>
      </div>
    </ReportSection>
  );
}
