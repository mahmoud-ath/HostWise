"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/app-shell";
import { LoginPage } from "@/components/auth/login-page";
import {
  GrossRevenueCard,
  NetRevenueCard,
  ProfitMarginCard,
  CashflowCard,
  PropertyCountCard,
} from "@/components/dashboard/kpi-cards";
import { RevenueBarChart, CashflowLineChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { Brain, AlertTriangle, TrendingUp, CheckCircle, Info } from "lucide-react";

interface FinancialSummary {
  gross_revenue: number;
  net_revenue: number;
  total_expenses: number;
  cashflow: number;
  profit: number;
  profit_margin: number;
  property_count: number;
  avg_revenue_per_property: number;
}

interface AIRecommendation {
  type: "critical" | "warning" | "positive" | "info";
  title: string;
  cause: string;
  business_impact: string;
  suggested_action: string;
  confidence_score: number;
}

export default function Home() {
  const { isAuthenticated, organization } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppShell>
      <DashboardContent organizationId={organization?.id} />
    </AppShell>
  );
}

function DashboardContent({ organizationId }: { organizationId?: string }) {
  const currentYear = new Date().getFullYear();

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<FinancialSummary>({
    queryKey: ["financial-summary", organizationId],
    queryFn: () => api.get(`/finance/${organizationId}/summary`),
    enabled: !!organizationId,
  });

  const { data: annualReport, isLoading: reportLoading, error: reportError } = useQuery<any>({
    queryKey: ["annual-report", organizationId, currentYear],
    queryFn: () =>
      api.get(`/finance/${organizationId}/report/annual?year=${currentYear}`),
    enabled: !!organizationId,
  });

  const { data: aiAnalysis, isLoading: aiLoading, error: aiError } = useQuery<any>({
    queryKey: ["ai-analysis", organizationId],
    queryFn: () => api.get(`/ai/${organizationId}/analyze`),
    enabled: !!organizationId,
  });

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold mb-2">Welcome to HostWise</h2>
        <p className="text-muted-foreground">
          Create an organization to get started with your financial intelligence platform.
        </p>
      </div>
    );
  }

  // Show any API errors
  if (summaryError || reportError || aiError) {
    return (
      <div className="space-y-4 py-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/5">
          <p className="text-sm font-medium text-destructive mb-2">API Connection Error</p>
          {summaryError && <p className="text-xs text-muted-foreground">Summary: {(summaryError as Error).message}</p>}
          {reportError && <p className="text-xs text-muted-foreground">Report: {(reportError as Error).message}</p>}
          {aiError && <p className="text-xs text-muted-foreground">AI: {(aiError as Error).message}</p>}
          <p className="text-xs text-muted-foreground mt-2">
            Org ID: {organizationId} | Backend: {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Your vacation rental intelligence at a glance.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {summaryLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : summary ? (
          <>
            <GrossRevenueCard value={summary.gross_revenue} />
            <NetRevenueCard value={summary.net_revenue} />
            <ProfitMarginCard value={summary.profit_margin} />
            <CashflowCard value={summary.cashflow} />
            <PropertyCountCard value={summary.property_count} />
          </>
        ) : null}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {reportLoading ? (
          <>
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </>
        ) : annualReport ? (
          <>
            <RevenueBarChart
              data={annualReport.monthly_breakdown || []}
              title="Revenue vs Expenses"
            />
            <CashflowLineChart
              data={annualReport.monthly_breakdown || []}
              title="Cashflow Trend"
            />
          </>
        ) : null}
      </div>

      {/* AI Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Financial Advisor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aiLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : aiAnalysis ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {aiAnalysis.executive_summary}
              </p>
              <div className="space-y-3 mt-4">
                {(aiAnalysis.recommendations || []).slice(0, 5).map((rec: AIRecommendation, i: number) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  >
                    {rec.type === "critical" && (
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    )}
                    {rec.type === "warning" && (
                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                    )}
                    {rec.type === "positive" && (
                      <CheckCircle className="h-5 w-5 text-success mt-0.5 shrink-0" />
                    )}
                    {rec.type === "info" && (
                      <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{rec.title}</p>
                        <Badge
                          variant={
                            rec.type === "critical"
                              ? "destructive"
                              : rec.type === "warning"
                              ? "secondary"
                              : rec.type === "positive"
                              ? "success"
                              : "outline"
                          }
                        >
                          {Math.round(rec.confidence_score * 100)}% confidence
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {rec.cause}
                      </p>
                      <p className="text-xs mt-1">
                        <span className="font-medium">Action:</span> {rec.suggested_action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add revenue and expense data to receive AI-powered insights.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Expense Categories */}
      {annualReport?.expense_by_category && (
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {annualReport.expense_by_category.slice(0, 8).map((cat: { category_name: string; total: number; percentage: number }, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: `hsl(${(i * 40) % 360}, 70%, 50%)`,
                      }}
                    />
                    <span className="text-sm">{cat.category_name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      {formatCurrency(cat.total)}
                    </span>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
