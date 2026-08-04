"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { AdvisorReport } from "@/lib/ai-types";

export function AIHeader({
  report,
  year,
  onYearChange,
  loading,
}: {
  report?: AdvisorReport;
  year: number;
  onYearChange: (year: number) => void;
  loading: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
  if (!years.includes(year)) years.unshift(year);
  years.sort((a, b) => b - a);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <Sparkles className="h-7 w-7 text-primary" />
              AI Advisor
            </h1>
            <p className="mt-1 text-muted-foreground">
              Your financial co-pilot — insights, risks, and what-if scenarios.
            </p>
            {report && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Generated {formatDate(report.generated_at)}</span>
                {report.provider && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {report.provider === "hostwise"
                      ? "HostWise rules engine"
                      : `Powered by ${report.provider}`}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Period</label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={year}
              onChange={(e) => onYearChange(parseInt(e.target.value))}
              aria-label="Advisor year"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
