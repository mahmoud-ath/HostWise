"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useRevenue,
  useCreateRevenue,
  useUpdateRevenue,
  useDeleteRevenue,
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useFinancialSummary,
  useProperties,
  type Revenue,
  type Expense,
} from "@/hooks/use-api";
import { useSettings } from "@/contexts/settings-context";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CategoryManager } from "@/components/finance/category-manager";
import { Plus, TrendingUp, TrendingDown, Pencil, Trash2, Filter, X, Tags } from "lucide-react";

export default function FinancePage() {
  const { t } = useI18n();
  const [showCategories, setShowCategories] = useState(false);
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("pages.finance.title")}</h1>
            <p className="mt-1 text-muted-foreground">{t("pages.finance.subtitle")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowCategories(true)}>
            <Tags className="mr-1.5 h-4 w-4" /> Manage Categories
          </Button>
        </div>
        <SummaryCards />
        <div className="grid gap-6 lg:grid-cols-2">
          <RevenueSection />
          <ExpenseSection />
        </div>
      </div>
      {showCategories && <CategoryManager onClose={() => setShowCategories(false)} />}
    </AppShell>
  );
}

function useCurrency() {
  const { get } = useSettings();
  return get("default_currency", "EUR") as string;
}

function SummaryCards() {
  const { data: summary, isLoading } = useFinancialSummary();
  const currency = useCurrency();
  const { t } = useI18n();
  if (isLoading || !summary) return null;

  const cards = [
    { label: t("finance.grossRevenue"), value: formatCurrency(summary.gross_revenue, currency), color: "text-blue-400" },
    { label: t("finance.netRevenue"), value: formatCurrency(summary.net_revenue, currency), color: "text-success" },
    { label: t("finance.expenses"), value: formatCurrency(summary.total_expenses, currency), color: "text-destructive" },
    { label: t("finance.cashflow"), value: formatCurrency(summary.cashflow, currency), color: summary.cashflow >= 0 ? "text-success" : "text-destructive" },
    { label: t("finance.margin"), value: `${summary.profit_margin}%`, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`mt-1 text-lg font-bold ${c.color}`}>{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface Filters {
  property_id: string;
  start_date: string;
  end_date: string;
}

function FiltersBar({ filters, setFilters, properties, onClear }: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  properties: { id: string; name: string }[];
  onClear: () => void;
}) {
  const selectCls = "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none";
  const inputCls = "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none";
  const { t } = useI18n();
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <select
        className={selectCls}
        value={filters.property_id}
        onChange={(e) => setFilters({ ...filters, property_id: e.target.value })}
      >
        <option value="">{t("common.allProperties")}</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <input type="date" className={inputCls} value={filters.start_date} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} aria-label={t("common.from")} />
      <span className="text-xs text-muted-foreground">→</span>
      <input type="date" className={inputCls} value={filters.end_date} onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} aria-label={t("common.to")} />
      {(filters.property_id || filters.start_date || filters.end_date) && (
        <Button variant="ghost" size="sm" onClick={onClear}><X className="mr-1 h-3.5 w-3.5" />{t("common.clear")}</Button>
      )}
    </div>
  );
}

