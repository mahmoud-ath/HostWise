"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/auth-context";
import { BackendProvider } from "@/contexts/backend-context";
import { SettingsProvider } from "@/contexts/settings-context";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { initLogging, logError } from "@/lib/logger";

function logQueryError(error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error ?? "Unknown error"));
  // Log the request URL if the fetch failed (no bodies/headers — no secrets).
  const url =
    error && typeof error === "object" && "config" in error
      ? ((error as { config?: { url?: string } }).config?.url ?? undefined)
      : undefined;
  logError(`API request failed: ${err.message}`, url);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            refetchOnMount: true,
            refetchOnWindowFocus: true,
            retry: 1,
          },
          mutations: {
            onError: logQueryError,
          },
        },
      })
  );

  useEffect(() => {
    initLogging();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <SettingsProvider>
          <BackendProvider>
            <AuthProvider>{children}</AuthProvider>
          </BackendProvider>
        </SettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
