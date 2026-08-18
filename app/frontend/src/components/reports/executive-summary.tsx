"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReportSection } from "./report-section";
import { formatCurrency } from "@/lib/utils";
import { CalendarRange, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import type { PortfolioReport, PropertyCard } from "@/lib/report-types";

function PropertyChip({
  property,
  icon,
  label,
  currency,
}: {
  property: PropertyCard;
  icon: React.ReactNode;
  label: string;
  currency: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-1.5 font-semibold">
        {icon}
        <span className="truncate">{property.property_name}</span>
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span className="text-muted-foreground">Revenue</span>
        <span className="font-medium">{formatCurrency(property.net_revenue, currency)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Margin</span>
        <span className="font-medium">{property.profit_margin}%</span>
      </div>
    </div>
  );
}

export function ExecutiveSummary({ report }: { report: PortfolioReport }) {
  const es = report.executive_summary;
  const currency = report.currency;
  const status = es.portfolio_health_status;
  const hasHealth = es.portfolio_health_score !== null;
  const healthVariant =
    !hasHealth
      ? "secondary"
      : status === "excellent"
      ? "success"
      : status === "good"
      ? "default"
      : "destructive";

  const stats = [
    { label: "Gross Revenue", value: formatCurrency(es.gross_revenue, currency) },
    { label: "Net Profit", value: formatCurrency(es.net_profit, currency) },
    { label: "Profit Margin", value: `${es.profit_margin}%` },
  ];

  return (
    <ReportSection
      title="Executive Summary"
      icon={<CalendarRange className="h-5 w-5" />}
      description={`${report.organization} · ${new Date(report.period_start).toLocaleDateString("en-US", { month: "short" })} – ${new Date(report.period_end).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
      action={
        <Badge variant={healthVariant as "success" | "default" | "secondary" | "destructive"} className="capitalize">
          {hasHealth ? `${status} · ${es.portfolio_health_score}/100` : "No data yet"}
        </Badge>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="border-0 bg-muted/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {es.best_property && (
          <PropertyChip
            property={es.best_property}
            icon={<Trophy className="h-4 w-4 text-amber-500" />}
            label="Best Property"
            currency={currency}
          />
        )}
        {es.worst_property && (
          <PropertyChip
            property={es.worst_property}
            icon={<TrendingDown className="h-4 w-4 text-destructive" />}
            label="Needs Attention"
            currency={currency}
          />
        )}
        {!es.best_property && (
          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <TrendingUp className="mb-2 h-4 w-4" />
            No property data for this period yet.
          </div>
        )}
      </div>
    </ReportSection>
  );
}
