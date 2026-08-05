"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useProperties,
  useCreateProperty,
  useUpdateProperty,
  useDeleteProperty,
  usePropertyHealth,
  usePropertyAnalytics,
  usePortfolioAnalytics,
  type Property,
} from "@/hooks/use-api";
import { useSettings } from "@/contexts/settings-context";
import { useI18n } from "@/lib/i18n";
import { formatCurrency, formatMonth } from "@/lib/utils";
import { Building2, Plus, MapPin, Bed, Users, Pencil, Trash2, X, TrendingUp } from "lucide-react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function PropertiesPage() {
  const { t } = useI18n();
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("pages.properties.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("pages.properties.subtitle")}</p>
        </div>
        <PropertyList />
      </div>
    </AppShell>
  );
}

const EMPTY_FORM = {
  name: "",
  type: "apartment",
  city: "",
  country: "",
  bedrooms: "1",
  bathrooms: "1",
  max_guests: "2",
  target_annual_revenue: "",
  target_occupancy: "",
};

function PropertyList() {
  const { data: properties, isLoading } = useProperties();
  const create = useCreateProperty();
  const update = useUpdateProperty();
  const del = useDeleteProperty();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [detail, setDetail] = useState<Property | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const resetForm = () => { setForm(EMPTY_FORM); setEditing(null); setShowCreate(false); setError(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const data = {
        name: form.name,
        type: form.type,
        city: form.city,
        country: form.country,
        bedrooms: parseInt(form.bedrooms),
        bathrooms: parseFloat(form.bathrooms),
        max_guests: parseInt(form.max_guests),
        target_annual_revenue: form.target_annual_revenue ? parseFloat(form.target_annual_revenue) : undefined,
        target_occupancy: form.target_occupancy ? parseFloat(form.target_occupancy) : undefined,
      };
      if (editing) await update.mutateAsync({ id: editing.id, data });
      else await create.mutateAsync(data);
      resetForm();
    } catch (err: any) {
      setError(err.message || "Failed to save property.");
    }
  };

  const startEdit = (p: Property) => {
    setEditing(p);
    setForm({
      name: p.name, type: p.type, city: p.city || "", country: p.country || "",
      bedrooms: String(p.bedrooms), bathrooms: String(p.bathrooms), max_guests: String(p.max_guests),
      target_annual_revenue: p.target_annual_revenue ? String(p.target_annual_revenue) : "",
      target_occupancy: p.target_occupancy ? String(p.target_occupancy) : "",
    });
    setShowCreate(false);
    setError(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowCreate(!showCreate); }}>
          <Plus className="mr-1 h-4 w-4" /> Add Property
        </Button>
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {(showCreate || editing) && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sunset Villa" required /></div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {["apartment", "house", "condo", "villa", "cabin", "cottage", "townhouse", "studio", "loft"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label className="text-xs">Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Bedrooms</Label><Input type="number" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} /></div>
                <div><Label className="text-xs">Bathrooms</Label><Input type="number" step="0.5" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} /></div>
                <div><Label className="text-xs">Max Guests</Label><Input type="number" value={form.max_guests} onChange={(e) => setForm({ ...form, max_guests: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Target Annual Revenue</Label><Input type="number" step="0.01" value={form.target_annual_revenue} onChange={(e) => setForm({ ...form, target_annual_revenue: e.target.value })} placeholder="Optional" /></div>
                <div><Label className="text-xs">Target Occupancy (%)</Label><Input type="number" step="0.1" value={form.target_occupancy} onChange={(e) => setForm({ ...form, target_occupancy: e.target.value })} placeholder="Optional" /></div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm">{editing ? "Save Changes" : "Create Property"}</Button>
                <Button type="button" size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !properties || properties.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No properties yet. Add your first property!</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              onOpen={() => setDetail(p)}
              onEdit={() => startEdit(p)}
              onDelete={() => { if (confirm(`Delete "${p.name}"? This soft-deletes the property.`)) del.mutate(p.id); }}
            />
          ))}
        </div>
      )}

      {detail && <PropertyDetailModal property={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function PropertyCard({ property, onOpen, onEdit, onDelete }: {
  property: Property;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data: health } = usePropertyHealth(property.id);

  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={onOpen}>
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{property.name}</h3>
            <p className="text-xs capitalize text-muted-foreground">{property.type}</p>
          </div>
          <div className="flex items-center gap-1">
            {health && (
              <Badge variant={health.status === "healthy" ? "success" : health.status === "average" ? "secondary" : "destructive"}>
                {health.health_score}/100
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          {(property.city || property.country) && (
            <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {[property.city, property.country].filter(Boolean).join(", ")}</div>
          )}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {property.bedrooms} BR</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {property.max_guests} guests</span>
          </div>
        </div>
        <Link
          href={`/properties/${property.id}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View analytics <TrendingUp className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

function PropertyDetailModal({ property, onClose }: { property: Property; onClose: () => void }) {
  const year = new Date().getFullYear();
  const { data: analytics } = usePropertyAnalytics(property.id, year);
  const { data: health } = usePropertyHealth(property.id);
  const { get } = useSettings();
  const currency = get("default_currency", "EUR") as string;

  const monthly = (analytics?.monthly_breakdown as any[]) || [];

  // Derive bookings / avg stay from the real monthly breakdown — the property
  // analytics endpoint returns `reservation_count` and `nights` per month
  // (there is no total_reservations / average_stay field), so we sum them
  // instead of showing a hard-coded 0.
  const totalReservations = monthly.reduce((s, m) => s + (m.reservation_count || 0), 0);
  const totalNights = monthly.reduce((s, m) => s + (m.nights || 0), 0);
  const avgStay = totalReservations > 0 ? +(totalNights / totalReservations).toFixed(1) : 0;

  const stats = [
    { label: "Net Revenue", value: formatCurrency((analytics?.net_revenue as number) || 0, currency) },
    { label: "Profit", value: formatCurrency((analytics?.profit as number) || 0, currency) },
    { label: "Expenses", value: formatCurrency((analytics?.total_expenses as number) || 0, currency) },
    { label: "Profit Margin", value: `${(analytics?.profit_margin as number) || 0}%` },
    { label: "Reservations", value: String(totalReservations) },
    { label: "Avg Stay", value: `${avgStay} nights` },
    { label: "Cancellation", value: `${(analytics?.cancellation_rate as number) || 0}%` },
    { label: "Expense Ratio", value: `${(analytics?.expense_ratio as number) || 0}%` },
    { label: "Health", value: health ? `${health.health_score}/100` : "—" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{property.name}</h2>
            <p className="text-xs text-muted-foreground">
              {property.type} · {[property.city, property.country].filter(Boolean).join(", ") || "—"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className="text-sm font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {monthly.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Monthly Revenue & Expenses
            </p>
            <div className="h-[220px]">
              <Bar
                data={{
                  labels: monthly.map((m) => formatMonth(m.month).slice(0, 3)),
                  datasets: [
                    {
                      label: "Net Revenue",
                      data: monthly.map((m) => m.net_revenue || 0),
                      backgroundColor: "rgba(255, 56, 92, 0.7)",
                      borderColor: "rgb(255, 56, 92)",
                      borderWidth: 1,
                      borderRadius: 6,
                    },
                    {
                      label: "Expenses",
                      data: monthly.map((m) => m.total_expenses || 0),
                      backgroundColor: "rgba(0, 132, 137, 0.7)",
                      borderColor: "rgb(0, 132, 137)",
                      borderWidth: 1,
                      borderRadius: 6,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx: any) => ` ${formatCurrency(ctx.raw as number, currency)}`,
                      },
                    },
                  },
                  scales: {
                    x: { grid: { display: false } },
                    y: {
                      grid: { color: "rgba(221,221,221,0.4)" },
                      ticks: {
                        callback: (v: any) =>
                          Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : String(Number(v)),
                      },
                    },
                  },
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-center gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "rgba(255, 56, 92, 0.7)" }} />
                Net Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "rgba(0, 132, 137, 0.7)" }} />
                Expenses
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
