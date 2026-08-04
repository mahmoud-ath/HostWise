"use client";

import { useState } from "react";
import { SectionCard } from "./section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Code2, RefreshCw, FileText, ClipboardCopy } from "lucide-react";
import { useBackend } from "@/contexts/backend-context";
import { useBackendLogs } from "@/hooks/use-api";
import { useI18n } from "@/lib/i18n";

export function DeveloperSection() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const { status, isReady, restartBackend } = useBackend();
  const logs = useBackendLogs(200);

  const apiUrl =
    (typeof window !== "undefined" &&
      "__TAURI_INTERNALS__" in window &&
      "get_backend_url" in window)
      ? "dynamic (Tauri)"
      : process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

  const copyDiagnostics = async () => {
    const text = [
      "HostWise Diagnostics",
      `Backend status: ${status}`,
      `Backend ready: ${isReady}`,
      `API URL: ${apiUrl}`,
      `User agent: ${navigator.userAgent}`,
      `Screen: ${window.screen.width}x${window.screen.height}`,
      `Local time: ${new Date().toISOString()}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <SectionCard
      title={t("settings.developer")}
      icon={<Code2 className="h-5 w-5" />}
      description={t("settings.developerDesc")}
      action={
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {open ? "Collapse" : "Expand"}
        </Button>
      }
    >
      {open && (
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Backend Status</span>
              <Badge variant={isReady ? "success" : "destructive"} className="capitalize">
                {status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">API URL</span>
              <span className="font-mono text-xs">{apiUrl}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={restartBackend}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Restart Backend
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowLogs((v) => !v)}>
              <FileText className="mr-1.5 h-4 w-4" /> View Logs
            </Button>
            <Button variant="outline" size="sm" onClick={copyDiagnostics}>
              <ClipboardCopy className="mr-1.5 h-4 w-4" />
              {copied ? "Copied!" : "Copy Diagnostics"}
            </Button>
          </div>

          {showLogs && (
            <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs font-mono">
              {logs.isLoading
                ? "Loading logs..."
                : logs.data?.content || "No log file available in this environment."}
            </pre>
          )}
        </div>
      )}
    </SectionCard>
  );
}
