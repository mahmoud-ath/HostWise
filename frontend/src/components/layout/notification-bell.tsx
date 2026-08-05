"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  Info,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  useClearNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useNotificationsSummary,
  useRefreshNotifications,
  type AppNotification,
} from "@/hooks/use-api";

const SEVERITY_STYLES: Record<string, { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: "text-blue-500" },
  success: { icon: CheckCircle2, cls: "text-emerald-500" },
  warning: { icon: AlertTriangle, cls: "text-amber-500" },
  error: { icon: XCircle, cls: "text-red-500" },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: summary } = useNotificationsSummary();
  const { data: list } = useNotifications();
  const refresh = useRefreshNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const clear = useClearNotifications();
  const [refreshedOnce, setRefreshedOnce] = useState(false);

  // Compute fresh notifications once on app load (the local "scheduler tick").
  useEffect(() => {
    if (refreshedOnce) return;
    setRefreshedOnce(true);
    refresh.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshedOnce]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = summary?.unread ?? 0;
  const notifications: AppNotification[] = list?.notifications ?? [];

  return (
    <div ref={ref} className="fixed end-4 top-4 z-40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-12 w-80 overflow-hidden rounded-xl border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex items-center gap-0.5">
              <button
                title="Refresh"
                onClick={() => refresh.mutate()}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? "animate-spin" : ""}`} />
              </button>
              <button
                title="Mark all read"
                onClick={() => markAll.mutate()}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
              <button
                title="Clear all"
                onClick={() => { if (confirm("Clear all notifications?")) clear.mutate(); }}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet — add some data and hit refresh.
              </p>
            ) : (
              notifications.map((n) => {
                const sev = SEVERITY_STYLES[n.severity] ?? SEVERITY_STYLES.info;
                const Icon = sev.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => { if (!n.is_read) markRead.mutate(n.id); }}
                    className={`flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-start hover:bg-muted/50 ${n.is_read ? "opacity-60" : ""}`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${sev.cls}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-tight">{n.title}</span>
                      <span className="block text-xs leading-snug text-muted-foreground">{n.message}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                  </button>
                );
              })
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t px-3 py-1.5">
              <button
                onClick={() => markAll.mutate()}
                className="flex w-full items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Check className="h-3.5 w-3.5" /> Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
