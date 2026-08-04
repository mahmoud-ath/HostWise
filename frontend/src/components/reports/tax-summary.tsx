"use client";

import { ReportSection } from "./report-section";
import { Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { PortfolioReport } from "@/lib/report-types";

export function TaxSummary({ report }: { report: PortfolioReport }) {
  const tax = report.tax_summary;
  const currency = report.currency;

  const rows = [
    { label: "Rental Income", value: formatCurrency(tax.rental_income, currency), strong: false },
    {
      label: "Deductible Expenses",
      value: `− ${formatCurrency(tax.deductible_expenses, currency)}`,
      strong: false,
      muted: true,
    },
    {
      label: "Estimated Taxable Income",
      value: formatCurrency(tax.estimated_taxable_income, currency),
      strong: true,
    },
  ];

  return (
    <ReportSection
      title="Tax Summary"
      icon={<Receipt className="h-5 w-5" />}
      description={`Estimated taxable income for ${report.year}`}
    >
      <div className="divide-y rounded-lg border">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span className="text-muted-foreground">{r.label}</span>
            <span
              className={
                r.strong
                  ? "text-base font-bold"
                  : r.muted
                  ? "text-muted-foreground"
                  : "font-medium"
              }
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Estimate only — consult a tax professional for your jurisdiction.
      </p>
    </ReportSection>
  );
}
