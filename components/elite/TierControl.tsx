"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updatePlayerFields } from "@/lib/elite/coach-actions";
import type { MembershipTier } from "@/lib/elite/types";
import { cn } from "@/lib/utils";

const OPTIONS: { value: MembershipTier; label: string; sub: string }[] = [
  { value: "elite", label: "Strive Elite", sub: "The app" },
  { value: "complete", label: "Complete Pathway", sub: "App + film + calls" },
];

// Which offer this player is on. Complete unlocks Film Room, the monthly
// breakdown, the weekly parent report, and the coaching-calls card.
export function TierControl({
  playerId,
  initial,
}: {
  playerId: string;
  initial: MembershipTier;
}) {
  const [tier, setTier] = useState<MembershipTier>(initial);
  const [pending, start] = useTransition();

  function set(value: MembershipTier) {
    if (value === tier) return;
    const prev = tier;
    setTier(value);
    start(async () => {
      const res = await updatePlayerFields(playerId, { tier: value });
      if (!res.ok) setTier(prev);
    });
  }

  return (
    <div className="elite-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Offer
        </div>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => set(o.value)}
            className={cn(
              "rounded-xl border px-2 py-2 text-left transition-all",
              tier === o.value
                ? "border-accent/40 bg-accent/[0.08] text-accent"
                : "border-white/10 bg-white/[0.02] text-white/45 hover:border-white/20"
            )}
          >
            <div className="text-sm font-medium">{o.label}</div>
            <div className="text-[11px] opacity-70">{o.sub}</div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-white/35">
        Complete unlocks film review, the weekly parent report, and coaching calls.
      </p>
    </div>
  );
}
