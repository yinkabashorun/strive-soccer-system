"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updatePlayerFields } from "@/lib/elite/coach-actions";
import type { MembershipTier } from "@/lib/elite/types";
import { LIFETIME_LABEL, LIFETIME_OFF_LINE, LIFETIME_ON_LINE } from "@/lib/elite/lifetime";
import { cn } from "@/lib/utils";

const OPTIONS: { value: MembershipTier; label: string; sub: string }[] = [
  { value: "elite", label: "Strive Elite", sub: "The app" },
  { value: "complete", label: "Complete Pathway", sub: "App + film + calls" },
  { value: "pro", label: "Strive Pro", sub: "Plan + courses, paid by card" },
];

// Which offer this player is on. Complete unlocks Film Room, the monthly
// breakdown, the weekly parent report, and the coaching-calls card. Strive
// Pro (074) is the weekly plan and the courses, none of the coach's own
// time (lib/elite/tiers.ts). Moving a family onto Pro does not start a
// card payment: Pro is paid at /pro, and its access follows Stripe.
export function TierControl({
  playerId,
  initial,
  lifetime: initialLifetime = false,
}: {
  playerId: string;
  initial: MembershipTier;
  lifetime?: boolean;
}) {
  const [tier, setTier] = useState<MembershipTier>(initial);
  const [lifetime, setLifetime] = useState(initialLifetime);
  const [pending, start] = useTransition();

  // Lifetime access (lib/elite/lifetime.ts): the app for life, never
  // charged. A promise to a family, so it is its own switch.
  function flipLifetime() {
    const next = !lifetime;
    setLifetime(next);
    start(async () => {
      const res = await updatePlayerFields(playerId, { lifetime_access: next });
      if (!res.ok) setLifetime(!next);
    });
  }

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
      <div className="grid grid-cols-3 gap-2">
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
        Complete unlocks film review, the weekly parent report, and coaching calls. Pro has no
        Film Room, coach chat, calls or clips.
      </p>
      <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/[0.07] pt-4">
        <div>
          <div className="text-sm font-medium text-bone">
            {LIFETIME_LABEL}: {lifetime ? "on" : "off"}
          </div>
          <div className="mt-0.5 text-xs text-white/45">{lifetime ? LIFETIME_ON_LINE : LIFETIME_OFF_LINE}</div>
        </div>
        <button
          type="button"
          onClick={flipLifetime}
          aria-pressed={lifetime}
          className={cn(
            "min-h-[44px] shrink-0 rounded-xl border px-4 text-sm font-medium transition-all",
            lifetime ? "border-accent/40 bg-accent/[0.08] text-accent" : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20"
          )}
        >
          {lifetime ? "Turn off" : "Turn on"}
        </button>
      </div>
    </div>
  );
}
