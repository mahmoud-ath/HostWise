"use client";

import { ReportSection } from "./report-section";
import { HeartPulse } from "lucide-react";
import { ProgressBar } from "./progress-bar";
import type { PortfolioReport } from "@/lib/report-types";

const COMPONENT_COLORS: Record<string, string> = {
  revenue: "bg-primary",
  profit: "bg-success",
  occupancy: "bg-amber-500",
  expenses: "bg-blue-500",
};

export function PortfolioHealth({ report }: { report: PortfolioReport }) {
  const health = report.portfolio_health;

  // No properties/financial records yet → nothing to score (no fabricated 50s).
  if (health.score === null || health.status === "no_data") {
    return (
      <ReportSection
        title="Portfolio Health"
        icon={<HeartPulse className="h-5 w-5" />}
        description="Overall health across revenue, profit, occupancy and expenses"
      >
        <p className="py-8 text-center text-sm text-muted-foreground">
          No data yet — add properties, revenue or expenses to see your portfolio health.
        </p>
      </ReportSection>
    );
  }

  const { components, distribution } = health;
  const revenueGrowth = health.components.revenue_change_pct;

  const bars = [
    { key: "revenue", label: "Revenue" },
    { key: "profit", label: "Profit" },
    { key: "expenses", label: "Expenses" },
  ] as const;

  const statusColor =
    health.status === "excellent"
      ? "text-success"
      : health.status === "good"
      ? "text-foreground"
      : health.status === "average"
      ? "text-amber-500"
      : "text-destructive";

  return (
    <ReportSection
      title="Portfolio Health"
      icon={<HeartPulse className="h-5 w-5" />}
      description="Overall health across revenue, profit, occupancy and expenses"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center justify-center">
          <div
            className="relative flex h-32 w-32 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--primary) ${health.score * 3.6}deg, var(--muted) 0deg)`,
            }}
          >
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-card">
              <span className="text-3xl font-bold">{health.score}</span>
              <span className={`text-xs font-medium capitalize ${statusColor}`}>
                {health.status}
              </span>
            </div>
          </div>
          <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
            {(["excellent", "good", "average", "poor"] as const).map((k) => (
              <span key={k} className="capitalize">
                {k}: {distribution[k]}
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {bars.map((b) => (
            <div key={b.key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  {b.label}
                  {b.key === "revenue" && revenueGrowth !== undefined && (
                    <span
                      className={`text-xs font-normal ${
                        revenueGrowth < 0 ? "text-destructive" : "text-success"
                      }`}
                    >
                      {revenueGrowth < 0 ? "↓" : "↑"} {Math.abs(revenueGrowth).toFixed(1)}% vs prev
                      period
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">{components[b.key]}/100</span>
              </div>
              <ProgressBar value={components[b.key] ?? 0} color={COMPONENT_COLORS[b.key]} />
            </div>
          ))}
        </div>
      </div>
    </ReportSection>
  );
}
