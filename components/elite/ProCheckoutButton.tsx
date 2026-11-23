"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Opens the Strive Pro card checkout (074) for the signed-in Pro member.
// The server decides who it is for (the session) and what it costs
// (lib/elite/pro.ts); this button only asks for the address and goes
// there. Stripe's page is another site, so it opens in the same view.
export async function openProCheckout(): Promise<{ error: string | null }> {
  try {
    const res = await fetch("/api/elite/pro/checkout", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; next?: string };
    if (data.url) {
      window.location.assign(data.url);
      return { error: null };
    }
    if (data.next) {
      window.location.assign(data.next);
      return { error: null };
    }
    return { error: data.error ?? "We couldn't open the checkout. Please try again." };
  } catch {
    return { error: "We couldn't reach the server. Check your connection and try again." };
  }
}

export function ProCheckoutButton({
  label = "Start Strive Pro",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const { error } = await openProCheckout();
    if (error) {
      setError(error);
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-stretch", className)}>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        aria-label={busy ? "Opening the checkout" : undefined}
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-70"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : label}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
