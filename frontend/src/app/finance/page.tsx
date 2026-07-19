"use client";

import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/app-shell";
import { LoginPage } from "@/components/auth/login-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useRevenue, useCreateRevenue,
  useExpenses, useCreateExpense,
  useFinancialSummary,
  useProperties,
} from "@/hooks/use-api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";

export default function FinancePage() {
  const { isAuthenticated, organization } = useAuth();
  if (!isAuthenticated) return <LoginPage />;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground mt-1">Track revenue, expenses, and cashflow.</p>
        </div>

        <SummaryCards organizationId={organization?.id} />

        <div className="grid gap-6 lg:grid-cols-2">
          <RevenueSection organizationId={organization?.id} />
          <ExpenseSection organizationId={organization?.id} />
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCards({ organizationId }: { organizationId?: string }) {
  const { data: summary, isLoading } = useFinancialSummary(organizationId);
  if (isLoading || !summary) return null;

  const cards = [
    { label: "Gross Revenue", value: formatCurrency(summary.gross_revenue), color: "text-blue-400" },
    { label: "Net Revenue", value: formatCurrency(summary.net_revenue), color: "text-success" },
    { label: "Expenses", value: formatCurrency(summary.total_expenses), color: "text-destructive" },
    { label: "Cashflow", value: formatCurrency(summary.cashflow), color: summary.cashflow >= 0 ? "text-success" : "text-destructive" },
    { label: "Margin", value: `${summary.profit_margin}%`, color: "text-primary" },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-lg font-bold mt-1 ${c.color}`}>{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RevenueSection({ organizationId }: { organizationId?: string }) {
  const { data: revenues, isLoading } = useRevenue(organizationId);
  const { data: properties } = useProperties(organizationId);
  const createRevenue = useCreateRevenue(organizationId || "");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    property_id: "", date: new Date().toISOString().slice(0, 10),
    gross_amount: "", commission_amount: "0", description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.property_id || !form.gross_amount) return;
    await createRevenue.mutateAsync({
      property_id: form.property_id,
      date: form.date,
      gross_amount: parseFloat(form.gross_amount),
      commission_amount: parseFloat(form.commission_amount || "0"),
      description: form.description,
      source: "manual",
      currency: "USD",
    });
    setForm({ property_id: "", date: new Date().toISOString().slice(0, 10), gross_amount: "", commission_amount: "0", description: "" });
    setShowForm(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-success" /> Revenue</CardTitle>
        <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </CardHeader>
      <CardContent>
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-3 mb-4 p-3 border rounded-lg bg-muted/30">
            <div>
              <Label className="text-xs">Property</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} required>
                <option value="">Select property...</option>
                {(properties || []).map((p: { id: string; name: string }) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
              <div><Label className="text-xs">Gross Amount ($)</Label><Input type="number" step="0.01" placeholder="0.00" value={form.gross_amount} onChange={(e) => setForm({ ...form, gross_amount: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Commission ($)</Label><Input type="number" step="0.01" value={form.commission_amount} onChange={(e) => setForm({ ...form, commission_amount: e.target.value })} /></div>
              <div><Label className="text-xs">Description</Label><Input placeholder="e.g. Weekend booking" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={createRevenue.isPending}>{createRevenue.isPending ? "Saving..." : "Save Revenue"}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}
        {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p>
        : (revenues || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No revenue yet.</p>
        : <div className="space-y-1 max-h-96 overflow-y-auto">
            {(revenues || []).map((r: { id: string; date: string; description?: string; gross_amount: number; net_amount: number; source: string }) => (
              <div key={r.id} className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{r.description || "Revenue"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.date)} · <Badge variant="outline" className="text-[10px] px-1 py-0">{r.source}</Badge></p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-success">+{formatCurrency(r.net_amount)}</p>
                  <p className="text-[10px] text-muted-foreground">gross: {formatCurrency(r.gross_amount)}</p>
                </div>
              </div>
            ))}
          </div>}
      </CardContent>
    </Card>
  );
}

function ExpenseSection({ organizationId }: { organizationId?: string }) {
  const { data: expenses, isLoading } = useExpenses(organizationId);
  const { data: properties } = useProperties(organizationId);
  const createExpense = useCreateExpense(organizationId || "");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    property_id: "", date: new Date().toISOString().slice(0, 10),
    amount: "", vendor: "", description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.property_id || !form.amount) return;
    await createExpense.mutateAsync({
      property_id: form.property_id,
      date: form.date,
      amount: parseFloat(form.amount),
      vendor: form.vendor,
      description: form.description,
      currency: "USD",
    });
    setForm({ property_id: "", date: new Date().toISOString().slice(0, 10), amount: "", vendor: "", description: "" });
    setShowForm(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-destructive" /> Expenses</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </CardHeader>
      <CardContent>
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-3 mb-4 p-3 border rounded-lg bg-muted/30">
            <div>
              <Label className="text-xs">Property</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} required>
                <option value="">Select property...</option>
                {(properties || []).map((p: { id: string; name: string }) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
              <div><Label className="text-xs">Amount ($)</Label><Input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Vendor</Label><Input placeholder="e.g. CleanCo" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
              <div><Label className="text-xs">Description</Label><Input placeholder="e.g. Monthly cleaning" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={createExpense.isPending}>{createExpense.isPending ? "Saving..." : "Save Expense"}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}
        {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p>
        : (expenses || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No expenses yet.</p>
        : <div className="space-y-1 max-h-96 overflow-y-auto">
            {(expenses || []).map((e: { id: string; date: string; description?: string; amount: number; vendor?: string }) => (
              <div key={e.id} className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{e.description || "Expense"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(e.date)}{e.vendor ? ` · ${e.vendor}` : ""}</p>
                </div>
                <p className="text-sm font-semibold text-destructive">-{formatCurrency(e.amount)}</p>
              </div>
            ))}
          </div>}
      </CardContent>
    </Card>
  );
}
