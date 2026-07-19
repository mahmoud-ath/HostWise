"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, DollarSign, Percent, Home, CreditCard } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  description?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function KPICard({
  title,
  value,
  description,
  trend,
  trendValue,
  icon,
  className,
}: KPICardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || trendValue) && (
          <div className="flex items-center mt-1 space-x-2">
            {trend === "up" && (
              <TrendingUp className="h-4 w-4 text-success" />
            )}
            {trend === "down" && (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            {trend === "neutral" && (
              <Minus className="h-4 w-4 text-muted-foreground" />
            )}
            {trendValue && (
              <p
                className={cn("text-xs", {
                  "text-success": trend === "up",
                  "text-destructive": trend === "down",
                  "text-muted-foreground": trend === "neutral",
                })}
              >
                {trendValue}
              </p>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Pre-configured financial KPI cards
export function GrossRevenueCard({ value, trend }: { value: number; trend?: number }) {
  return (
    <KPICard
      title="Gross Revenue"
      value={formatCurrency(value)}
      trendValue={trend !== undefined ? formatPercentage(trend) : undefined}
      trend={trend !== undefined ? (trend >= 0 ? "up" : "down") : undefined}
      icon={<DollarSign className="h-4 w-4" />}
    />
  );
}

export function NetRevenueCard({ value, trend }: { value: number; trend?: number }) {
  return (
    <KPICard
      title="Net Revenue"
      value={formatCurrency(value)}
      trendValue={trend !== undefined ? formatPercentage(trend) : undefined}
      trend={trend !== undefined ? (trend >= 0 ? "up" : "down") : undefined}
      icon={<DollarSign className="h-4 w-4" />}
    />
  );
}

export function ProfitMarginCard({ value }: { value: number }) {
  return (
    <KPICard
      title="Profit Margin"
      value={`${value.toFixed(1)}%`}
      trend={value >= 30 ? "up" : value >= 0 ? "neutral" : "down"}
      icon={<Percent className="h-4 w-4" />}
    />
  );
}

export function CashflowCard({ value }: { value: number }) {
  return (
    <KPICard
      title="Cashflow"
      value={formatCurrency(value)}
      trend={value >= 0 ? "up" : "down"}
      icon={<CreditCard className="h-4 w-4" />}
    />
  );
}

export function PropertyCountCard({ value }: { value: number }) {
  return (
    <KPICard
      title="Properties"
      value={String(value)}
      icon={<Home className="h-4 w-4" />}
    />
  );
}
