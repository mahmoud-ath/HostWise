"use client";

import { ReportSection } from "./report-section";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ProgressBar } from "./progress-bar";
import type { PortfolioReport } from "@/lib/report-types";

export function Forecast({ report }: { report: PortfolioReport }) {
  const f = report.forecast;

  return (
    <ReportSection
      title="AI Forecast"
      icon={<TrendingUp className="h-5 w-5" />}
      description={`Expected performance for the quarter after ${report.year}`}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Expected Revenue · Next Quarter</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {formatCurrency(f.next_quarter_revenue, report.currency)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-2xl font-bold">{f.confidence}%</span>
              <ProgressBar value={f.confidence} className="flex-1" color="bg-success" />
            </div>
          </CardContent>
        </Card>
      </div>
    </ReportSection>
  );
}
