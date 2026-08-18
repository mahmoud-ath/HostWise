"use client";

import { ReportSection } from "./report-section";
import { CalendarRange } from "lucide-react";
import { formatCurrency, getMonthName } from "@/lib/utils";
import type { PortfolioReport } from "@/lib/report-types";

export function MonthlyTimeline({ report }: { report: PortfolioReport }) {
  const months = report.monthly_breakdown;
  const currency = report.currency;
  const max = Math.max(...months.map((m) => m.net_revenue), 1);

  return (
    <ReportSection
      title="Monthly Breakdown"
      icon={<CalendarRange className="h-5 w-5" />}
      description={`Net revenue per month — ${report.year}`}
    >
      <div className="space-y-2">
        {months.map((m) => (
          <div key={m.month} className="flex items-center gap-3 text-sm">
            <span className="w-20 shrink-0 font-medium text-muted-foreground">
              {getMonthName(m.month)}
            </span>
            <div className="flex h-6 flex-1 items-center overflow-hidden rounded bg-muted/60">
              <div
                className="flex h-full items-center rounded bg-primary/80 px-2 bg-primary"
                style={{ width: `${Math.max((m.net_revenue / max) * 100, m.net_revenue > 0 ? 3 : 0)}%` }}
              >
                {m.net_revenue > 0 && (
                  <span className="truncate text-xs font-medium text-primary-foreground">
                    {formatCurrency(m.net_revenue, currency)}
                  </span>
                )}
              </div>
            </div>
            <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
              {m.net_revenue > 0 ? `${Math.round((m.net_revenue / max) * 100)}%` : "—"}
            </span>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}
