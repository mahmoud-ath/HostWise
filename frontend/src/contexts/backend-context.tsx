"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type BackendStatus =
  | "starting"
  | "healthy"
  | "unreachable"
  | "crashed"
  | "restarting"
  | "failed";

interface BackendState {
  status: BackendStatus;
  error?: string;
}

interface BackendContextType {
  status: BackendStatus;
  error?: string;
  isReady: boolean;
  restartBackend: () => Promise<void>;
}

const BackendContext = createContext<BackendContextType | undefined>(undefined);

export function BackendProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BackendState>({
    status: "starting",
  });
  const queryClient = useQueryClient();

  // When the backend becomes reachable (e.g. after a slow first boot where the
  // embedded backend binds a moment after the webview loaded, or after a manual
  // restart), refetch everything so pages don't stay stuck on cached "Request
  // failed" errors until a manual reload.
  useEffect(() => {
    if (state.status === "healthy") {
      queryClient.invalidateQueries();
    }
  }, [state.status, queryClient]);

  // Listen for Tauri backend-status events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setupListener() {
      if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
        try {
          const { listen } = await import("@tauri-apps/api/event");
          unlisten = await listen<{ status: string; error?: string; code?: number; signal?: number }>(
            "backend-status",
            (event) => {
              const s = event.payload.status;
              setState({
                status: s as BackendStatus,
                error: event.payload.error,
              });

              if (s === "crashed") {
                console.warn(
                  `Backend crashed (code=${event.payload.code}, signal=${event.payload.signal})`
                );
              }
            }
          );
        } catch (err) {
          console.warn("Failed to listen for backend events (non-Tauri environment):", err);
          // In browser dev, assume backend is reachable at the fallback URL
          setState({ status: "healthy" });
        }
      } else {
        // Not in Tauri — assume backend is reachable (browser dev mode)
        setState({ status: "healthy" });
      }
    }

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Fallback health polling. The Rust shell is supposed to emit a
  // "backend-status" event once the backend is reachable, but if that event
  // never arrives (or arrives late) the app would stay on "Starting
  // HostWise..." forever. Poll /api/health directly so the screen clears as
  // soon as the backend is up, and surface "unreachable" after a grace period
  // instead of an endless spinner.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("__TAURI_INTERNALS__" in window)) return; // non-Tauri handled above
    const pollable =
      state.status === "starting" ||
      state.status === "restarting" ||
      state.status === "unreachable";
    if (!pollable) return;

    let cancelled = false;
    const startedAt = Date.now();
    const UNREACHABLE_AFTER_MS = 30_000;
    const POLL_MS = 1_500;

    const check = async () => {
      if (cancelled) return;
      try {
        const host = await api.getApiHost();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3_000);
        const res = await fetch(`${host}/api/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          setState({ status: "healthy" });
          return;
        }
        throw new Error(`health check HTTP ${res.status}`);
      } catch {
        if (cancelled) return;
        if (
          state.status === "starting" &&
          Date.now() - startedAt > UNREACHABLE_AFTER_MS
        ) {
          setState({ status: "unreachable" });
          return;
        }
        setTimeout(check, POLL_MS);
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [state.status]);

  const restartBackend = useCallback(async () => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        setState({ status: "restarting" });
        api.resetBaseUrl(); // the restarted backend may bind a different port
        await invoke("restart_backend");
        // Status will be updated by the event listener
      } catch (err) {
        setState({
          status: "failed",
          error: err instanceof Error ? err.message : "Failed to restart backend",
        });
      }
    }
  }, []);

  return (
    <BackendContext.Provider
      value={{
        status: state.status,
        error: state.error,
        isReady: state.status === "healthy",
        restartBackend,
      }}
    >
      {children}
    </BackendContext.Provider>
  );
}

export function useBackend() {
  const context = useContext(BackendContext);
  if (!context) {
    throw new Error("useBackend must be used within a BackendProvider");
  }
  return context;
}
