"use client";

import { ReportSection } from "./report-section";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { PortfolioReport } from "@/lib/report-types";

function healthBadge(score: number | null | undefined) {
  if (score === null || score === undefined) return <span className="text-muted-foreground">—</span>;
  const variant =
    score >= 75 ? "success" : score >= 50 ? "default" : score >= 25 ? "secondary" : "destructive";
  return (
    <Badge variant={variant as "success" | "default" | "secondary" | "destructive"}>{score}</Badge>
  );
}

export function PropertyPerformance({ report }: { report: PortfolioReport }) {
  const rows = report.property_performance;
  const currency = report.currency;

  return (
    <ReportSection
      title="Property Performance"
      icon={<Building2 className="h-5 w-5" />}
      description="Revenue, expenses and profitability per property"
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No property data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Property</th>
                <th className="pb-2 pr-4 font-medium">Revenue</th>
                <th className="pb-2 pr-4 font-medium">Expenses</th>
                <th className="pb-2 pr-4 font-medium">Profit</th>
                <th className="pb-2 pr-4 font-medium">Margin</th>
                <th className="pb-2 font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.property_id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{p.property_name}</td>
                  <td className="py-3 pr-4">{formatCurrency(p.net_revenue, currency)}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatCurrency(p.total_expenses, currency)}
                  </td>
                  <td className="py-3 pr-4 font-semibold">
                    {formatCurrency(p.profit, currency)}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={p.profit_margin >= 0 ? "text-success" : "text-destructive"}>
                      {p.profit_margin}%
                    </span>
                  </td>
                  <td className="py-3">{healthBadge(p.health_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportSection>
  );
}