function RevenueSection() {
  const { data: properties } = useProperties();
  const currency = useCurrency();
  const { t } = useI18n();
  const [filters, setFilters] = useState<Filters>({ property_id: "", start_date: "", end_date: "" });
  const qs = {
    ...(filters.property_id ? { property_id: filters.property_id } : {}),
    ...(filters.start_date ? { start_date: filters.start_date } : {}),
    ...(filters.end_date ? { end_date: filters.end_date } : {}),
  };
  const { data: revenue, isLoading } = useRevenue(qs);
  const create = useCreateRevenue();
  const update = useUpdateRevenue();
  const del = useDeleteRevenue();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Revenue | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-success" /> {t("finance.revenue")}</CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(!showForm); }}>
          <Plus className="mr-1 h-4 w-4" /> {t("common.add")}
        </Button>
      </CardHeader>
      <CardContent>
        <FiltersBar filters={filters} setFilters={setFilters} properties={(properties || []).map((p) => ({ id: p.id, name: p.name }))} onClear={() => setFilters({ property_id: "", start_date: "", end_date: "" })} />

        {(showForm || editing) && (
          <EntryForm
            kind="revenue"
            properties={properties || []}
            currency={currency}
            initial={editing}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            onSubmit={async (data) => {
              if (editing) await update.mutateAsync({ id: editing.id, data });
              else await create.mutateAsync(data);
              setShowForm(false);
              setEditing(null);
            }}
            pending={create.isPending || update.isPending}
          />
        )}

        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading...</p>
        ) : !revenue || revenue.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("finance.noRevenue")}</p>
        ) : (
          <>
            <div className="max-h-96 space-y-1.5 overflow-y-auto">
              {revenue.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.description || "Revenue"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.date)}
                      {r.property_id && properties ? ` · ${properties.find((p) => p.id === r.property_id)?.name || ""}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(r.net_amount, r.currency || currency)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(r); setShowForm(false); }} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => { if (confirm("Delete this revenue record?")) del.mutate(r.id); }} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
              <span className="font-medium text-muted-foreground">{t("finance.total")}</span>
              <span className="font-bold">
                {formatCurrency(revenue.reduce((s, r) => s + (r.net_amount || 0), 0), currency)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ExpenseSection() {
  const { data: properties } = useProperties();
  const currency = useCurrency();
  const { t } = useI18n();
  const [filters, setFilters] = useState<Filters>({ property_id: "", start_date: "", end_date: "" });
  const qs = {
    ...(filters.property_id ? { property_id: filters.property_id } : {}),
    ...(filters.start_date ? { start_date: filters.start_date } : {}),
    ...(filters.end_date ? { end_date: filters.end_date } : {}),
  };
  const { data: expenses, isLoading } = useExpenses(qs);
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const del = useDeleteExpense();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-destructive" /> {t("finance.expenses")}</CardTitle>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(!showForm); }}>
          <Plus className="mr-1 h-4 w-4" /> {t("common.add")}
        </Button>
      </CardHeader>
      <CardContent>
        <FiltersBar filters={filters} setFilters={setFilters} properties={(properties || []).map((p) => ({ id: p.id, name: p.name }))} onClear={() => setFilters({ property_id: "", start_date: "", end_date: "" })} />

        {(showForm || editing) && (
          <EntryForm
            kind="expense"
            properties={properties || []}
            currency={currency}
            initial={editing}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            onSubmit={async (data) => {
              if (editing) await update.mutateAsync({ id: editing.id, data });
              else await create.mutateAsync(data);
              setShowForm(false);
              setEditing(null);
            }}
            pending={create.isPending || update.isPending}
          />
        )}

        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading...</p>
        ) : !expenses || expenses.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("finance.noExpenses")}</p>
        ) : (
          <>
            <div className="max-h-96 space-y-1.5 overflow-y-auto">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.description || e.vendor || "Expense"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.date)}
                      {e.property_id && properties ? ` · ${properties.find((p) => p.id === e.property_id)?.name || ""}` : ""}
                      {e.is_recurring ? " · recurring" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(e.amount, e.currency || currency)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(e); setShowForm(false); }} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => { if (confirm("Delete this expense record?")) del.mutate(e.id); }} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
              <span className="font-medium text-muted-foreground">{t("finance.total")}</span>
              <span className="font-bold">
                {formatCurrency(expenses.reduce((s, e) => s + (e.amount || 0), 0), currency)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EntryForm({
  kind,
  properties,
  currency,
  initial,
  onCancel,
  onSubmit,
  pending,
}: {
  kind: "revenue" | "expense";
  properties: { id: string; name: string }[];
  currency: string;
  initial: Revenue | Expense | null;
  onCancel: () => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  pending: boolean;
}) {
  const [form, setForm] = useState<any>({
    property_id: initial?.property_id || "",
    date: (initial?.date || new Date().toISOString().slice(0, 10)) as string,
    gross_amount: initial ? String((initial as Revenue).gross_amount ?? "") : "",
    commission_amount: initial ? String((initial as Revenue).commission_amount ?? "0") : "0",
    amount: initial ? String((initial as Expense).amount ?? "") : "",
    description: initial?.description || "",
    vendor: (initial as Expense)?.vendor || "",
    is_recurring: (initial as Expense)?.is_recurring || false,
    currency: initial?.currency || currency,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const base: Record<string, unknown> = {
      property_id: form.property_id,
      date: form.date,
      description: form.description,
      currency: form.currency || currency,
    };
    if (kind === "revenue") {
      base.gross_amount = parseFloat(form.gross_amount);
      base.commission_amount = parseFloat(form.commission_amount || "0");
    } else {
      base.amount = parseFloat(form.amount);
      base.vendor = form.vendor;
      base.is_recurring = form.is_recurring;
    }
    onSubmit(base);
  };

  return (
    <form onSubmit={submit} className="mb-4 space-y-3 rounded-lg border bg-muted/30 p-3">
      <div>
        <Label className="text-xs">Property</Label>
        <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} required>
          <option value="">Select property...</option>
          {properties.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Date</Label><Input type="date" className="mt-1" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
        {kind === "revenue" ? (
          <>
            <div><Label className="text-xs">Gross ({form.currency || currency})</Label><Input type="number" step="0.01" className="mt-1" value={form.gross_amount} onChange={(e) => setForm({ ...form, gross_amount: e.target.value })} required /></div>
            <div><Label className="text-xs">Commission ({form.currency || currency})</Label><Input type="number" step="0.01" className="mt-1" value={form.commission_amount} onChange={(e) => setForm({ ...form, commission_amount: e.target.value })} /></div>
          </>
        ) : (
          <>
            <div><Label className="text-xs">Amount ({form.currency || currency})</Label><Input type="number" step="0.01" className="mt-1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
            <div><Label className="text-xs">Vendor</Label><Input className="mt-1" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
          </>
        )}
      </div>
      <div>
        <Label className="text-xs">Currency</Label>
        <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.currency || currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
          {["MAD", "EUR", "USD", "GBP", "CAD", "AUD", "CHF"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1"><Label className="text-xs">Description</Label><Input className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        {kind === "expense" && (
          <label className="flex items-center gap-1.5 pb-2 text-xs">
            <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} />
            Recurring
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
