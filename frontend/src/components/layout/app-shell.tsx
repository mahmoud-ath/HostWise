"use client";

import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { ConnectionBanner } from "./connection-banner";
import { useAuth } from "@/contexts/auth-context";
import { useBackend } from "@/contexts/backend-context";
import { Button } from "@/components/ui/button";
import { Home, Loader2 } from "lucide-react";
import Link from "next/link";

export function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isReady: backendReady, status: backendStatus } = useBackend();

  // Show loading while auth is restoring session
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Not authenticated — show login/register pages
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // Backend not ready yet — show a waiting state
  if (!backendReady && backendStatus === "starting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Starting HostWise backend...</p>
      </div>
    );
  }

  return (
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
  );
}
