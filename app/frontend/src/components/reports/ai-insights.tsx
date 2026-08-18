"use client";

import { ReportSection } from "./report-section";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, Lightbulb, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { PortfolioReport } from "@/lib/report-types";

function changeIcon(change: number | null) {
  if (change === null || change === undefined) return <Minus className="h-3.5 w-3.5" />;
  return change >= 0 ? (
    <ArrowUpRight className="h-3.5 w-3.5 text-success" />
  ) : (
    <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
  );
}

export function AIInsights({ report }: { report: PortfolioReport }) {
  const ai = report.ai_insights;
  const risk = ai.biggest_risk;

  return (
    <ReportSection
      title="AI Executive Insights"
      icon={<Sparkles className="h-5 w-5" />}
      description="Generated from your booking and financial data"
      action={
        ai.revenue_change_pct !== null && ai.revenue_change_pct !== undefined ? (
          <Badge
            variant={ai.revenue_change_pct >= 0 ? "success" : "destructive"}
            className="gap-1"
          >
            {changeIcon(ai.revenue_change_pct)}
            {ai.revenue_change_pct >= 0 ? "+" : ""}
            {ai.revenue_change_pct}% YoY
          </Badge>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <Badge variant="outline" className="gap-1 self-start">
          <Sparkles className="h-3 w-3" />
          {!ai.provider || ai.provider === "hostwise"
            ? "HostWise rules engine"
            : `LLM · ${ai.provider}`}
        </Badge>
        {ai.summary && (
          <p className="text-sm leading-relaxed text-foreground/90">{ai.summary}</p>
        )}

        {ai.drivers.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What drove the change
            </p>
            <div className="flex flex-wrap gap-2">
              {ai.drivers.map((d) => (
                <div
                  key={d.label}
                  className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1.5 text-sm"
                >
                  <span className="font-medium">{d.label}</span>
                  <span className="text-muted-foreground">{d.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {risk && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Biggest Risk
              </div>
              <p className="mt-2 text-sm font-medium">{risk.title}</p>
              {risk.cause && <p className="mt-1 text-sm text-muted-foreground">{risk.cause}</p>}
            </div>
          )}
          <div className="rounded-lg border border-success/30 bg-success/5 p-4">
            <div className="flex items-center gap-2 font-semibold text-success">
              <Lightbulb className="h-4 w-4" />
              Recommendation
            </div>
            <p className="mt-2 text-sm font-medium">{ai.recommendation}</p>
          </div>
        </div>
      </div>
    </ReportSection>
  );
}
