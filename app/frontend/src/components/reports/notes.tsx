"use client";

import { useEffect, useState } from "react";
import { ReportSection } from "./report-section";
import { Button } from "@/components/ui/button";
import { NotebookPen, Check } from "lucide-react";
import type { PortfolioReport } from "@/lib/report-types";

const STORAGE_PREFIX = "hostwise_report_notes_";

export function Notes({ report }: { report: PortfolioReport }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      setValue(localStorage.getItem(`${STORAGE_PREFIX}${report.year}`) || "");
    } catch {
      // localStorage unavailable
    }
  }, [report.year]);

  const save = () => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${report.year}`, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <ReportSection
      title="Notes"
      icon={<NotebookPen className="h-5 w-5" />}
      description="Save your own observations for this period"
      action={
        <Button size="sm" onClick={save} variant={saved ? "secondary" : "outline"}>
          {saved ? (
            <>
              <Check className="mr-1.5 h-4 w-4" /> Saved
            </>
          ) : (
            "Save"
          )}
        </Button>
      }
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Why did revenue change in ${report.year}?\nNeed to renovate any property?\nIncrease cleaning fees next season?`}
        className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </ReportSection>
  );
}
