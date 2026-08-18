"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportSection } from "@/components/reports/report-section";
import { useAIScenario } from "@/hooks/use-api";
import { FlaskConical, Loader2, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useSettings } from "@/contexts/settings-context";
import type { ScenarioResult } from "@/lib/ai-types";

const SCENARIOS = [
  { id: "price_increase", label: "Increase prices", paramLabel: "Price increase (%)", paramKey: "pct", default: 10 },
  { id: "hire_cleaner", label: "Hire another cleaner", paramLabel: "Monthly cleaner cost", paramKey: "cost", default: 300 },
  { id: "expense_reduction", label: "Reduce expenses", paramLabel: "Expense reduction (%)", paramKey: "pct", default: 10 },
  { id: "minimum_stay", label: "Increase minimum stay", paramLabel: null, paramKey: null, default: 0 },
];

const PRESETS = [
  { id: "price_increase", label: "Increase price 10%" },
  { id: "hire_cleaner", label: "Hire another cleaner" },
  { id: "expense_reduction", label: "Cut expenses 10%" },
];

function Delta({ value, format, inverse }: { value: number; format: (v: number) => string; inverse?: boolean }) {
  const good = inverse ? value <= 0 : value >= 0;
  return (
    <span className={`font-semibold ${value === 0 ? "text-muted-foreground" : good ? "text-success" : "text-destructive"}`}>
      {value > 0 ? "+" : ""}
      {format(value)}
    </span>
  );
}

export function ScenarioSimulator({ year }: { year: number }) {
  const [scenario, setScenario] = useState("price_increase");
  const [param, setParam] = useState(10);
  const sim = useAIScenario();
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const current = SCENARIOS.find((s) => s.id === scenario)!;
  const { get } = useSettings();
  const currency = get("default_currency", "EUR") as string;

  const run = () => {
    sim.mutate(
      { scenario, params: { [current.paramKey ?? "pct"]: param }, year },
      { onSuccess: setResult }
    );
  };

  return (
    <ReportSection
      title="Scenario Simulator"
      icon={<FlaskConical className="h-5 w-5" />}
      description="What if...? Estimate the impact before you act"
    >
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Scenario</label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={scenario}
              onChange={(e) => {
                const next = SCENARIOS.find((s) => s.id === e.target.value)!;
                setScenario(next.id);
                setParam(next.default);
                setResult(null);
              }}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {current.paramLabel && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {current.paramLabel}
              </label>
              <input
                type="number"
                className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={param}
                min={1}
                onChange={(e) => setParam(parseInt(e.target.value) || 0)}
              />
            </div>
          )}
          <Button onClick={run} disabled={sim.isPending}>
            {sim.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-1.5 h-4 w-4" />}
            Simulate
          </Button>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => {
                const s = SCENARIOS.find((x) => x.id === p.id)!;
                setScenario(s.id);
                setParam(s.default);
                setResult(null);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Result */}
        {sim.isPending && <p className="text-sm text-muted-foreground">Running simulation...</p>}

        {result && !sim.isPending && (
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-0 bg-muted/40">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Baseline</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Revenue</span><span>{formatCurrency(result.baseline.revenue, currency)}</span></div>
                  <div className="flex justify-between"><span>Expenses</span><span>{formatCurrency(result.baseline.expenses, currency)}</span></div>
                  <div className="flex justify-between"><span>Profit</span><span>{formatCurrency(result.baseline.profit, currency)}</span></div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-primary/40">
              <CardContent className="p-4">
                <p className="flex items-center gap-1 text-xs font-medium text-primary">
                  <ArrowRight className="h-3.5 w-3.5" />
                  {result.label} impact
                </p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Revenue</span>
                    <Delta value={result.impact.revenue_delta} format={(v) => formatCurrency(v, currency)} />
                  </div>
                  <div className="flex justify-between">
                    <span>Expenses</span>
                    <Delta value={result.impact.expenses_delta} format={(v) => formatCurrency(v, currency)} inverse />
                  </div>
                  <div className="flex justify-between">
                    <span>Profit</span>
                    <Delta value={result.impact.profit_delta} format={(v) => formatCurrency(v, currency)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-muted/40">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Projected</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Revenue</span><span className="font-semibold">{formatCurrency(result.projected.revenue, currency)}</span></div>
                  <div className="flex justify-between"><span>Expenses</span><span className="font-semibold">{formatCurrency(result.projected.expenses, currency)}</span></div>
                  <div className="flex justify-between"><span>Profit</span><span className="font-semibold">{formatCurrency(result.projected.profit, currency)}</span></div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Confidence {result.confidence}%</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ReportSection>
  );
}
