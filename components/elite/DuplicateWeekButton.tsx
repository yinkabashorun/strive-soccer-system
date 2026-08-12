"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { duplicateWeek } from "@/lib/elite/coach-actions";

// Coach utility: clone the current week's drills into the next week for the
// same player (fast progression). Uses the elite_duplicate_week RPC.
export function DuplicateWeekButton({
  playerId,
  currentWeek,
}: {
  playerId: string;
  currentWeek: number;
}) {
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await duplicateWeek({
        fromPlayerId: playerId,
        week: currentWeek,
        toPlayerId: playerId,
        toWeek: currentWeek + 1,
      });
      setDone(
        res.ok
          ? `Cloned ${res.cloned} drill${res.cloned === 1 ? "" : "s"} into week ${currentWeek + 1}`
          : "Couldn't duplicate the week."
      );
      setTimeout(() => setDone(null), 3000);
    });
  }

  return (
    <div className="elite-card p-5">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
        Reuse a week
      </div>
      <button onClick={run} disabled={pending} className="btn w-full px-4 py-2.5 text-sm">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        Clone week {currentWeek} → {currentWeek + 1}
      </button>
      {done && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-accent">
          <Check className="h-3.5 w-3.5" /> {done}
        </p>
      )}
    </div>
  );
}
