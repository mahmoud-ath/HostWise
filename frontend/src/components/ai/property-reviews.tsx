"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReportSection } from "@/components/reports/report-section";
import { Building2, CheckCircle2, AlertCircle, Wand2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useSettings } from "@/contexts/settings-context";
import type { AdvisorReport, PropertyReview } from "@/lib/ai-types";

function healthBadge(score: number | null | undefined) {
  if (score === null || score === undefined) return null;
  const variant =
    score >= 75 ? "success" : score >= 50 ? "default" : score >= 25 ? "secondary" : "destructive";
  return <Badge variant={variant as "success" | "default" | "secondary" | "destructive"}>{score}</Badge>;
}

function ReviewCard({ review }: { review: PropertyReview }) {
  const { get } = useSettings();
  const currency = get("default_currency", "EUR") as string;
  const strengths = Array.isArray(review.strengths) ? review.strengths : [];
  const weaknesses = Array.isArray(review.weaknesses) ? review.weaknesses : [];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-semibold">
            <Building2 className="h-4 w-4 text-primary" />
            {review.property_name || "Property"}
          </p>
          {healthBadge(review.health_score)}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatCurrency(review.net_revenue ?? 0, currency)} revenue · {review.profit_margin ?? 0}% margin
        </p>

        <div className="mt-3 space-y-1.5">
          {strengths.map((s) => (
            <p key={s} className="flex items-start gap-1.5 text-xs text-success">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {s}
            </p>
          ))}
          {weaknesses
            .filter((w) => w !== "No major concerns")
            .map((w) => (
              <p key={w} className="flex items-start gap-1.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {w}
              </p>
            ))}
        </div>

        <div className="mt-3 rounded-md bg-muted/40 p-2.5 text-xs">
          <p className="text-muted-foreground">{review.ai_summary || ""}</p>
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-xs">
          <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            <span className="font-medium">Suggested:</span>{" "}
            <span className="text-muted-foreground">{review.suggested_action || ""}</span>
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

export function PropertyReviews({ report }: { report: AdvisorReport }) {
  return (
    <ReportSection
      title="Property AI Reviews"
      icon={<Wand2 className="h-5 w-5" />}
      description="An AI summary for every property"
    >
      {(report.property_reviews || []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No property data yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(report.property_reviews || []).map((r) => (
            <ReviewCard key={r.property_id} review={r} />
          ))}
        </div>
      )}
    </ReportSection>
  );
}
