"use client";

import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePortfolioAnalytics, useProperties } from "@/hooks/use-api";
import { RevenueBarChart } from "@/components/dashboard/charts";
import { formatCurrency } from "@/lib/utils";
import { BarChart3, TrendingUp, Percent, Calendar } from "lucide-react";

export default function AnalyticsPage() {
  const { isAuthenticated, organization } = useAuth();

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">Deep insights into your portfolio performance.</p>
        </div>
        <AnalyticsContent organizationId={organization?.id} />
      </div>
    </AppShell>
  );
}

function AnalyticsContent({ organizationId }: { organizationId?: string }) {
  const year = new Date().getFullYear();
  const { data, isLoading } = usePortfolioAnalytics(organizationId, year);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-60" /></div>;
  if (!data) return <p className="text-sm text-muted-foreground">Add properties and revenue to see analytics.</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Properties</p><p className="text-2xl font-bold">{data.property_count}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Net Revenue</p><p className="text-2xl font-bold">{formatCurrency(data.net_revenue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Profit Margin</p><p className="text-2xl font-bold">{data.profit_margin}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg/Property</p><p className="text-2xl font-bold">{formatCurrency(data.avg_revenue_per_property)}</p></CardContent></Card>
      </div>

      <RevenueBarChart data={data.seasonality || []} title="Seasonality — Revenue by Month" />

      <Card>
        <CardHeader><CardTitle>Property Ranking</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(data.property_ranking || []).map((p: { property_id: string; property_name: string; net_revenue: number; reservation_count: number }, i: number) => (
              <div key={p.property_id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                  <span className="text-sm font-medium">{p.property_name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm">{p.reservation_count} bookings</span>
                  <span className="text-sm font-semibold">{formatCurrency(p.net_revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
