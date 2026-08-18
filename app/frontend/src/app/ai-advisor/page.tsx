"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAIAdvisor } from "@/hooks/use-api";
import { AIHeader } from "@/components/ai/ai-header";
import { ExecutiveAISummary } from "@/components/ai/executive-ai-summary";
import { BusinessHealthScore } from "@/components/ai/health-score";
import { PriorityActions } from "@/components/ai/priority-actions";
import { Opportunities } from "@/components/ai/opportunities";
import { RiskDetection } from "@/components/ai/risk-detection";
import { PropertyReviews } from "@/components/ai/property-reviews";
import { ForecastNext30 } from "@/components/ai/forecast-next-30";
import { TrendExplanations } from "@/components/ai/trend-explanations";
import { RecommendedGoals } from "@/components/ai/recommended-goals";
import { ScenarioSimulator } from "@/components/ai/scenario-simulator";
import { Achievements } from "@/components/ai/achievements";
import { BarChart3, ListChecks, FlaskConical } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { AdvisorReport } from "@/lib/ai-types";

type Tab = "analytics" | "recommendations" | "simulator";

const TABS: { id: Tab; key: string; icon: React.ReactNode }[] = [
  { id: "analytics", key: "ai.tab.analytics", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "recommendations", key: "ai.tab.recommendations", icon: <ListChecks className="h-4 w-4" /> },
  { id: "simulator", key: "ai.tab.simulator", icon: <FlaskConical className="h-4 w-4" /> },
];

export default function AIAdvisorPage() {
  const { t, tWith } = useI18n();
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<Tab>("analytics");
  const { data: report, isLoading, isError, refetch } = useAIAdvisor(year);

  return (
    <AppShell>
      <div className="space-y-6">
        <AIHeader report={report} year={year} onYearChange={setYear} loading={isLoading} />

        {isLoading && <AISkeleton />}

        {!isLoading && isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="font-medium">{t("ai.loadError")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{tWith("ai.loadErrorHint", { year })}</p>
            <button
              className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => refetch()}
            >
              {t("common.retry")}
            </button>
          </div>
        )}

        {!isLoading && !isError && report && (
          <>
            <div className="flex flex-wrap gap-2">
              {TABS.map((tb) => (
                <Button
                  key={tb.id}
                  variant={tab === tb.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTab(tb.id)}
                >
                  {tb.icon}
                  <span className="ml-1.5">{t(tb.key)}</span>
                </Button>
              ))}
            </div>
            <TabContent tab={tab} report={report} year={year} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function TabContent({ tab, report, year }: { tab: Tab; report: AdvisorReport; year: number }) {
  if (tab === "simulator") return <ScenarioSimulator year={year} />;
  if (tab === "recommendations") return <PriorityActions report={report} />;

  return (
    <div className="space-y-6">
      <ExecutiveAISummary report={report} />
      <BusinessHealthScore report={report} />
      <Opportunities report={report} />
      <RiskDetection report={report} />
      <PropertyReviews report={report} />
      <ForecastNext30 report={report} />
      <TrendExplanations report={report} />
      <RecommendedGoals report={report} />
      <Achievements report={report} />
    </div>
  );
}

function AISkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-32" />
      <Skeleton className="h-40" />
      <Skeleton className="h-60" />
      <Skeleton className="h-60" />
      <Skeleton className="h-60" />
    </div>
  );
}
