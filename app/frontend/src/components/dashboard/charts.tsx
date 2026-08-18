"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { formatCurrency, formatCurrencyCompact, getMonthName } from "@/lib/utils";
import { useSettings } from "@/contexts/settings-context";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler
);

// Airbnb theme colors
const COLORS = {
  primary: "rgb(255, 56, 92)",
  primaryAlpha: "rgba(255, 56, 92, 0.7)",
  secondary: "rgb(0, 132, 137)",
  secondaryAlpha: "rgba(0, 132, 137, 0.7)",
  muted: "rgb(221, 221, 221)",
  text: "rgb(34, 34, 34)",
  textMuted: "rgb(113, 113, 113)",
  background: "rgb(255, 255, 255)",
};

interface MonthlyData {
  month: number;
  gross_revenue?: number;
  net_revenue?: number;
  total_expenses?: number;
  profit?: number;
  cashflow?: number;
  reservation_count?: number;
}

interface RevenueChartProps {
  data: MonthlyData[];
  title?: string;
  currency?: string;
}

export function RevenueBarChart({ data, title = "Monthly Revenue", currency }: RevenueChartProps) {
  const { get } = useSettings();
  const cur = currency || (get("default_currency", "EUR") as string) || "EUR";
  const labels = data.map((item) => getMonthName(item.month).slice(0, 3));
  
  const chartData = {
    labels,
    datasets: [
      {
        label: "Revenue",
        data: data.map((item) => Math.round(item.net_revenue || item.gross_revenue || 0)),
        backgroundColor: COLORS.primaryAlpha,
        borderColor: COLORS.primary,
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: "Expenses",
        data: data.map((item) => Math.round(item.total_expenses || 0)),
        backgroundColor: COLORS.secondaryAlpha,
        borderColor: COLORS.secondary,
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { color: COLORS.text, font: { family: "Poppins" }, padding: 20, usePointStyle: true } },
      tooltip: {
        backgroundColor: COLORS.background,
        titleColor: COLORS.text,
        bodyColor: COLORS.text,
        borderColor: COLORS.muted,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw, cur)}` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: COLORS.textMuted, font: { size: 11 } } },
      y: {
        grid: { color: "rgba(221,221,221,0.4)" },
        ticks: { color: COLORS.textMuted, font: { size: 11 }, callback: (v: any) => formatCurrencyCompact(v, cur) },
      },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Revenue vs Expenses by month</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <Bar data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}

export function CashflowLineChart({ data, title = "Cashflow Trend", currency }: RevenueChartProps) {
  const { get } = useSettings();
  const cur = currency || (get("default_currency", "EUR") as string) || "EUR";
  const labels = data.map((item) => getMonthName(item.month).slice(0, 3));

  const chartData = {
    labels,
    datasets: [
      {
        label: "Cashflow",
        data: data.map((item) => Math.round(item.cashflow || (item.net_revenue || 0) - (item.total_expenses || 0))),
        borderColor: COLORS.primary,
        backgroundColor: "rgba(255, 56, 92, 0.1)",
        borderWidth: 2.5,
        pointBackgroundColor: COLORS.primary,
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: COLORS.background,
        titleColor: COLORS.text,
        bodyColor: COLORS.text,
        borderColor: COLORS.muted,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: { label: (ctx: any) => ` ${formatCurrency(ctx.raw, cur)}` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: COLORS.textMuted, font: { size: 11 } } },
      y: {
        grid: { color: "rgba(221,221,221,0.4)" },
        ticks: { color: COLORS.textMuted, font: { size: 11 }, callback: (v: any) => formatCurrencyCompact(v, cur) },
      },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Monthly net cashflow</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <Line data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
