"use client";

import { AppShell } from "@/components/layout/app-shell";
import {
  GrossRevenueCard,
  NetRevenueCard,
  ProfitMarginCard,
  TotalExpensesCard,
  CashflowCard,
  PropertyCountCard,
} from "@/components/dashboard/kpi-cards";
import { RevenueBarChart, CashflowLineChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useSettings } from "@/contexts/settings-context";
import { useI18n } from "@/lib/i18n";
import {
  useFinancialSummary,
  useAnnualReport,
  useAIAdvisor,
  usePortfolioAnalytics,
} from "@/hooks/use-api";
import { Brain, AlertTriangle, TrendingUp, CheckCircle, Info, Building2, Upload, DollarSign, FileText, Sparkles, Download, Trophy, CalendarRange, Sparkle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ReportPeriod, isCustomPeriod, periodLabel, normalizeRange } from "@/lib/report-period";

export default function Home() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const { settings, get } = useSettings();
  const { t, tWith } = useI18n();
  const currency: string = get("default_currency", "EUR");
  const showAiSummary: boolean = get("dashboard_show_ai_summary", true) !== false;
  const showForecast: boolean = get("dashboard_show_forecast", true) !== false;

  const defaultYearSetting = String(get("dashboard_default_year", "current"));
  const currentYear = new Date().getFullYear();
  const [period, setPeriod] = useState<ReportPeriod>(() => ({
    year:
      defaultYearSetting === "current" ? currentYear : Number(defaultYearSetting) || currentYear,
  }));
  const isCustom = isCustomPeriod(period);
  const activeYear = period.year ?? currentYear;
  const [customStart, setCustomStart] = useState(period.start || "");
  const [customEnd, setCustomEnd] = useState(period.end || "");

  const handlePeriodChange = (value: string) => {
    if (value === "custom") {
      const start = customStart || `${activeYear}-01-01`;
      const end = customEnd || `${activeYear}-12-31`;
      setCustomStart(start);
      setCustomEnd(end);
      setPeriod({ start, end });
    } else {
      setPeriod({ year: parseInt(value, 10) });
    }
  };

  const handleCustomStart = (value: string) => {
    setCustomStart(value);
    if (value && customEnd) {
      const { start, end } = normalizeRange(value, customEnd);
      setCustomStart(start);
      setCustomEnd(end);
      setPeriod({ start, end });
    }
  };

  const handleCustomEnd = (value: string) => {
    setCustomEnd(value);
    if (customStart && value) {
      const { start, end } = normalizeRange(customStart, value);
      setCustomStart(start);
      setCustomEnd(end);
      setPeriod({ start, end });
    }
  };

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useFinancialSummary(
    period.year ? `${period.year}-01-01` : period.start,
    period.year ? `${period.year}-12-31` : period.end
  );
  const { data: annualReport, isLoading: reportLoading, error: reportError } = useAnnualReport(period);
  const { data: aiAnalysis, isLoading: aiLoading, error: aiError } = useAIAdvisor(period);
  const { data: portfolio, isLoading: portfolioLoading, error: portfolioError } = usePortfolioAnalytics(period);

  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];

  // Show any API errors
  if (summaryError || reportError || (aiError && showAiSummary) || portfolioError) {
    return (
      <div className="space-y-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <Button variant="outline" size="sm" onClick={() => {
            setPeriod({ year: currentYear });
            setCustomStart("");
            setCustomEnd("");
          }}>
            Reset to {currentYear}
          </Button>
        </div>
        <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/5">
          <p className="text-sm font-medium text-destructive mb-2">API Connection Error</p>
          {summaryError && <p className="text-xs text-muted-foreground">Summary: {(summaryError as Error).message}</p>}
          {reportError && <p className="text-xs text-muted-foreground">Report: {(reportError as Error).message}</p>}
          {portfolioError && <p className="text-xs text-muted-foreground">Portfolio: {(portfolioError as Error).message}</p>}
          {aiError && showAiSummary && <p className="text-xs text-muted-foreground">AI: {(aiError as Error).message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("pages.dashboard.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {settings.business_name ? `${settings.business_name} · ` : ""}{t("pages.dashboard.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <select
            value={isCustom ? "custom" : String(activeYear)}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
            aria-label="Select period"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y === currentYear ? `This year (${y})` : y}
              </option>
            ))}
            <option value="custom">Custom range…</option>
          </select>
          {isCustom && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={customStart}
                onChange={(e) => handleCustomStart(e.target.value)}
                aria-label="Start date"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="date"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={customEnd}
                onChange={(e) => handleCustomEnd(e.target.value)}
                aria-label="End date"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        {summaryLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : summary ? (
          <>
            <GrossRevenueCard value={summary.gross_revenue} currency={currency} />
            <NetRevenueCard value={summary.net_revenue} currency={currency} />
            <ProfitMarginCard value={summary.profit_margin} />
            <TotalExpensesCard value={summary.total_expenses} currency={currency} />
            <CashflowCard value={summary.cashflow} currency={currency} />
            <PropertyCountCard value={summary.property_count} />
          </>
        ) : null}
      </div>

      {/* Charts */}
      {showForecast && (
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
                title={`Revenue vs Expenses — ${periodLabel(period)}`}
                currency={currency}
              />
              <CashflowLineChart
                data={annualReport.monthly_breakdown || []}
                title={`Cashflow Trend — ${periodLabel(period)}`}
                currency={currency}
              />
            </>
          ) : null}
        </div>
      )}

      {/* AI Recommendations */}
      {showAiSummary && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              {t("dash.aiAdvisor")}
            </CardTitle>
            <Badge variant="outline" className="flex items-center gap-1">
              <Sparkle className="h-3 w-3" />
              {!aiAnalysis?.provider || aiAnalysis.provider === "hostwise"
                ? t("dash.rulesEngine")
                : `LLM · ${aiAnalysis.provider}`}
            </Badge>
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
                  {[
                    ...(aiAnalysis.priority_actions?.critical || []),
                    ...(aiAnalysis.priority_actions?.medium || []),
                    ...(aiAnalysis.priority_actions?.low || []),
                  ]
                    .slice(0, 5)
                    .map((rec, i) => (
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
                {t("dash.noDataYet")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Expense Categories */}
      {annualReport?.expense_by_category && (
        <Card>
          <CardHeader>
            <CardTitle>{t("dash.expenseBreakdown")}</CardTitle>
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
                      {formatCurrency(cat.total, currency)}
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

      {/* ⚡ Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("dash.quickActions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Link
              href="/properties"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
            >
              <Building2 className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium">{t("dash.addProperty")}</span>
            </Link>
            <Link
              href="/import"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
            >
              <Upload className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium">{t("dash.importCsv")}</span>
            </Link>
            <Link
              href="/finance"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
            >
              <DollarSign className="h-5 w-5 text-destructive" />
              <span className="text-xs font-medium">{t("dash.addExpense")}</span>
            </Link>
            <Link
              href="/finance"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
            >
              <TrendingUp className="h-5 w-5 text-success" />
              <span className="text-xs font-medium">{t("dash.addRevenue")}</span>
            </Link>
            <Link
              href="/reports"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
            >
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium">{t("dash.generateReport")}</span>
            </Link>
            <Link
              href="/ai-advisor"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
            >
              <Brain className="h-5 w-5 text-amber-500" />
              <span className="text-xs font-medium">{t("dash.askAi")}</span>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 📄 Latest Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            {t("dash.latestReports")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reportLoading ? (
            <>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </>
          ) : annualReport ? (
            <>
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {period.year ? `${period.year} Annual Report` : `${periodLabel(period)} Report`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tWith("dash.monthsWithData", { count: annualReport.monthly_breakdown?.length || 0 })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-[10px] text-muted-foreground">{t("dash.gross")}</p>
                      <p className="text-sm font-semibold">{formatCurrency(annualReport.summary.gross_revenue, currency)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">{t("dash.net")}</p>
                      <p className="text-sm font-semibold">{formatCurrency(annualReport.summary.net_revenue, currency)}</p>
                    </div>
                    <Link href="/reports">
                      <span className="text-xs text-primary hover:underline cursor-pointer flex items-center gap-1">
                        <Download className="h-3 w-3" /> {t("common.view")}
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* 🏆 Property Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-amber-500" />
            {t("dash.propertyRanking")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {portfolioLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : portfolio && portfolio.property_ranking.length > 0 ? (
            <div className="space-y-2">
              {portfolio.property_ranking.slice(0, 5).map((p, i: number) => (
                <div
                  key={p.property_id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${
                      i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"
                    }`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{p.property_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(p.net_revenue, currency)} net · {p.reservation_count} bookings · {p.profit_margin?.toFixed(1)}% margin
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-success">
                      {formatCurrency(p.net_revenue, currency)}
                    </p>
                  </div>
                </div>
              ))}
              {portfolio.property_ranking.length > 5 && (
                <Link href="/properties">
                  <p className="text-xs text-center text-muted-foreground pt-2 hover:text-primary cursor-pointer">
                    +{portfolio.property_ranking.length - 5} more properties
                  </p>
                </Link>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("dash.addDataHint")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
