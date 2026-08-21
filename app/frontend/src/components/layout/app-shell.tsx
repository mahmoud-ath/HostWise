"use client";

import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { ConnectionBanner } from "./connection-banner";
import { ErrorBoundary } from "./error-boundary";
import { WelcomeWizard } from "./welcome-wizard";
import { NotificationBell } from "./notification-bell";
import { UpdateBanner } from "./update-banner";
import { useBackend } from "@/contexts/backend-context";
import { useIsTauri } from "@/hooks/use-tauri";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Logo } from "./logo";
import { TitleBar } from "./title-bar";

export function AppShell({ children }: { children: ReactNode }) {
  const { isReady: backendReady, status: backendStatus } = useBackend();
  const { t } = useI18n();
  const isTauri = useIsTauri();

  // Show loading while backend is starting (keep the titlebar so the user can
  // always move / minimize / close the frameless window, even if startup hangs).
  if (!backendReady && backendStatus === "starting") {
    return (
      <>
        <TitleBar />
        <div className="flex flex-col items-center justify-center min-h-screen gap-3 pt-9">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("app.starting")}</p>
        </div>
      </>
    );
  }

  return (
    <ErrorBoundary>
      <WelcomeWizard />
      <TitleBar />
      <div className={cn("min-h-screen bg-background", isTauri && "pt-9")}>
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
