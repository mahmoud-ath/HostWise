"use client";

import { ReportSection } from "@/components/reports/report-section";
import { Trophy, TrendingUp, PiggyBank, Rocket, Sparkles, PartyPopper } from "lucide-react";
import type { AdvisorReport, Achievement } from "@/lib/ai-types";

const ICONS: Record<string, React.ReactNode> = {
  trophy: <Trophy className="h-5 w-5 text-amber-500" />,
  "trending-up": <TrendingUp className="h-5 w-5 text-success" />,
  "piggy-bank": <PiggyBank className="h-5 w-5 text-blue-500" />,
  rocket: <Rocket className="h-5 w-5 text-primary" />,
  sparkles: <Sparkles className="h-5 w-5 text-amber-400" />,
};

function AchievementCard({ a }: { a: Achievement }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card">
        {ICONS[a.icon || ""] || <PartyPopper className="h-5 w-5 text-primary" />}
      </div>
      <div>
        <p className="text-sm font-semibold">{a.title || ""}</p>
        <p className="text-xs text-muted-foreground">{a.detail || ""}</p>
      </div>
    </div>
  );
}

export function Achievements({ report }: { report: AdvisorReport }) {
  return (
    <ReportSection
      title="Wins"
      icon={<PartyPopper className="h-5 w-5 text-primary" />}
      description="Celebrate what's going well"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {(Array.isArray(report.achievements) ? report.achievements : []).map((a) => (
          <AchievementCard key={a.title} a={a} />
        ))}
      </div>
    </ReportSection>
  );
}
