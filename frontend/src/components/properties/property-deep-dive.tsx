"use client";

import Link from "next/link";
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
import { ArrowLeft, Gauge, TrendingUp } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useProperty, usePropertyAnalytics, usePropertyHealth } from "@/hooks/use-api";
import { useSettings } from "@/contexts/settings-context";
import { formatCurrency, formatMonth } from "@/lib/utils";

export function PropertyDeepDive({ id }: { id: string }) {
  const year = new Date().getFullYear();

  const { data: property } = useProperty(id);
  const { data: analytics } = usePropertyAnalytics(id, year);
  const { data: health } = usePropertyHealth(id);
  const { get } = useSettings();
  const currency = get("default_currency", "EUR") as string;

  const monthly = (analytics?.monthly_breakdown as any[]) || [];
  const totalReservations = monthly.reduce((s, m) => s + (m.reservation_count || 0), 0);
  const totalNights = monthly.reduce((s, m) => s + (m.nights || 0), 0);
  const avgStay = totalReservations > 0 ? +(totalNights / totalReservations).toFixed(1) : 0;

  const stats = [
    { label: "Net Revenue", value: formatCurrency((analytics?.net_revenue as number) || 0, currency) },
    { label: "Profit", value: formatCurrency((analytics?.profit as number) || 0, currency) },
    { label: "Expenses", value: formatCurrency((analytics?.total_expenses as number) || 0, currency) },
    { label: "Profit Margin", value: `${(analytics?.profit_margin as number) || 0}%` },
    { label: "Reservations", value: String(totalReservations) },
    { label: "Avg Stay", value: `${avgStay} nights` },
    { label: "Cancellation", value: `${(analytics?.cancellation_rate as number) || 0}%` },
    { label: "Expense Ratio", value: `${(analytics?.expense_ratio as number) || 0}%` },
    { label: "Health", value: health && health.health_score !== null ? `${health.health_score}/100` : "—" },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/properties"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to properties
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{property?.name || "Property"}</h1>
            {health && (
              <Badge variant={health.status === "no_data" ? "outline" : health.status === "healthy" ? "success" : health.status === "average" ? "secondary" : "destructive"}>
                <Gauge className="mr-1 h-3 w-3" /> {health.health_score === null ? "No data" : `${health.health_score}/100`}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {property?.type || ""}
            {[property?.city, property?.country].some(Boolean) ? ` · ${[property?.city, property?.country].filter(Boolean).join(", ")}` : ""}
            {" · "}
            {year}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-lg font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {monthly.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" /> Monthly Revenue & Expenses
              </CardTitle>
              <CardDescription>
                Net revenue vs expenses for {property?.name || "this property"} in {year}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <Bar
                  data={{
                    labels: monthly.map((m) => formatMonth(m.month).slice(0, 3)),
                    datasets: [
                      {
                        label: "Net Revenue",
                        data: monthly.map((m) => m.net_revenue || 0),
                        backgroundColor: "rgba(255, 56, 92, 0.7)",
                        borderColor: "rgb(255, 56, 92)",
                        borderWidth: 1,
                        borderRadius: 6,
                      },
                      {
                        label: "Expenses",
                        data: monthly.map((m) => m.total_expenses || 0),
                        backgroundColor: "rgba(0, 132, 137, 0.7)",
                        borderColor: "rgb(0, 132, 137)",
                        borderWidth: 1,
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
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
              <div className="mt-2 flex items-center justify-center gap-5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "rgba(255, 56, 92, 0.7)" }} />
                  Net Revenue
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "rgba(0, 132, 137, 0.7)" }} />
                  Expenses
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No data for {property?.name || "this property"} in {year} yet — import reservations or add
              revenue to see analytics here.
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
