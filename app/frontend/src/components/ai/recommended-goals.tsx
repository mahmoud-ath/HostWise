"use client";

import { ReportSection } from "@/components/reports/report-section";
import { ProgressBar } from "@/components/reports/progress-bar";
import { Target } from "lucide-react";
import type { AdvisorReport } from "@/lib/ai-types";

export function RecommendedGoals({ report }: { report: AdvisorReport }) {
  const goals = Array.isArray(report.recommended_goals) ? report.recommended_goals : [];

  return (
    <ReportSection
      title="Recommended Goals"
      icon={<Target className="h-5 w-5" />}
      description="Concrete targets to aim for next"
    >
      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No goals defined yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => (
            <div key={g.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{g.label}</span>
                <span className="text-muted-foreground">
                  {g.current ?? 0} <span className="text-muted-foreground/60">→</span>{" "}
                  <span className="font-semibold text-foreground">{g.target ?? 0}</span>
                </span>
              </div>
              <ProgressBar value={g.progress} color="bg-primary" />
              <p className="mt-0.5 text-right text-xs text-muted-foreground">
                {Math.round(g.progress ?? 0)}% of target
              </p>
            </div>
          ))}
        </div>
      )}
    </ReportSection>
  );
}
