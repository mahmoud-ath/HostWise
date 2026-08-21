"use client";

import { useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useIsTauri } from "@/hooks/use-tauri";

/**
 * Custom window titlebar for the frameless Tauri window (`decorations: false`
 * in tauri.conf.json). The empty strip is a native drag region
 * (`data-tauri-drag-region`) and the right-hand buttons drive the window via
 * the Tauri core window API. Renders nothing outside the Tauri shell, so the
 * plain-browser build (next dev / e2e) is unaffected.
 */
export function TitleBar() {
  const isTauri = useIsTauri();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    appWindow.isMaximized().then(setMaximized).catch(() => {});
    appWindow
      .onResized(() => {
        appWindow.isMaximized().then(setMaximized).catch(() => {});
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      unlisten?.();
    };
  }, [isTauri]);

  if (!isTauri) return null;

  const appWindow = getCurrentWindow();

  const controlBtn =
    "flex h-full w-11 cursor-pointer items-center justify-center text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground";
  const closeBtn =
    "flex h-full w-11 cursor-pointer items-center justify-center text-muted-foreground transition-colors duration-150 hover:bg-red-600 hover:text-white";

  return (
    <div
      data-tauri-drag-region
      className="fixed inset-x-0 top-0 z-[60] flex h-9 items-stretch border-b bg-card select-none"
    >
      <div
        data-tauri-drag-region
        className="flex flex-1 items-center gap-2 px-3 text-[13px] font-medium text-muted-foreground"
      >
        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
        HostWise
      </div>
      <div className="flex h-full items-stretch">
        <button
          type="button"
          aria-label="Minimize"
          onClick={() => appWindow.minimize()}
          className={controlBtn}
        >
          <Minus size={15} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={maximized ? "Restore" : "Maximize"}
          onClick={() => appWindow.toggleMaximize()}
          className={controlBtn}
        >
          {maximized ? (
            <Copy size={12} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Square size={12} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={() => appWindow.close()}
          className={closeBtn}
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
