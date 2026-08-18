"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useSettings } from "@/contexts/settings-context";
import { useI18n } from "@/lib/i18n";
import { useProperties } from "@/hooks/use-api";
import { Upload, FileText, Database, Download, Info, Calendar } from "lucide-react";
import { useState } from "react";

type ImportType = "auto" | "reservations" | "revenues" | "expenses";

interface UploadPreview {
  filename: string;
  format: string;
  columns: string[];
  preview_rows: Record<string, string>[];
  row_count_estimate: number;
}

interface ImportResult {
  format?: string;
  import_type: string;
  imported: number;
  skipped?: number;
  properties_created: number;
  errors?: string[];
  error?: string;
}

interface ICalUploadResponse {
  filename: string;
  format?: string;
  events: number;
  preview_rows?: { uid: string; summary: string; check_in: string; check_out: string; nights: number }[];
  error?: string;
}

const GUIDE: Record<string, { required: string[]; optional: string[]; notes: string }> = {
  reservations: {
    required: ["property_name", "check_in", "check_out"],
    optional: ["property_id", "reservation_id", "nights", "guest_name", "status", "gross_amount", "city", "country"],
    notes: "Matches the reservations sample. check_in / check_out use the configured date format (default DD/MM/YYYY). Missing properties are created automatically.",
  },
  revenues: {
    required: ["property_name", "date", "gross_revenue"],
    optional: ["property_id", "reservation_id", "management_commission", "net_revenue", "source"],
    notes: "Matches the revenues sample. source can be Airbnb, Booking, direct or csv. net_revenue defaults to gross minus commission.",
  },
  expenses: {
    required: ["property_name", "date", "amount"],
    optional: ["property_id", "category", "vendor"],
    notes: "Matches the expenses sample. category is matched to an expense category (created automatically if missing).",
  },
};

