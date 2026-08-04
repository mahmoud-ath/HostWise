"use client";

import { ReportSection } from "./report-section";
import { Wallet, TrendingUp, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { PortfolioReport, ExpenseCategory } from "@/lib/report-types";

function InsightChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

export function ExpenseAnalysis({ report }: { report: PortfolioReport }) {
  const { categories, biggest, smallest, fastest_growing } = report.expense_analysis;
  const currency = report.currency;
  const max = Math.max(...categories.map((c) => c.total), 1);

  return (
    <ReportSection
      title="Expense Analysis"
      icon={<Wallet className="h-5 w-5" />}
      description="Where your money goes — by category"
    >
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No expense data for this period.</p>
      ) : (
        <div className="space-y-3">
          {categories.map((c: ExpenseCategory) => (
            <div key={c.category_name}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{c.category_name}</span>
                <span className="text-muted-foreground">
                  {formatCurrency(c.total, currency)} · {c.percentage}%
                  {c.growth_pct !== null && c.growth_pct !== undefined && (
                    <span className={c.growth_pct > 0 ? "text-destructive" : "text-success"}>
                      {" "}
                      ({c.growth_pct > 0 ? "+" : ""}
                      {c.growth_pct}%)
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max((c.total / max) * 100, 2)}%` }}
                />
              </div>
            </div>
          ))}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {biggest && (
              <InsightChip
                icon={<ArrowUpCircle className="h-4 w-4 text-destructive" />}
                label="Biggest expense"
                value={`${biggest.category_name} · ${biggest.percentage}%`}
              />
            )}
            {smallest && (
              <InsightChip
                icon={<ArrowDownCircle className="h-4 w-4 text-success" />}
                label="Smallest expense"
                value={`${smallest.category_name} · ${smallest.percentage}%`}
              />
            )}
            {fastest_growing ? (
              <InsightChip
                icon={<TrendingUp className="h-4 w-4 text-destructive" />}
                label="Fastest growing"
                value={`${fastest_growing.category_name} · +${fastest_growing.growth_pct}%`}
              />
            ) : (
              <InsightChip
                icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                label="Fastest growing"
                value="Insufficient history"
              />
            )}
          </div>
        </div>
      )}
    </ReportSection>
  );
}
