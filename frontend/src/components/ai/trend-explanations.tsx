"use client";

import { ReportSection } from "@/components/reports/report-section";
import { ArrowUpRight, ArrowDownRight, Info } from "lucide-react";
import type { AdvisorReport, TrendExplanation } from "@/lib/ai-types";

function TrendRow({ trend }: { trend: TrendExplanation }) {
  const up = trend.direction === "up";
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{trend.metric}</p>
        <span
          className={`inline-flex items-center gap-1 text-sm font-semibold ${
            up ? "text-success" : "text-destructive"
          }`}
        >
          {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          {trend.change_pct === null || trend.change_pct === undefined
            ? "—"
            : `${up ? "+" : ""}${trend.change_pct}%`}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {up ? "Increased because" : "Decreased because"}
      </p>
      <ul className="mt-1 space-y-0.5">
        {trend.reasons.map((r) => (
          <li key={r} className="flex items-start gap-1.5 text-xs">
            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrendExplanations({ report }: { report: AdvisorReport }) {
  return (
    <ReportSection
      title="Why It Happened"
      icon={<Info className="h-5 w-5" />}
      description="Not just numbers — the reasons behind your KPIs"
    >
      {report.trend_explanations.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not enough history to explain trends yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {report.trend_explanations.map((t) => (
            <TrendRow key={t.metric} trend={t} />
          ))}
        </div>
      )}
    </ReportSection>
  );
}
