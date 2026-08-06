"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Kicks off a Stripe Checkout session for a Strive Elite plan. Falls back
// to the signup flow when Stripe isn't configured yet.
export function CheckoutButton({
  plan,
  label,
  variant = "accent",
  className,
}: {
  plan: "monthly" | "session" | "elite";
  label: string;
  variant?: "accent" | "outline";
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/elite/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      // Not configured — route to signup so the flow still completes.
      window.location.href = data.fallback || "/signup";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button
        onClick={go}
        disabled={loading}
        className={cn(
          "w-full px-6 py-3.5 text-base",
          variant === "accent" ? "btn-accent" : "btn",
          loading && "opacity-70"
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {label} <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
