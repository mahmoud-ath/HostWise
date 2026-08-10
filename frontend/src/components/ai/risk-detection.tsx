"use client";

import { ReportSection } from "@/components/reports/report-section";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { AdvisorReport, PropertyRisk } from "@/lib/ai-types";

function RiskCard({ risk }: { risk: PropertyRisk }) {
  const high = risk.level === "high";
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{risk.property_name}</p>
        <Badge variant={high ? "destructive" : "secondary"}>
          {high ? "High Risk" : "Medium Risk"}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Profit Margin</p>
          <p className={`font-semibold ${(risk.profit_margin ?? 0) < 0 ? "text-destructive" : "text-success"}`}>
            {risk.profit_margin ?? 0}%
          </p>
        </div>
        <div className="rounded-md bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Revenue Trend</p>
          <p className={`font-semibold ${(risk.revenue_trend_pct ?? 0) < 0 ? "text-destructive" : "text-success"}`}>
            {risk.revenue_trend_pct == null ? "—" : `${risk.revenue_trend_pct}%`}
          </p>
        </div>
      </div>
      {risk.recommendation && (
        <p className="mt-3 text-xs">
          <span className="font-medium">Recommendation:</span>{" "}
          <span className="text-muted-foreground">{risk.recommendation}</span>
        </p>
      )}
    </div>
  );
}

export function RiskDetection({ report }: { report: AdvisorReport }) {
  const risks = Array.isArray(report.risks) ? report.risks : [];

  return (
    <ReportSection
      title="Risk Detection"
      icon={<ShieldAlert className="h-5 w-5" />}
      description="Properties that need attention"
    >
      {risks.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
          <ShieldCheck className="h-5 w-5 text-success" />
          No high-risk properties detected.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {risks.map((r, i) => (
            <RiskCard key={`${r.property_name}-${i}`} risk={r} />
          ))}
        </div>
      )}
    </ReportSection>
  );
}
