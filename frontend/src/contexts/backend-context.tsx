"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

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
  isReady: boolean;
  restartBackend: () => Promise<void>;
}

const BackendContext = createContext<BackendContextType | undefined>(undefined);

export function BackendProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BackendState>({
    status: "starting",
  });

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

  const restartBackend = useCallback(async () => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        setState({ status: "restarting" });
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
