"use client";

import { useEffect, useState } from "react";
import { Download, X, Loader2, RotateCcw, CheckCircle2 } from "lucide-react";
import { isTauri } from "@/lib/download";
import { checkForUpdates, downloadAndInstall, type UpdateState } from "@/lib/updater";
import { Button } from "@/components/ui/button";

/**
 * Desktop-only banner: checks the update endpoint shortly after startup and
 * offers "Download & Install" when a new version is available. In the browser
 * dev server this component renders nothing. A failed check is silent — an
 * unreachable update server must never interrupt the user.
 */
export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    setState({ status: "checking" });
    const timer = setTimeout(async () => {
      const info = await checkForUpdates();
      if (!active) return;
      if (info) {
        setState({ status: "available", info });
      } else {
        setState({ status: "none" });
      }
    }, 2500); // check after startup settles
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const install = async () => {
    if (state.status !== "available") return;
    const info = state.info;
    setState({ status: "downloading", info, progress: 0 });
    const ok = await downloadAndInstall((fraction) => {
      setState({ status: "downloading", info, progress: fraction });
    });
    if (ok) {
      setState({ status: "installing", info });
    } else {
      setState({ status: "error", message: "Update failed. Please try again later." });
    }
  };

  if (!isTauri() || dismissed || state.status === "idle" || state.status === "checking" || state.status === "none") {
    return null;
  }

  const info = "info" in state ? state.info : null;
  const percent = state.status === "downloading" ? Math.round((state.progress ?? 0) * 100) : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border bg-card p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {state.status === "available" && <Download className="h-5 w-5 text-primary" />}
          {state.status === "downloading" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          {state.status === "installing" && <CheckCircle2 className="h-5 w-5 text-success" />}
          {state.status === "error" && <RotateCcw className="h-5 w-5 text-destructive" />}
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold leading-tight">
            {state.status === "available" && `HostWise ${info?.version ?? ""} is available`}
            {state.status === "downloading" && `Downloading HostWise ${info?.version ?? ""}… ${percent}%`}
            {state.status === "installing" && "Installing update — HostWise will restart."}
            {state.status === "error" && state.message}
          </p>
          <p className="text-xs text-muted-foreground">
            {state.status === "available"
              ? `You are on ${info?.currentVersion ?? ""}. Your data is kept — this only updates the app.`
              : state.status === "error"
                ? "Your data is safe. No changes were made."
                : undefined}
          </p>
          {state.status === "available" && (
            <Button size="sm" className="mt-1" onClick={install}>
              <Download className="mr-1.5 h-4 w-4" /> Download &amp; Install
            </Button>
          )}
          {state.status === "error" && (
            <div className="mt-1 flex gap-2">
              <Button size="sm" variant="outline" onClick={install}>
                Retry
              </Button>
            </div>
          )}
        </div>
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update notice"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
