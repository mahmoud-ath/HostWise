"use client";

import { useEffect } from "react";

/**
 * Warns the user before leaving a page that has unsaved changes.
 *
 * Covers two paths:
 *  - Browser/tab close, refresh, and (desktop) webview close via `beforeunload`.
 *  - In-app navigation (Next.js <Link>, plain anchors, sidebar) by intercepting
 *    clicks on internal links while `active` is true.
 *
 * Usage: `useConfirmLeave(dirty)` — pass the dirty flag from your form state.
 */
export function useConfirmLeave(
  active: boolean,
  message = "You have unsaved changes. Leave without saving?"
) {
  useEffect(() => {
    if (!active) return;

    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);

    // Capture phase runs before Next.js Link's own click handler, so we can
    // cancel the navigation when the user chooses to stay.
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;
      const el = anchor as HTMLAnchorElement;
      const href = el.getAttribute("href") || "";
      if (el.target === "_blank") return;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("http")) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active, message]);
}
