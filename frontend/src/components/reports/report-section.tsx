"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Reusable wrapper for report sections — consistent header + body.
 * Uses `print:break-inside-avoid` so each section stays intact in PDFs.
 */
export function ReportSection({
  title,
  icon,
  description,
  action,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("print:break-inside-avoid", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 pt-5">
        <div className="flex items-center gap-2.5">
          {icon && <div className="text-primary">{icon}</div>}
          <div>
            <CardTitle className="text-lg leading-tight">{title}</CardTitle>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
