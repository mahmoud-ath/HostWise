"use client";

import { useEffect, useState } from "react";
import { isTauriRuntime } from "@/lib/tauri";

/**
 * Whether the app is running inside the Tauri shell. Hydration-safe: returns
 * false on the server and first client render, then flips once mounted, so
 * Next.js SSR/SSG output never differs from the browser.
 */
export function useIsTauri(): boolean {
  const [isTauri, setIsTauri] = useState(false);
  useEffect(() => {
    setIsTauri(isTauriRuntime());
  }, []);
  return isTauri;
}
