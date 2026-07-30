"use client";

import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useProperties, usePropertyHealth } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Building2, Plus, MapPin, Bed, Users } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function PropertiesPage() {
  const { isAuthenticated, organization } = useAuth();

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
            <p className="text-muted-foreground mt-1">Manage your vacation rental portfolio.</p>
          </div>
        </div>
        <PropertyList organizationId={organization?.id} />
      </div>
    </AppShell>
  );
}

function PropertyList({ organizationId }: { organizationId?: string }) {
  const { data: properties, isLoading } = useProperties(organizationId);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", type: "apartment", city: "", country: "", bedrooms: "1", bathrooms: "1", max_guests: "2",
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!organizationId) {
      setError("No organization found. Please create an organization first.");
      return;
    }
    try {
      await api.post(`/properties/${organizationId}`, {
        name: form.name, type: form.type, city: form.city, country: form.country,
        bedrooms: parseInt(form.bedrooms), bathrooms: parseFloat(form.bathrooms), max_guests: parseInt(form.max_guests),
      });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      setForm({ name: "", type: "apartment", city: "", country: "", bedrooms: "1", bathrooms: "1", max_guests: "2" });
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || "Failed to create property. Please try again.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-1" /> Add Property</Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!organizationId && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
          You don&apos;t have an organization yet. Please create one from Settings before adding properties.
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sunset Villa" required /></div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {["apartment","house","condo","villa","cabin","cottage","townhouse","studio","loft"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Malibu" /></div>
                <div><Label className="text-xs">Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="e.g. US" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Bedrooms</Label><Input type="number" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} /></div>
                <div><Label className="text-xs">Bathrooms</Label><Input type="number" step="0.5" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} /></div>
                <div><Label className="text-xs">Max Guests</Label><Input type="number" value={form.max_guests} onChange={(e) => setForm({ ...form, max_guests: e.target.value })} /></div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm">Create Property</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p>
      : (properties || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No properties yet. Add your first property!</p>
      : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(properties || []).map((p: { id: string; name: string; type: string; city?: string; country?: string; bedrooms: number; max_guests: number; status: string }) => (
            <PropertyCard key={p.id} property={p} organizationId={organizationId} />
          ))}
        </div>}
    </div>
  );
}

function PropertyCard({ property, organizationId }: { property: { id: string; name: string; type: string; city?: string; country?: string; bedrooms: number; max_guests: number; status: string }; organizationId?: string }) {
  const { data: health } = usePropertyHealth(organizationId, property.id);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold">{property.name}</h3>
            <p className="text-xs text-muted-foreground capitalize">{property.type}</p>
          </div>
          {health && (
            <Badge variant={health.status === "healthy" ? "success" : health.status === "average" ? "secondary" : "destructive"}>
              {health.health_score}/100
            </Badge>
          )}
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
      </CardContent>
    </Card>
  );
}
