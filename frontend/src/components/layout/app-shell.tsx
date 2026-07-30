"use client";

import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { ConnectionBanner } from "./connection-banner";
import { ErrorBoundary } from "./error-boundary";
import { WelcomeWizard } from "./welcome-wizard";
import { useAuth } from "@/contexts/auth-context";
import { useBackend } from "@/contexts/backend-context";
import { Button } from "@/components/ui/button";
import { Home, Loader2 } from "lucide-react";
import Link from "next/link";

export function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isReady: backendReady, status: backendStatus } = useBackend();

  // Show loading while auth is restoring session or backend is starting
  if (authLoading || (!backendReady && backendStatus === "starting")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">
          {backendStatus === "starting" ? "Starting HostWise..." : "Loading..."}
        </p>
      </div>
    );
  }

  // Not authenticated — the WelcomeWizard will handle first-time setup.
  // We still render the children (which includes the wizard).
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <ErrorBoundary>
      <WelcomeWizard />
      <div className="min-h-screen bg-background">
        <ConnectionBanner />
        <Sidebar />
      {/* Mobile header */}
      <div className="lg:hidden flex items-center h-14 px-4 border-b">
        <Link href="/" className="flex items-center">
          <Home className="h-5 w-5 text-primary mr-2" />
          <span className="font-bold">HostWise</span>
        </Link>
      </div>
      {/* Main content */}
      <main className="lg:pl-64">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
    </ErrorBoundary>
  );
}
