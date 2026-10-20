"use client";

import { useEffect, useRef } from "react";
import { errorReport } from "./app-errors";

// Shared by app/error.tsx and app/global-error.tsx: post the error to
// /api/elite/errors once per error instance (React strict mode runs
// effects twice; the ref makes that one report). keepalive lets the
// request finish even if the visitor taps away immediately.
export function useReportError(error: Error & { digest?: string }) {
  const reported = useRef<unknown>(null);
  useEffect(() => {
    if (!error || reported.current === error) return;
    reported.current = error;
    const report = errorReport(error, window.location.href);
    fetch("/api/elite/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);
}
