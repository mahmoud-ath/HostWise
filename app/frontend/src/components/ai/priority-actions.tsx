"use client";

import { Badge } from "@/components/ui/badge";
import { ReportSection } from "@/components/reports/report-section";
import { ListChecks, AlertTriangle, Info } from "lucide-react";
import type { AdvisorReport, AiAction } from "@/lib/ai-types";

function ActionCard({ action }: { action: AiAction }) {
  const variant =
    action.type === "critical"
      ? "destructive"
      : action.type === "warning"
      ? "secondary"
      : action.type === "positive"
      ? "success"
      : "outline";

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{action.title}</p>
        <Badge variant={variant as "destructive" | "secondary" | "success" | "outline"}>
          {Math.round((action.confidence_score ?? 0) * 100)}%
        </Badge>
      </div>
      {action.cause && (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium">Why:</span> {action.cause}
        </p>
      )}
      {action.suggested_action && (
        <p className="mt-1 text-xs">
          <span className="font-medium">Do:</span> {action.suggested_action}
        </p>
      )}
      {action.expected_improvement && (
        <p className="mt-1 text-xs text-success">
          <span className="font-medium">Expected:</span> {action.expected_improvement}
        </p>
      )}
    </div>
  );
}

function Group({
  title,
  count,
  tone,
  items,
}: {
  title: string;
  count: number;
  tone: "destructive" | "secondary" | "success";
  items: AiAction[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Badge variant={tone}>{title}</Badge>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <div className="space-y-2">
        {items.map((a, i) => (
          <ActionCard key={`${a.title}-${i}`} action={a} />
        ))}
      </div>
    </div>
  );
}

export function PriorityActions({ report }: { report: AdvisorReport }) {
  const priority = report.priority_actions || {};
  const critical = Array.isArray(priority.critical) ? priority.critical : [];
  const medium = Array.isArray(priority.medium) ? priority.medium : [];
  const low = Array.isArray(priority.low) ? priority.low : [];

  return (
    <ReportSection
      title="Priority Action Center"
      icon={<ListChecks className="h-5 w-5" />}
      description="Where to focus, ranked by urgency"
    >
      <div className="space-y-4">
        <Group title="Critical" count={critical.length} tone="destructive" items={critical} />
        <Group title="Medium" count={medium.length} tone="secondary" items={medium} />
        <Group title="Low" count={low.length} tone="success" items={low} />
        {critical.length + medium.length + low.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" /> No actions needed — everything looks good.
          </p>
        )}
        {critical.length === 0 && medium.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            No critical items — start with the medium priorities.
          </p>
        )}
      </div>
    </ReportSection>
  );
}
