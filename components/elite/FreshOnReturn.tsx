"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { refreshHolds, shouldRefreshOnReturn } from "@/lib/elite/fresh";

// When the app comes back to the front after a minute or more away, the
// screen refreshes itself once, so a member never looks at an old week or
// misses a message that arrived while the phone was in a pocket. It never
// redraws under an open session or an upload (lib/elite/fresh.ts).
// Renders nothing.
export function FreshOnReturn() {
  const router = useRouter();

  useEffect(() => {
    let hiddenAt: number | null = null;
    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const hiddenForMs = hiddenAt === null ? null : Date.now() - hiddenAt;
      hiddenAt = null;
      if (shouldRefreshOnReturn({ hiddenForMs, holds: refreshHolds() })) router.refresh();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [router]);

  return null;
}
