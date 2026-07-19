"use client";

import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/app-shell";
import { LoginPage } from "@/components/auth/login-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAIAnalysis } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/utils";
import { Brain, AlertTriangle, CheckCircle, Info } from "lucide-react";

export default function AIAdvisorPage() {
  const { isAuthenticated, organization } = useAuth();
  if (!isAuthenticated) return <LoginPage />;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Advisor</h1>
          <p className="text-muted-foreground mt-1">AI-powered financial insights and recommendations.</p>
        </div>
        <AIContent organizationId={organization?.id} />
      </div>
    </AppShell>
  );
}

function AIContent({ organizationId }: { organizationId?: string }) {
  const { data, isLoading } = useAIAnalysis(organizationId);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  if (!data) return <p className="text-sm text-muted-foreground">Add financial data to receive AI insights.</p>;

  const iconMap: Record<string, React.ReactNode> = {
    critical: <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />,
    positive: <CheckCircle className="h-5 w-5 text-success mt-0.5 shrink-0" />,
    info: <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />,
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> Executive Summary</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{data.executive_summary}</p>
          <div className="grid grid-cols-5 gap-3 mt-4">
            {Object.entries(data.key_metrics || {}).map(([k, v]) => (
              <div key={k} className="text-center p-2 rounded bg-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase">{k.replace(/_/g, " ")}</p>
                <p className="text-sm font-bold">{typeof v === "number" ? (k.includes("margin") || k.includes("growth") ? `${v}%` : formatCurrency(v as number)) : String(v)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data.recommendations || []).map((rec: { type: string; title: string; cause: string; business_impact: string; suggested_action: string; expected_improvement: string; confidence_score: number }, i: number) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                {iconMap[rec.type] || iconMap.info}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold">{rec.title}</p>
                    <Badge variant={rec.type === "critical" ? "destructive" : rec.type === "warning" ? "secondary" : rec.type === "positive" ? "success" : "outline"}>{Math.round(rec.confidence_score * 100)}%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground"><strong>Cause:</strong> {rec.cause}</p>
                  <p className="text-xs text-muted-foreground"><strong>Impact:</strong> {rec.business_impact}</p>
                  <p className="text-xs mt-1"><strong>Action:</strong> {rec.suggested_action}</p>
                  <p className="text-xs text-success mt-1"><strong>Expected:</strong> {rec.expected_improvement}</p>
                </div>
              </div>
            ))}
            {(!data.recommendations || data.recommendations.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No recommendations — everything looks good!</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
