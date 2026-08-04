"use client";

import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  color = "bg-primary",
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value || 0));
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
