"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PropertyDeepDive } from "@/components/properties/property-deep-dive";

// Static route (works with `output: export` for Tauri bundling). The property
// id comes from the query string — set by the "View analytics" link on the
// properties page — so there are no dynamic URL segments to pre-render.
function DeepDiveInner() {
  const params = useSearchParams();
  const id = params.get("id") || "";
  if (!id) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Select a property from the Properties page to view its analytics.
      </p>
    );
  }
  return <PropertyDeepDive id={id} />;
}

export default function PropertyDetailPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>}>
      <DeepDiveInner />
    </Suspense>
  );
}
