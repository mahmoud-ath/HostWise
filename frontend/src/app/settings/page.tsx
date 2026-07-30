"use client";

import { useAuth } from "@/contexts/auth-context";
import { useBackend } from "@/contexts/backend-context";
import { AppShell } from "@/components/layout/app-shell";
import { BackupSettings } from "@/components/layout/backup-settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, User, Building2, Key, LogOut, Plus, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const { isAuthenticated, user, organization, logout, setOrganization } = useAuth();
  const { status: backendStatus, isReady: backendReady, restartBackend } = useBackend();

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Organization and account configuration.</p>
        </div>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Account</CardTitle>
            <CardDescription>Your personal account settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Name</Label><Input value={user?.full_name || ""} readOnly /></div>
              <div><Label className="text-xs">Email</Label><Input value={user?.email || ""} readOnly /></div>
            </div>
            <Button variant="destructive" size="sm" onClick={logout}><LogOut className="h-4 w-4 mr-1" /> Sign Out</Button>
          </CardContent>
        </Card>

        {/* Organization */}
        {organization ? (
          <OrgInfo organization={organization} />
        ) : (
          <CreateOrganization onCreated={setOrganization} />
        )}

        {/* API Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> API Connection</CardTitle>
            <CardDescription>Backend API status and connection info.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className={`flex items-center gap-1.5 ${backendReady ? "text-emerald-600" : "text-amber-600"}`}>
                {backendReady ? (
                  <><CheckCircle2 className="h-3.5 w-3.5" /> Connected</>
                ) : (
                  <><XCircle className="h-3.5 w-3.5" /> {backendStatus}</>
                )}
              </span>
            </div>
            <div className="flex justify-between"><span>Backend URL</span><span className="text-muted-foreground font-mono text-xs">{process.env.NEXT_PUBLIC_API_URL || "dynamic (Tauri)"}</span></div>
            <div className="flex justify-between"><span>Auth Method</span><span className="text-muted-foreground">JWT Bearer Token</span></div>
            <div className="flex justify-between"><span>Organization ID</span><span className="text-muted-foreground font-mono text-xs">{organization?.id || "—"}</span></div>
            {!backendReady && (
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={restartBackend} className="gap-1">
                  <RefreshCw className="h-3.5 w-3.5" /> Restart Backend
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Backups */}
        <BackupSettings />
      </div>
    </AppShell>
  );
}

function OrgInfo({ organization }: { organization: { name: string; type: string; default_currency: string; slug: string } }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Organization</CardTitle>
        <CardDescription>Your current organization settings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label className="text-xs">Name</Label><Input value={organization.name} readOnly /></div>
          <div><Label className="text-xs">Type</Label><Input value={organization.type} readOnly /></div>
          <div><Label className="text-xs">Currency</Label><Input value={organization.default_currency} readOnly /></div>
          <div><Label className="text-xs">Slug</Label><Input value={organization.slug} readOnly /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateOrganization({ onCreated }: { onCreated: (org: any) => void }) {
  const [form, setForm] = useState({ name: "", type: "individual_host", currency: "USD" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const org = await api.post("/organizations", {
        name: form.name,
        type: form.type,
        default_currency: form.currency,
      });
      onCreated(org);
    } catch (err: any) {
      setError(err.message || "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Create Organization</CardTitle>
        <CardDescription>You need an organization to manage properties and finances.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Organization Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. My Vacation Rentals" required />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="individual_host">Individual Host</option>
                <option value="professional_host">Professional Host</option>
                <option value="property_manager">Property Manager</option>
                <option value="agency">Agency</option>
                <option value="investment_company">Investment Company</option>
                <option value="multi_property_operator">Multi-Property Operator</option>
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Default Currency</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="MAD">MAD</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
            </select>
          </div>
          <Button type="submit" disabled={loading}>
            <Plus className="h-4 w-4 mr-1" /> {loading ? "Creating..." : "Create Organization"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
