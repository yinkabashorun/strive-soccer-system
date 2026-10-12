"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { addExtraSession } from "@/lib/elite/extra-actions";
import { EXTRA_SHELVES, type ExtraShelf } from "@/lib/elite/bank-conform";
import { cn } from "@/lib/utils";

// "Got more today?" - the player adds an Extra Work session from one of
// three shelves. Server composes it from the filmed bank (never a drill
// they've done), it appears as the next session of this week.
export function ExtraWork({ hasWall, blocked }: { hasWall: boolean; blocked?: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<ExtraShelf | null>(null);
  const router = useRouter();

  const shelves = (Object.keys(EXTRA_SHELVES) as ExtraShelf[]).filter(
    (s) => s !== "wall_work" || hasWall
  );

  function add(shelf: ExtraShelf) {
    setError(null);
    setPicked(shelf);
    start(async () => {
      const res = await addExtraSession(shelf);
      if (!res.ok) {
        setError(res.error);
        setPicked(null);
        return;
      }
      router.refresh();
      setPicked(null);
    });
  }

  return (
    <section className="elite-card p-5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
        <Plus className="h-3.5 w-3.5" /> Extra Work
      </div>
      <p className="mt-2 text-sm text-white/60">
        Got more today? Add a session: warm-up plus three drills you haven&apos;t done yet.
      </p>
      {blocked ? (
        <p className="mt-3 text-sm text-white/40">{blocked}</p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {shelves.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => add(s)}
              className={cn(
                "rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-accent/40 disabled:opacity-60",
                picked === s && "border-accent/60"
              )}
            >
              <div className="flex items-center justify-between font-display text-sm font-bold uppercase">
                {EXTRA_SHELVES[s].label}
                {pending && picked === s && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
              </div>
              <div className="mt-1 text-xs text-white/45">{EXTRA_SHELVES[s].blurb}</div>
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </section>
  );
}
