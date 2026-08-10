"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioAnalytics } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/utils";
import { useSettings } from "@/contexts/settings-context";
import { ReportPeriod, isCustomPeriod, periodLabel, previousPeriod, normalizeRange } from "@/lib/report-period";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
import {
  Trophy,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Building2,
  Wallet,
  TrendingUp,
  Home,
  Target,
} from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AnalyticsPage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("pages.analytics.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("pages.analytics.subtitle")}</p>
        </div>
        <AnalyticsContent />
      </div>
    </AppShell>
  );
}

function YoY({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined || previous === null || previous === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        up ? "text-success" : "text-destructive"
      }`}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function KpiCard({ label, value, yoy }: { label: string; value: string; yoy?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        <div className="mt-1">{yoy}</div>
      </CardContent>
    </Card>
  );
}

function AnalyticsContent() {
  const currentYear = new Date().getFullYear();
  const [period, setPeriod] = useState<ReportPeriod>(() => ({ year: currentYear }));
  const [compare, setCompare] = useState(false);
  const { get } = useSettings();
  const currency = get("default_currency", "EUR") as string;

  const { data, isLoading } = usePortfolioAnalytics(period);
  const prevPeriod = compare ? previousPeriod(period) : undefined;
  const { data: prev } = usePortfolioAnalytics(prevPeriod);

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
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

  if (isLoading)
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-60" />
      </div>
    );

  if (!data)
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Add properties and revenue data to see analytics.
      </p>
    );

  const monthly = (data.seasonality || []) as any[];
  const prevMonthly = (prev?.seasonality || []) as any[];
  const prevByProp = new Map<string, any>(
    (prev?.property_ranking || []).map((p: any) => [p.property_id, p])
  );
  const hasPrev = !!prev;

  const healthColor = (score: number) => {
    if (score >= 75) return "text-emerald-500";
    if (score >= 50) return "text-amber-500";
    if (score >= 25) return "text-orange-500";
    return "text-red-500";
  };
  const healthLabel = (score: number | null | undefined) => {
    if (score == null) return "—";
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Poor";
  };

  const ranking = [...(data.property_ranking || [])].sort(
    (a: any, b: any) => (b.net_revenue ?? 0) - (a.net_revenue ?? 0)
  );

  const expCats = (data.expense_categories || []) as any[];
  const prevExpCats = new Map<string, any>(
    ((prev?.expense_categories || []) as any[]).map((c: any) => [c.category_name, c])
  );

  const dist = new Map<string, number>();
  ((data.health_distribution || []) as any[]).forEach((d: any) => dist.set(d.status, d.count));
  const prevDist = new Map<string, number>();
  ((prev?.health_distribution || []) as any[]).forEach((d: any) =>
    prevDist.set(d.status, d.count)
  );
  const HEALTH_STATUSES = [
    { key: "excellent", label: "Excellent", color: "bg-emerald-500" },
    { key: "good", label: "Good", color: "bg-blue-500" },
    { key: "fair", label: "Average", color: "bg-amber-500" },
    { key: "poor", label: "Poor", color: "bg-red-500" },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
          value={isCustom ? "custom" : String(activeYear)}
          onChange={(e) => handlePeriodChange(e.target.value)}
          aria-label="Analytics period"
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
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
              value={customStart}
              onChange={(e) => handleCustomStart(e.target.value)}
              aria-label="Start date"
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="date"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
              value={customEnd}
              onChange={(e) => handleCustomEnd(e.target.value)}
              aria-label="End date"
            />
          </div>
        )}
        <Button variant={compare ? "default" : "outline"} size="sm" onClick={() => setCompare((v) => !v)}>
          <TrendingUp className="mr-1.5 h-4 w-4" />
          {period.year ? `Compare with ${period.year - 1}` : "Compare with previous period"}
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          label="Net Revenue"
          value={formatCurrency(data.net_revenue, currency)}
          yoy={compare && <YoY current={data.net_revenue} previous={prev?.net_revenue} />}
        />
        <KpiCard
          label="Profit"
          value={formatCurrency(data.profit, currency)}
          yoy={compare && <YoY current={data.profit} previous={prev?.profit} />}
        />
        <KpiCard
          label="Profit Margin"
          value={`${data.profit_margin}%`}
          yoy={compare && prev && <YoY current={data.profit_margin} previous={prev.profit_margin} />}
        />
        <KpiCard
          label="Total Expenses"
          value={formatCurrency(data.total_expenses, currency)}
          yoy={compare && <YoY current={data.total_expenses} previous={prev?.total_expenses} />}
        />
      </div>

      {/* Revenue trend + monthly */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Bar
                data={{
                  labels: monthly.map((m: any) => MONTHS[(m.month || 1) - 1]),
                  datasets: [
                    {
                      label: compare && hasPrev ? `Revenue (${periodLabel(period)})` : "Revenue",
                      data: monthly.map((m: any) => Math.round(m.net_revenue || m.gross_revenue || 0)),
                      backgroundColor: "rgba(255, 56, 92, 0.7)",
                      borderColor: "rgb(255, 56, 92)",
                      borderWidth: 1,
                      borderRadius: 6,
                    },
                    ...(compare && hasPrev
                      ? [
                          {
                            label: `Prev (${periodLabel(previousPeriod(period))})`,
                            data: prevMonthly.map((m: any) =>
                              Math.round(m.net_revenue || m.gross_revenue || 0)
                            ),
                            backgroundColor: "rgba(148, 163, 184, 0.35)",
                            borderColor: "rgb(148, 163, 184)",
                            borderWidth: 1,
                            borderRadius: 6,
                          },
                        ]
                      : []),
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: compare && hasPrev },
                    tooltip: {
                      callbacks: {
                        label: (ctx: any) => ` ${formatCurrency(ctx.raw as number, currency)}`,
                      },
                    },
                  },
                  scales: {
                    x: { grid: { display: false } },
                    y: {
                      grid: { color: "rgba(221,221,221,0.4)" },
                      ticks: {
                        callback: (v: any) =>
                          Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : String(Number(v)),
                      },
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-primary" /> Expense Trend — {periodLabel(period)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Bar
                data={{
                  labels: monthly.map((m: any) => MONTHS[(m.month || 1) - 1]),
                  datasets: [
                    {
                      label: compare && hasPrev ? `Expenses (${periodLabel(period)})` : "Expenses",
                      data: monthly.map((m: any) => Math.round(m.total_expenses || 0)),
                      backgroundColor: "rgba(0, 132, 137, 0.7)",
                      borderColor: "rgb(0, 132, 137)",
                      borderWidth: 1,
                      borderRadius: 6,
                    },
                    ...(compare && hasPrev
                      ? [
                          {
                            label: `Prev (${periodLabel(previousPeriod(period))})`,
                            data: prevMonthly.map((m: any) => Math.round(m.total_expenses || 0)),
                            backgroundColor: "rgba(148, 163, 184, 0.35)",
                            borderColor: "rgb(148, 163, 184)",
                            borderWidth: 1,
                            borderRadius: 6,
                          },
                        ]
                      : []),
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: compare && hasPrev },
                    tooltip: {
                      callbacks: {
                        label: (ctx: any) => ` ${formatCurrency(ctx.raw as number, currency)}`,
                      },
                    },
                  },
                  scales: {
                    x: { grid: { display: false } },
                    y: {
                      grid: { color: "rgba(221,221,221,0.4)" },
                      ticks: {
                        callback: (v: any) =>
                          Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : String(Number(v)),
                      },
                    },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense breakdown */}
      {expCats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-primary" /> Expense Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expCats.map((c: any) => {
                const prev = prevExpCats.get(c.category_name);
                const delta =
                  prev && prev.total > 0 ? ((c.total - prev.total) / prev.total) * 100 : undefined;
                return (
                  <div key={c.category_name} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{c.category_name}</span>
                    <span className="flex shrink-0 items-center gap-4">
                      {compare && hasPrev && (
                        <span className="w-16 text-right text-xs">
                          {delta === undefined ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={delta > 0 ? "text-destructive" : "text-success"}>
                              {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
                            </span>
                          )}
                        </span>
                      )}
                      <span className="font-medium">{formatCurrency(c.total, currency)}</span>
                      <span className="w-12 text-right text-xs text-muted-foreground">{c.percentage}%</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Property comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" /> Property Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">Property</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">Revenue</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">Margin</th>
                  {compare && <th className="p-3 text-right text-xs font-medium text-muted-foreground">YoY</th>}
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">Reservations</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">Score</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((p: any, i: number) => {
                  const prevRank = prevByProp.get(p.property_id);
                  return (
                    <tr key={p.property_id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-xs text-muted-foreground">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                          </span>
                          <span className="font-medium">{p.property_name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-medium">{formatCurrency(p.net_revenue, currency)}</td>
                      <td className="p-3 text-right">{p.profit_margin?.toFixed(1)}%</td>
                      {compare && (
                        <td className="p-3 text-right">
                          <YoY current={p.net_revenue} previous={prevRank?.net_revenue} />
                        </td>
                      )}
                      <td className="p-3 text-right text-muted-foreground">{p.reservation_count}</td>
                      <td className="p-3 text-right">
                        <span className={`inline-flex items-center gap-1.5 font-semibold ${healthColor(p.health_score)}`}>
                          {p.health_score?.toFixed(0) || "—"}
                          <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {healthLabel(p.health_score)}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Best / Needs attention */}
      <div className="grid gap-6 md:grid-cols-2">
        {ranking.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-amber-500" /> Best Performer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const b = ranking[0];
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-lg dark:bg-amber-900/30">🥇</div>
                      <div>
                        <p className="font-medium">{b.property_name}</p>
                        <p className="text-xs text-muted-foreground">Score: {b.health_score?.toFixed(0) || "—"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded bg-muted/50 p-2 text-center">
                        <p className="text-lg font-bold text-success">{formatCurrency(b.net_revenue, currency)}</p>
                        <p className="text-[10px] text-muted-foreground">Revenue</p>
                      </div>
                      <div className="rounded bg-muted/50 p-2 text-center">
                        <p className="text-lg font-bold">{b.profit_margin?.toFixed(0) || "—"}%</p>
                        <p className="text-[10px] text-muted-foreground">Profit Margin</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {ranking.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const w = ranking[ranking.length - 1];
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-lg dark:bg-red-900/30">⚠️</div>
                      <div>
                        <p className="font-medium">{w.property_name}</p>
                        <p className="text-xs text-muted-foreground">Score: {w.health_score?.toFixed(0) || "—"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded bg-muted/50 p-2 text-center">
                        <p className="text-lg font-bold text-destructive">{formatCurrency(w.net_revenue, currency)}</p>
                        <p className="text-[10px] text-muted-foreground">Revenue</p>
                      </div>
                      <div className="rounded bg-muted/50 p-2 text-center">
                        <p className="text-lg font-bold text-destructive">{w.profit_margin?.toFixed(1) || "—"}%</p>
                        <p className="text-[10px] text-muted-foreground">Profit Margin</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Portfolio insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="h-4 w-4 text-primary" /> Portfolio Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Gross Revenue", value: formatCurrency(data.gross_revenue, currency) },
              { label: "Avg Stay (nights)", value: data.avg_stay || "—" },
              { label: "Booking Window (days)", value: data.avg_booking_window || "—" },
              { label: "Total Reservations", value: data.total_reservations || 0 },
            ].map((item, i) => (
              <div key={i} className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold">{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Health distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" /> Property Health Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {HEALTH_STATUSES.map((item) => {
              const count = dist.get(item.key) || 0;
              const prevCount = prevDist.get(item.key);
              const pct = data.property_count > 0 ? (count / data.property_count) * 100 : 0;
              return (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="w-16 text-xs text-muted-foreground">{item.label}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                    <div className={`h-full rounded ${item.color}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  {compare && hasPrev && (
                    <span className="w-16 text-right text-[11px] text-muted-foreground">
                      {prevCount !== undefined && prevCount !== null ? `prev ${prevCount}` : "prev —"}
                    </span>
                  )}
                  <span className="w-6 text-right text-xs font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* YoY comparison */}
      {data.revenue_growth_yoy !== null && data.revenue_growth_yoy !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> {period.year ? "Year-over-Year" : "Period-over-Period"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{periodLabel(previousPeriod(period))}</p>
                <p className="text-lg font-bold">
                  {formatCurrency(data.net_revenue * (1 - data.revenue_growth_yoy / 100), currency)}
                </p>
              </div>
              <div className="text-2xl text-muted-foreground">→</div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{periodLabel(period)}</p>
                <p className="text-lg font-bold">{formatCurrency(data.net_revenue, currency)}</p>
              </div>
              <span
                className={`text-sm font-semibold ${
                  data.revenue_growth_yoy >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {data.revenue_growth_yoy >= 0 ? "↑" : "↓"} {Math.abs(data.revenue_growth_yoy).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
