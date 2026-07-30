"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/auth-context";
import { BackendProvider } from "@/contexts/backend-context";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

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
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <BackendProvider>
          <AuthProvider>{children}</AuthProvider>
        </BackendProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
