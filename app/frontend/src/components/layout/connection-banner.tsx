"use client";

import { useBackend } from "@/contexts/backend-context";
import { AlertTriangle, RefreshCw, ServerCrash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConnectionBanner() {
  const { status, isReady, restartBackend, error } = useBackend();

  // Don't show anything when healthy or starting (starting is the initial state)
  if (isReady || status === "starting") return null;

  const config: Record<
    string,
    {
      bg: string;
      text: string;
      icon: React.ReactNode;
      message: string;
      showRestart: boolean;
    }
  > = {
    unreachable: {
      bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
      text: "text-amber-800 dark:text-amber-200",
      icon: <AlertTriangle className="h-4 w-4" />,
      message: "Backend connection lost. Trying to reconnect...",
      showRestart: true,
    },
    crashed: {
      bg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
      text: "text-red-800 dark:text-red-200",
      icon: <ServerCrash className="h-4 w-4" />,
      message: "Backend process crashed unexpectedly.",
      showRestart: true,
    },
    restarting: {
      bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
      text: "text-blue-800 dark:text-blue-200",
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      message: "Restarting backend...",
      showRestart: false,
    },
    failed: {
      bg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
      text: "text-red-800 dark:text-red-200",
      icon: <ServerCrash className="h-4 w-4" />,
      message: "Backend failed to start.",
      showRestart: true,
    },
  };

  const c = config[status] || config.unreachable;

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 border-b ${c.bg} ${c.text} text-sm`}
    >
      <div className="flex items-center gap-2">
        {c.icon}
        <div>
          <span>{c.message}</span>
          {error && (
            <p className="text-xs opacity-80 mt-0.5 max-w-xl break-words">{error}</p>
          )}
        </div>
      </div>
      {c.showRestart && (
        <Button
          variant="outline"
          size="sm"
          onClick={restartBackend}
          className="h-7 text-xs gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          Restart Backend
        </Button>
      )}
    </div>
  );
}
