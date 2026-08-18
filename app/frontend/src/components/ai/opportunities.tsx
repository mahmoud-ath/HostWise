"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ReportSection } from "@/components/reports/report-section";
import { TrendingUp, PiggyBank, Lightbulb, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useSettings } from "@/contexts/settings-context";
import type { AdvisorReport } from "@/lib/ai-types";

export function Opportunities({ report }: { report: AdvisorReport }) {
  const opp = report.opportunities || {};
  const actions = Array.isArray(opp.actions) ? opp.actions : [];
  const lost = report.lost_revenue || {};
  const reasons = Array.isArray(lost.reasons) ? lost.reasons : [];
  const { get } = useSettings();
  const currency = get("default_currency", "EUR") as string;

  return (
    <ReportSection
      title="Opportunities & Lost Revenue"
      icon={<TrendingUp className="h-5 w-5" />}
      description="Upside you can capture — and money left on the table"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* Opportunity Score */}
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Potential Revenue
              </p>
              <span className="text-xs text-muted-foreground">
                Confidence {opp.confidence ?? 0}%
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight text-success">
              +{formatCurrency(opp.potential_revenue ?? 0, currency)}
            </p>
            <div className="mt-3 space-y-2">
              {actions.map((a) => (
                <div
                  key={a.title}
                  className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-success">
                    +{formatCurrency(a.gain ?? 0, currency)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Money left on the table */}
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <PiggyBank className="h-4 w-4 text-destructive" />
              Estimated Lost Revenue
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-destructive">
              {formatCurrency(lost.estimated_lost_revenue ?? 0, currency)}
            </p>
            <div className="mt-3 space-y-2">
              {reasons.map((r) => (
                <div
                  key={r.reason}
                  className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{r.reason}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.detail}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-muted-foreground">
                    {formatCurrency(r.amount ?? 0, currency)}
                  </span>
                </div>
              ))}
              {reasons.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No major leakages detected.
                </p>
              )}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5" />
              Prioritize the opportunity with the highest return first.
            </p>
          </CardContent>
        </Card>
      </div>
    </ReportSection>
  );
}
