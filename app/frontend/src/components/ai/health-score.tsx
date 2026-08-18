"use client";

import { ReportSection } from "@/components/reports/report-section";
import { ProgressBar } from "@/components/reports/progress-bar";
import { HeartPulse } from "lucide-react";
import type { AdvisorReport } from "@/lib/ai-types";

const COMPONENT_COLORS: Record<string, string> = {
  profit: "bg-success",
  growth: "bg-primary",
  expenses: "bg-blue-500",
  risk: "bg-amber-500",
};

export function BusinessHealthScore({ report }: { report: AdvisorReport }) {
  const health = report.health_score || {};
  const components = health.components || {};

  // No properties/financial records yet → nothing to score (no fabricated 50s).
  if (health.score == null || health.status === "no_data") {
    return (
      <ReportSection
        title="Business Health Score"
        icon={<HeartPulse className="h-5 w-5" />}
        description="Overall health from revenue, expenses, growth and risk"
      >
        <p className="py-8 text-center text-sm text-muted-foreground">
          No data yet — add properties, revenue or expenses to see your health score.
        </p>
      </ReportSection>
    );
  }

  const statusColor =
    health.status === "excellent"
      ? "text-success"
      : health.status === "good"
      ? "text-foreground"
      : health.status === "average"
      ? "text-amber-500"
      : "text-destructive";

  const bars = [
    { key: "profit", label: "Profitability" },
    { key: "growth", label: "Revenue Trend" },
    { key: "expenses", label: "Expenses" },
    { key: "risk", label: "Risk" },
  ] as const;

  return (
    <ReportSection
      title="Business Health Score"
      icon={<HeartPulse className="h-5 w-5" />}
      description="Overall health from revenue, expenses, growth and risk"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center">
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
        </div>

        <div className="flex-1 space-y-3">
          {bars.map((b) => (
            <div key={b.key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{b.label}</span>
                <span className="text-muted-foreground">
                  {components[b.key] ?? 0}/100
                </span>
              </div>
              <ProgressBar value={components[b.key] ?? 0} color={COMPONENT_COLORS[b.key]} />
            </div>
          ))}
          <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
            Each pillar is scored out of 100: <strong>Profitability</strong> (profit margin),
            <strong> Revenue Trend</strong> (year-over-year change), <strong>Expenses</strong> (share
            of revenue consumed by costs) and <strong>Risk</strong> (cancellation rate). The overall
            score is a weighted average of the four.
          </p>
        </div>
      </div>
    </ReportSection>
  );
}
