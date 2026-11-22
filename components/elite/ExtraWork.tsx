"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Loader2, Plus } from "lucide-react";
import { addExtraSession } from "@/lib/elite/extra-actions";
import { EXTRA_SHELVES, type ExtraShelf } from "@/lib/elite/bank-conform";
import { ExtraPicker } from "./ExtraPicker";
import { cn } from "@/lib/utils";

// "Got more today?" Two ways to add an Extra Work session, both landing as
// the next session of this week and opening straight into it:
//   - Pick my own drills (ExtraPicker): the player ticks the drills
//   - a shelf: we build it (warm-up plus three drills they haven't done)
export function ExtraWork({ hasWall, blocked }: { hasWall: boolean; blocked?: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<ExtraShelf | null>(null);
  const [picking, setPicking] = useState(false);
  const router = useRouter();

  const shelves = (Object.keys(EXTRA_SHELVES) as ExtraShelf[]).filter(
    (s) => s !== "wall_work" || hasWall
  );

  // Straight into the new session on the Week tab.
  function landed(session: number | null) {
    if (session == null) {
      setNote("This is the example week, so nothing is added. On your own account the session opens right away.");
      return;
    }
    router.push(`/homework?start=${session}`);
  }

  function add(shelf: ExtraShelf) {
    setError(null);
    setNote(null);
    setPicked(shelf);
    start(async () => {
      const res = await addExtraSession(shelf);
      setPicked(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      landed(res.session);
    });
  }

  return (
    <section className="m-card p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
        <Plus className="h-3.5 w-3.5" /> Extra Work
      </div>
      <p className="mt-2 text-[15px] leading-snug text-white/75">
        Got more today? Pick the drills yourself, or tap an area and we build the session for you.
      </p>
      {blocked ? (
        <p className="mt-3 text-sm text-white/60">{blocked}</p>
      ) : (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setNote(null);
              setPicking(true);
            }}
            className="m-button press mt-4 disabled:opacity-60"
          >
            <ListChecks className="h-5 w-5" /> Pick my own drills
          </button>

          <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            Or build it for me
          </div>
          <p className="mt-1 text-[13px] text-white/55">A warm-up plus three drills you haven&apos;t done yet.</p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
            {shelves.map((s) => (
              <button
                key={s}
                type="button"
                disabled={pending}
                onClick={() => add(s)}
                className={cn(
                  "press min-h-[56px] rounded-2xl bg-fill-2 p-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] disabled:opacity-60",
                  picked === s && "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]"
                )}
              >
                <div className="m-head flex items-center justify-between text-[15px]">
                  {EXTRA_SHELVES[s].label}
                  {pending && picked === s && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}
                </div>
                <div className="mt-1 text-[13px] text-white/55">{EXTRA_SHELVES[s].blurb}</div>
              </button>
            ))}
          </div>
        </>
      )}
      {note && <p className="mt-3 text-sm text-white/60">{note}</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {picking && (
        <ExtraPicker
          onClose={() => setPicking(false)}
          onAdded={(session) => {
            setPicking(false);
            landed(session);
          }}
        />
      )}
    </section>
  );
}
