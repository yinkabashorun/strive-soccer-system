"use client";

import { useEffect, useState } from "react";

// Fires once per success page load. Posts the Stripe sessionId to
// /api/ghl/dribbling-course-buyer so the buyer gets tagged in GHL +
// the sale lands in Supabase even without a Stripe webhook configured.
//
// Idempotent: re-firing with the same sessionId is safe (the route
// upserts on stripe_session_id).
export function PostPurchaseTagger({ sessionId }: { sessionId: string | null }) {
  const [status, setStatus] = useState<"idle" | "ok" | "skipped" | "error">(
    sessionId ? "idle" : "skipped",
  );

  useEffect(() => {
    if (!sessionId) return;
    const key = `strive_tagged_${sessionId}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(key)) {
      setStatus("ok");
      return;
    }
    fetch("/api/ghl/dribbling-course-buyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      keepalive: true,
    })
      .then((r) => {
        if (r.ok) {
          sessionStorage.setItem(key, "1");
          setStatus("ok");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [sessionId]);

  // Hidden until something goes wrong — buyers don't need to see "ok".
  if (status === "ok" || status === "idle" || status === "skipped") return null;
  return (
    <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-300">
      Your payment went through — but we couldn't auto-deliver your access.
      Email <a className="underline" href="mailto:coach@strivesoccer.com">coach@strivesoccer.com</a> with this order and we'll send it manually.
    </div>
  );
}
