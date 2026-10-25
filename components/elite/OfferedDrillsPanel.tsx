"use client";

import { useState, useTransition } from "react";
import { ListChecks } from "lucide-react";
import { setOfferedDrills } from "@/lib/elite/coach-actions";
import type { Drill } from "@/lib/elite/types";
import { cn } from "@/lib/utils";

// Course drills offered per player (040). One switch, then a tick per
// opt-in bank drill. Off = the builder treats every course drill as
// absent for this player, picks kept. Takes effect on the next generated
// week, never on the week already built.
export function OfferedDrillsPanel({
  playerId,
  drills,
  initialOffer,
  initialIds,
}: {
  playerId: string;
  drills: Drill[]; // every opt_in drill in the bank, coach's order
  initialOffer: boolean;
  initialIds: string[];
}) {
  const [offer, setOffer] = useState(initialOffer);
  const [ids, setIds] = useState<Set<string>>(new Set(initialIds));
  const [pending, start] = useTransition();

  if (drills.length === 0) return null;

  const allJuggling = drills.every((d) => /^juggling:/i.test(d.title));
  const heading = allJuggling ? "Juggling drills" : "Course drills";
  const strip = (t: string) => t.replace(/^juggling:\s*/i, "");

  const toggle = (id: string) => {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setIds(next);
    start(() => {
      setOfferedDrills(playerId, { opt_in_drill_ids: Array.from(next) });
    });
  };

  return (
    <div className={cn("elite-card p-5", pending && "opacity-70")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          <ListChecks className="h-3.5 w-3.5" /> {heading}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={offer}
          onClick={() => {
            const next = !offer;
            setOffer(next);
            start(() => {
              setOfferedDrills(playerId, { offer_opt_in: next });
            });
          }}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
            offer
              ? "border-accent/60 bg-accent/15 text-accent"
              : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/70"
          )}
        >
          {offer ? "Offered in the week" : "Not offered"}
        </button>
      </div>
      <p className="mb-3 text-xs text-white/40">
        {offer
          ? "The next week can use the ticked drills for this player."
          : "Switch on, then tick the drills the next week may use."}
      </p>
      <ul className={cn("space-y-1.5", !offer && "opacity-50")}>
        {drills.map((d) => (
          <li key={d.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-sm text-white/75">
              <input
                type="checkbox"
                checked={ids.has(d.id)}
                onChange={() => toggle(d.id)}
                className="h-4 w-4 accent-accent"
              />
              <span className="min-w-0 flex-1 truncate">{strip(d.title)}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
