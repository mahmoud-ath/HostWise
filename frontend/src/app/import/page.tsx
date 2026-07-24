"use client";

import { useAuth } from "@/contexts/auth-context";
import { AppShell } from "@/components/layout/app-shell";
import { LoginPage } from "@/components/auth/login-page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Upload, FileText, Database } from "lucide-react";
import { useState } from "react";

export default function ImportPage() {
  const { isAuthenticated, organization } = useAuth();
  if (!isAuthenticated) return <LoginPage />;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Data</h1>
          <p className="text-muted-foreground mt-1">Upload CSV files or connect booking platforms.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> CSV Upload</CardTitle>
              <CardDescription>Import reservations, revenue, or expenses from CSV files.</CardDescription>
            </CardHeader>
            <CardContent>
              <CSVUploadSection />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Available Connectors</CardTitle>
              <CardDescription>Connect booking platforms for automatic data sync.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {["CSV Import", "Airbnb API — Coming Soon", "Booking.com — Coming Soon", "Vrbo — Coming Soon", "iCal — Coming Soon"].map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded border">
                    <span className="text-sm">{c}</span>
                    <span className="text-[10px] text-muted-foreground">{i === 0 ? "Active" : "Planned"}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function CSVUploadSection() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const result = await fetch("http://localhost:8000/api/v1/connectors/csv/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("hostwise_access_token")}` },
        body: formData,
      });
      const data = await result.json();
      setPreview(data);
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!preview?.filename) return;
    setImporting(true);
    try {
      const result = await fetch(
        `http://localhost:8000/api/v1/connectors/csv/import?filename=${encodeURIComponent(preview.filename)}&import_type=auto`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("hostwise_access_token")}` },
        }
      );
      const data = await result.json();
      setImportResult(data);
    } catch (e) {
      console.error(e);
      setImportResult({ error: "Import failed" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed rounded-lg p-6 text-center">
        <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-3">Drop a CSV file or click to browse</p>
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
      </div>
      {file && (
        <div className="flex items-center justify-between">
          <span className="text-sm">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
          <Button size="sm" onClick={handleUpload} disabled={uploading}>{uploading ? "Uploading..." : "Upload & Preview"}</Button>
        </div>
      )}
      {preview && (
        <div className="mt-4 space-y-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs font-medium mb-2">Preview — {preview.columns?.length || 0} columns detected</p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead><tr>{preview.columns?.map((c: string) => <th key={c} className="text-left p-1">{c}</th>)}</tr></thead>
                <tbody>
                  {preview.preview_rows?.map((row: any, i: number) => (
                    <tr key={i}>{preview.columns?.map((c: string) => <td key={c} className="p-1">{row[c]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Button onClick={handleImport} disabled={importing} className="w-full">
            {importing ? "Importing..." : "Import into Database"}
          </Button>
          {importResult && (
            <div className={`p-3 rounded-lg text-sm ${importResult.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              {importResult.error
                ? importResult.error
                : `✅ Imported ${importResult.imported} ${importResult.import_type} rows` +
                  (importResult.properties_created ? ` (${importResult.properties_created} new properties created)` : "")}
              {importResult.errors?.length > 0 && (
                <details className="mt-1 text-xs">
                  <summary>{importResult.errors.length} errors</summary>
                  {importResult.errors.map((e: string, i: number) => <div key={i}>• {e}</div>)}
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
