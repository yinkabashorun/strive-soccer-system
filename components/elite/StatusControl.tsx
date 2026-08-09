"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updatePlayerFields } from "@/lib/elite/coach-actions";
import { cn } from "@/lib/utils";

const OPTIONS: { value: string; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trial" },
  { value: "canceled", label: "Paused" },
];

// Coach control to activate / pause a client's membership. Pausing removes
// their access to the program until reactivated.
export function StatusControl({
  playerId,
  initial,
}: {
  playerId: string;
  initial: string;
}) {
  const [status, setStatus] = useState(initial);
  const [pending, start] = useTransition();

  function set(value: string) {
    if (value === status) return;
    const prev = status;
    setStatus(value);
    start(async () => {
      const res = await updatePlayerFields(playerId, {
        subscription_status: value,
      });
      if (!res.ok) setStatus(prev);
    });
  }

  return (
    <div className="elite-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Membership
        </div>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => set(o.value)}
            className={cn(
              "rounded-xl border px-2 py-2 text-sm font-medium transition-all",
              status === o.value
                ? o.value === "canceled"
                  ? "border-white/20 bg-white/[0.06] text-white/70"
                  : "border-accent/40 bg-accent/[0.08] text-accent"
                : "border-white/10 bg-white/[0.02] text-white/45 hover:border-white/20"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-white/35">
        Pausing removes this client&apos;s access until reactivated.
      </p>
    </div>
  );
}
