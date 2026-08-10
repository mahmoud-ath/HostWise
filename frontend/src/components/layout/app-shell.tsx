"use client";

import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { ConnectionBanner } from "./connection-banner";
import { ErrorBoundary } from "./error-boundary";
import { WelcomeWizard } from "./welcome-wizard";
import { NotificationBell } from "./notification-bell";
import { UpdateBanner } from "./update-banner";
import { useBackend } from "@/contexts/backend-context";
import { useI18n } from "@/lib/i18n";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Logo } from "./logo";

export function AppShell({ children }: { children: ReactNode }) {
  const { isReady: backendReady, status: backendStatus } = useBackend();
  const { t } = useI18n();

  // Show loading while backend is starting
  if (!backendReady && backendStatus === "starting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{t("app.starting")}</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <WelcomeWizard />
      <div className="min-h-screen bg-background">
        <ConnectionBanner />
        <NotificationBell />
        <UpdateBanner />
        <Sidebar />
        <div className="lg:hidden flex items-center h-14 px-4 border-b gap-2">
          <Link href="/" className="flex items-center">
            <Logo size={26} />
            <span className="font-bold">HostWise</span>
          </Link>
        </div>
        <main className="lg:ps-64">
          <div className="p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
