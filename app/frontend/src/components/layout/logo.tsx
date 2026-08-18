"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The official HostWise logo — a white rounded tile with the two gradient
 * house loops and the window / checklist / chart glyphs. Used across the
 * sidebar, the mobile header, the welcome wizard and anywhere the brand mark
 * appears in the UI.
 */
export function Logo({
  className,
  size = 28,
  rounded = "rounded-xl",
}: {
  className?: string;
  size?: number;
  rounded?: string;
}) {
  return (
    <Image
      src="/logo-1024.png"
      alt="HostWise"
      width={1024}
      height={1024}
      className={cn("shrink-0 object-contain", rounded, className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
