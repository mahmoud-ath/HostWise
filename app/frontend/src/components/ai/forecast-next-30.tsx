"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReportSection } from "@/components/reports/report-section";
import { CalendarClock, Gauge, Trophy } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useSettings } from "@/contexts/settings-context";
import type { AdvisorReport } from "@/lib/ai-types";

function riskVariant(level: string) {
  if (level === "high") return "destructive";
  if (level === "medium") return "secondary";
  return "success";
}

export function ForecastNext30({ report }: { report: AdvisorReport }) {
  const f =
    report.forecast && typeof report.forecast === "object"
      ? report.forecast
      : ({} as AdvisorReport["forecast"]);
  const { get } = useSettings();
  const currency = get("default_currency", "EUR") as string;

  return (
    <ReportSection
      title="Next 30 Days"
      icon={<CalendarClock className="h-5 w-5" />}
      description="What the AI expects over the next month"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Expected Revenue</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {formatCurrency(f.expected_revenue ?? 0, currency)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" />
              Risk Level
            </p>
            <div className="mt-2">
              <Badge variant={riskVariant(f.risk_level) as "destructive" | "secondary" | "success"} className="capitalize">
                {f.risk_level}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Trophy className="h-3.5 w-3.5" />
              Best Property
            </p>
            <p className="mt-1 text-lg font-bold">{f.best_property || "—"}</p>
            <p className="text-xs text-muted-foreground">Confidence {f.confidence ?? 0}%</p>
          </CardContent>
        </Card>
      </div>
    </ReportSection>
  );
}
