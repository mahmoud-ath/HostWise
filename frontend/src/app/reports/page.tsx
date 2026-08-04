"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioReport } from "@/hooks/use-api";
import { useSettings } from "@/contexts/settings-context";
import { ReportHeader } from "@/components/reports/report-header";
import { ExecutiveSummary } from "@/components/reports/executive-summary";
import { AIInsights } from "@/components/reports/ai-insights";
import { KpiComparison } from "@/components/reports/kpi-comparison";
import { PropertyPerformance } from "@/components/reports/property-performance";
import { ExpenseAnalysis } from "@/components/reports/expense-analysis";
import { MonthlyTimeline } from "@/components/reports/monthly-timeline";
import { PortfolioHealth } from "@/components/reports/portfolio-health";
import { BusinessRisks } from "@/components/reports/business-risks";
import { Forecast } from "@/components/reports/forecast";
import { Notes } from "@/components/reports/notes";
import { RevenueBarChart, CashflowLineChart } from "@/components/dashboard/charts";
import { ReportPrintView } from "@/components/reports/report-print-view";
import type { PortfolioReport } from "@/lib/report-types";
import type { ReportPeriod } from "@/lib/report-period";

export default function ReportsPage() {
  const { get, ready } = useSettings();
  const [currency, setCurrency] = useState(
    (get("default_currency", "EUR") as string) || "EUR"
  );
  const currencyInitialized = useRef(false);
  useEffect(() => {
    // Apply the configured default currency once settings are loaded,
    // without overriding a manual selection made afterwards.
    if (ready && !currencyInitialized.current) {
      currencyInitialized.current = true;
      setCurrency((get("default_currency", "EUR") as string) || "EUR");
    }
  }, [ready, get]);
  const [period, setPeriod] = useState<ReportPeriod>(() => ({
    year: new Date().getFullYear(),
  }));
  const { data: report, isLoading, isError, refetch } = usePortfolioReport(period, currency);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="print:hidden">
          <ReportHeader
            report={report}
            period={period}
            onPeriodChange={setPeriod}
            currency={currency}
            onCurrencyChange={setCurrency}
            loading={isLoading}
          />
        </div>

        {isLoading && <ReportsSkeleton />}

        {!isLoading && isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="font-medium">Could not load the report.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The backend may be starting up or there is no data for the selected period.
            </p>
            <button
              className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && report && (
          <>
            <div className="space-y-6 print:hidden">
              <ReportsContent report={report} />
            </div>
            <div className="hidden print:block">
              <ReportPrintView report={report} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ReportsContent({ report }: { report: PortfolioReport }) {
  return (
    <div className="space-y-6">
      <ExecutiveSummary report={report} />
      <AIInsights report={report} />
      <KpiComparison report={report} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueBarChart data={report.monthly_breakdown || []} title="Monthly Revenue" />
        <CashflowLineChart data={report.monthly_breakdown || []} title="Cashflow Trend" />
      </div>

      <PropertyPerformance report={report} />
      <ExpenseAnalysis report={report} />
      <MonthlyTimeline report={report} />
      <PortfolioHealth report={report} />
      <BusinessRisks report={report} />
      <Forecast report={report} />
      <Notes report={report} />
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-32" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
      <Skeleton className="h-60" />
      <Skeleton className="h-60" />
    </div>
  );
}

