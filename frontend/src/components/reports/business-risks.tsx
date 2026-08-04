"use client";

import { ReportSection } from "./report-section";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { PortfolioReport, RiskItem } from "@/lib/report-types";

function RiskRow({ risk }: { risk: RiskItem }) {
  const high = risk.level === "high";
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          high ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-600"
        }`}
      >
        <ShieldAlert className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-semibold">{risk.title}</p>
        {risk.detail && <p className="mt-0.5 text-sm text-muted-foreground">{risk.detail}</p>}
      </div>
    </div>
  );
}

export function BusinessRisks({ report }: { report: PortfolioReport }) {
  const risks = report.risks;

  return (
    <ReportSection
      title="Business Risks"
      icon={<ShieldAlert className="h-5 w-5" />}
      description="Signals that could impact performance"
    >
      {risks.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
          <ShieldCheck className="h-5 w-5 text-success" />
          No significant risks detected for this period.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {risks.map((r, i) => (
            <RiskRow key={`${r.title}-${i}`} risk={r} />
          ))}
        </div>
      )}
    </ReportSection>
  );
}
