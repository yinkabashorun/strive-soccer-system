"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "redirecting" }
  | { kind: "error"; message: string };

// Primary CTA on /dribbling-course. POSTs to /api/checkout/dribbling-course
// and redirects to the Stripe-hosted checkout. No lead capture modal in the
// way — Stripe collects the email itself, and the success page fires the
// GHL buyer tag.
export function DribblingCheckoutButton({
  label = "Get Instant Access — $97 →",
  size = "lg",
  block = false,
}: {
  label?: string;
  size?: "md" | "lg";
  block?: boolean;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function go() {
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/checkout/dribbling-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        setStatus({
          kind: "error",
          message: data?.error || `Checkout failed (${res.status})`,
        });
        return;
      }
      setStatus({ kind: "redirecting" });
      window.location.href = data.url;
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "request_failed",
      });
    }
  }

  const busy = status.kind === "submitting" || status.kind === "redirecting";

  return (
    <div className={cn(block && "w-full")}>
      <button
        onClick={go}
        disabled={busy}
        className={cn(
          "btn-accent font-semibold disabled:opacity-70",
          size === "lg" ? "h-12 px-6 text-base md:h-14 md:px-8 md:text-lg" : "",
          block && "w-full",
        )}
      >
        {busy ? (
          <>
            <Loader2 className={cn("h-4 w-4 animate-spin", size === "lg" && "h-5 w-5")} />
            Opening secure checkout…
          </>
        ) : (
          label
        )}
      </button>
      {status.kind === "error" && (
        <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/[0.05] px-3 py-2 text-[11px] text-red-300">
          {status.message}. If this persists, email coach@strivesoccer.com.
        </div>
      )}
      <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted">
        <ShieldCheck className="h-3 w-3" />
        Stripe-secured · 14-day refund
      </div>
    </div>
  );
}