export default function ImportPage() {
  const { settings } = useSettings();
  const { t } = useI18n();
  const [activeType, setActiveType] = useState<ImportType>("auto");

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("pages.import.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("pages.import.subtitle")}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" /> {t("import.fileUpload")}
                </CardTitle>
                <CardDescription>
                  Supported format: <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold">.csv</span> · Date format:{" "}
                  <span className="font-medium">{settings.import_date_format || "DD/MM/YYYY"}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CSVUploadSection defaultType={activeType} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" /> Calendar Import (iCal)
                </CardTitle>
                <CardDescription>
                  Import reservations from an Airbnb / Booking calendar export (.ics). Each calendar entry becomes
                  a reservation for the selected property. Re-importing the same calendar is safe — already-known
                  entries are skipped.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ICALSection />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" /> {t("import.importGuide")}
                </CardTitle>
                <CardDescription>
                  Pick a data type to see the expected columns. Download a sample file below and base your own
                  data on it.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {(["reservations", "revenues", "expenses"] as const).map((type) => (
                    <Button
                      key={type}
                      size="sm"
                      variant={activeType === type ? "default" : "outline"}
                      onClick={() => setActiveType(type)}
                    >
                      {t(`import.${type}`)}
                    </Button>
                  ))}
                </div>
                {activeType !== "auto" && (
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-1.5">
                      {GUIDE[activeType].required.map((col) => (
                        <Badge key={col} className="bg-emerald-600 text-white">{col}*</Badge>
                      ))}
                      {GUIDE[activeType].optional.map((col) => (
                        <Badge key={col} variant="secondary">{col}</Badge>
                      ))}
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">{GUIDE[activeType].notes}</p>
                  </div>
                )}
                {activeType === "auto" && (
                  <p className="text-sm text-muted-foreground">
                    The importer can auto-detect the type from the file&apos;s columns. Select a specific type to
                    view its required columns.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" /> Sample Templates
                </CardTitle>
                <CardDescription>
                  Download an example file, fill it with your own data, and import it back.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  {
                    type: "Reservations",
                    file: "reservations.csv",
                    ext: "csv",
                    cols: "property_name, check_in, check_out, nights, guest_name, gross_amount, ...",
                  },
                  {
                    type: "Revenues",
                    file: "revenues.csv",
                    ext: "csv",
                    cols: "property_name, date, gross_revenue, management_commission, net_revenue, source",
                  },
                  {
                    type: "Expenses",
                    file: "expenses.csv",
                    ext: "csv",
                    cols: "property_name, date, amount, category, vendor",
                  },
                  {
                    type: "Calendar (iCal)",
                    file: "calendar.ics",
                    ext: "ics",
                    cols: "VEVENT: UID, DTSTART, DTEND, SUMMARY (guest name) — export from your Airbnb / Booking calendar",
                  },
                ].map((s) => (
                  <div key={s.file} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{s.type} sample</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{s.cols}</p>
                    </div>
                    <a
                      href={`/samples/${s.file}`}
                      download={s.file}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Download className="h-3.5 w-3.5" /> .{s.ext || "csv"}
                    </a>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> {t("import.availableConnectors")}</CardTitle>
              <CardDescription>Connect booking platforms for automatic data sync.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  ["CSV / JSON Import", "Active"],
                  ["iCal (Airbnb / Booking)", "Active"],
                  ["Airbnb API", "Planned"],
                  ["Booking.com API", "Planned"],
                  ["Vrbo", "Planned"],
                ].map(([c, status]) => (
                  <div key={c} className="flex items-center justify-between py-2 px-3 rounded border">
                    <span className="text-sm">{c}</span>
                    <span className={`text-[10px] font-medium ${status === "Active" ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {status}
                    </span>
                  </div>
                ))}
                <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Airbnb and Booking.com don&apos;t offer a public API for hosts today — use their calendar export
                  (.ics) via the iCal connector above. Native API connectors are planned.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function CSVUploadSection({ defaultType }: { defaultType: ImportType }) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [importType, setImportType] = useState<ImportType>(defaultType);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setImportResult(null);
    try {
      const data = await api.upload<UploadPreview>("/connectors/csv/upload", file);
      setPreview(data);
    } catch (e) {
      console.error(e);
      setImportResult({ import_type: "upload", imported: 0, properties_created: 0, error: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!preview?.filename) return;
    setImporting(true);
    try {
      const data = await api.post<ImportResult>(
        `/connectors/csv/import?filename=${encodeURIComponent(preview.filename)}&import_type=${importType}`
      );
      setImportResult(data);
    } catch (e) {
      console.error(e);
      setImportResult({ import_type: "import", imported: 0, properties_created: 0, error: e instanceof Error ? e.message : "Import failed" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed rounded-lg p-6 text-center">
        <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-3">{t("import.dropHint")}</p>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setPreview(null);
            setImportResult(null);
          }}
          className="text-sm"
        />
      </div>

      {file && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm truncate max-w-[220px]">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
          <div className="flex items-center gap-2">
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value as ImportType)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="auto">{t("import.autoDetect")}</option>
              <option value="reservations">{t("import.reservations")}</option>
              <option value="revenues">{t("import.revenues")}</option>
              <option value="expenses">{t("import.expenses")}</option>
            </select>
            <Button size="sm" onClick={handleUpload} disabled={uploading}>
              {uploading ? "..." : t("import.uploadPreview")}
            </Button>
          </div>
        </div>
      )}

      {preview && (
        <div className="mt-4 space-y-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium">
                {preview.format === "json" ? "JSON" : "CSV"} — {preview.columns?.length || 0} columns ·{" "}
                {preview.row_count_estimate} rows detected
              </p>
              <span className="text-[10px] text-muted-foreground">Preview of first 5 rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr>{preview.columns?.map((c) => <th key={c} className="text-left p-1">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.preview_rows?.map((row, i) => (
                    <tr key={i}>{preview.columns?.map((c) => <td key={c} className="p-1">{row[c] ?? ""}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Button onClick={handleImport} disabled={importing} className="w-full">
            {importing ? "..." : t("import.importDatabase")}
          </Button>
          {importResult && (
            <div className={`p-3 rounded-lg text-sm ${importResult.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              {importResult.error
                ? `❌ ${importResult.error}`
                : `✅ Imported ${importResult.imported} ${importResult.import_type} rows` +
                  (importResult.skipped ? ` · ${importResult.skipped} skipped (already imported)` : "") +
                  (importResult.properties_created ? ` (${importResult.properties_created} new properties created)` : "")}
              {importResult.errors && importResult.errors.length > 0 && (
                <details className="mt-1 text-xs">
                  <summary>{importResult.errors.length} errors</summary>
                  {importResult.errors.map((e, i) => <div key={i}>• {e}</div>)}
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ICALSection() {
  const { data: properties } = useProperties();
  const [file, setFile] = useState<File | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [preview, setPreview] = useState<ICalUploadResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setImportResult(null);
    try {
      const data = await api.upload<ICalUploadResponse>("/connectors/ical/upload", file);
      setPreview(data);
    } catch (e) {
      console.error(e);
      setImportResult({ import_type: "ical", imported: 0, properties_created: 0, error: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!preview?.filename || !propertyId) return;
    setImporting(true);
    try {
      const data = await api.post<ImportResult>(
        `/connectors/ical/import?filename=${encodeURIComponent(preview.filename)}&property_id=${propertyId}`
      );
      setImportResult(data);
    } catch (e) {
      console.error(e);
      setImportResult({ import_type: "ical", imported: 0, properties_created: 0, error: e instanceof Error ? e.message : "Import failed" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border-2 border-dashed p-6 text-center">
        <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="mb-3 text-sm text-muted-foreground">
          Upload a .ics file from your Airbnb or Booking.com calendar export.
        </p>
        <input
          type="file"
          accept=".ics"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setPreview(null);
            setImportResult(null);
          }}
          className="text-sm"
        />
      </div>

      {file && (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-[220px] flex-1 space-y-1">
            <Label className="text-xs">Property</Label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              <option value="">Select property...</option>
              {(properties || []).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
          <Button size="sm" onClick={handleUpload} disabled={uploading}>
            {uploading ? "..." : "Preview calendar"}
          </Button>
        </div>
      )}

      {preview && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-muted/50 p-3">
            {preview.error ? (
              <p className="text-xs text-destructive">Parse error: {preview.error}</p>
            ) : (
              <>
                <p className="mb-2 text-xs font-medium">{preview.events} calendar entries detected</p>
                {preview.events > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="p-1 text-left">Guest</th>
                          <th className="p-1 text-left">Check-in</th>
                          <th className="p-1 text-left">Check-out</th>
                          <th className="p-1 text-left">Nights</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(preview.preview_rows || []).map((r, i) => (
                          <tr key={i}>
                            <td className="p-1">{r.summary || "—"}</td>
                            <td className="p-1">{r.check_in}</td>
                            <td className="p-1">{r.check_out}</td>
                            <td className="p-1">{r.nights}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
          <Button size="sm" onClick={handleImport} disabled={importing || !propertyId}>
            {importing ? "Importing..." : "Import as reservations"}
          </Button>
        </div>
      )}

      {importResult && (
        <div className={`rounded-lg p-3 text-sm ${importResult.error ? "bg-red-50 text-red-700" : "bg-muted/50"}`}>
          {importResult.error ? (
            <p>{`❌ ${importResult.error}`}</p>
          ) : (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{`✅ ${importResult.imported} imported`}</span>
              {importResult.skipped ? ` · ${importResult.skipped} skipped (already imported)` : ""}
              {importResult.errors?.length ? ` · ${importResult.errors.join("; ")}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
