"use client";

import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAnnualReport, useMonthlyReport } from "@/hooks/use-api";
import { RevenueBarChart, CashflowLineChart } from "@/components/dashboard/charts";
import { formatCurrency, getMonthName } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download } from "lucide-react";
import { useState } from "react";

export default function ReportsPage() {
  const { isAuthenticated, organization } = useAuth();

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Generate financial reports and executive summaries.</p>
        </div>
        <ReportsContent organizationId={organization?.id} />
      </div>
    </AppShell>
  );
}

function ReportsContent({ organizationId }: { organizationId?: string }) {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const [view, setView] = useState<"annual" | "monthly">("annual");
  const [selMonth, setSelMonth] = useState(month);

  const { data: annual, isLoading: annualLoading } = useAnnualReport(organizationId, year);
  const { data: monthly, isLoading: monthlyLoading } = useMonthlyReport(organizationId, year, selMonth);
  const data = view === "annual" ? annual : monthly;
  const loading = view === "annual" ? annualLoading : monthlyLoading;

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button variant={view === "annual" ? "default" : "outline"} size="sm" onClick={() => setView("annual")}>Annual {year}</Button>
        <Button variant={view === "monthly" ? "default" : "outline"} size="sm" onClick={() => setView("monthly")}>Monthly</Button>
        {view === "monthly" && (
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={selMonth} onChange={(e) => setSelMonth(parseInt(e.target.value))}>
            {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{getMonthName(m)}</option>)}
          </select>
        )}
      </div>

      {loading ? <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-60" /></div>
      : !data ? <p className="text-sm text-muted-foreground">No data available.</p>
      : <>
          <div className="grid gap-4 md:grid-cols-5">
            {["gross_revenue","net_revenue","total_expenses","profit","profit_margin"].map(k=>(
              <Card key={k}><CardContent className="p-4"><p className="text-xs text-muted-foreground capitalize">{k.replace(/_/g," ")}</p><p className="text-lg font-bold">{k==="profit_margin"?`${(data.summary as any)[k]}%`:formatCurrency((data.summary as any)[k])}</p></CardContent></Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <RevenueBarChart data={(data as any).monthly_breakdown || (data as any).monthly_trend || []} />
            <CashflowLineChart data={(data as any).monthly_breakdown || (data as any).monthly_trend || []} />
          </div>

          {data.revenue_by_property && (
            <Card>
              <CardHeader><CardTitle>Revenue by Property</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(data.revenue_by_property || []).map((p: { property_id: string; property_name: string; net_revenue: number; profit: number; profit_margin: number }) => (
                    <div key={p.property_id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm font-medium">{p.property_name}</span>
                      <div className="flex gap-4 text-sm">
                        <span>{formatCurrency(p.net_revenue)}</span>
                        <span className="text-success">{p.profit_margin}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.yoy_growth !== undefined && <p className="text-sm text-muted-foreground">Year-over-year growth: <span className={data.yoy_growth >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>{data.yoy_growth}%</span></p>}
        </>}
    </div>
  );
}
