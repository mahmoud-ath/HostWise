"use client";

import { ReportSection } from "@/components/reports/report-section";
import { ProgressBar } from "@/components/reports/progress-bar";
import { HeartPulse } from "lucide-react";
import type { AdvisorReport } from "@/lib/ai-types";

const COMPONENT_COLORS: Record<string, string> = {
  revenue: "bg-primary",
  expenses: "bg-blue-500",
  growth: "bg-success",
  risk: "bg-amber-500",
};

export function BusinessHealthScore({ report }: { report: AdvisorReport }) {
  const health = report.health_score;
  const statusColor =
    health.status === "excellent"
      ? "text-success"
      : health.status === "good"
      ? "text-foreground"
      : health.status === "average"
      ? "text-amber-500"
      : "text-destructive";

  const bars = [
    { key: "revenue", label: "Revenue" },
    { key: "expenses", label: "Expenses" },
    { key: "growth", label: "Growth" },
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
                  {health.components[b.key]}/100
                </span>
              </div>
              <ProgressBar value={health.components[b.key]} color={COMPONENT_COLORS[b.key]} />
            </div>
          ))}
        </div>
      </div>
    </ReportSection>
  );
}
