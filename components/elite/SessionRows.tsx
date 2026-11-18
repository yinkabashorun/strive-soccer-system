"use client";

import { useCallback, useState, useTransition } from "react";
import { Check, ChevronRight } from "lucide-react";
import type { Homework } from "@/lib/elite/types";
import { toggleHomework } from "@/lib/elite/player-actions";
import {
  KIND_LABEL,
  drillKind,
  drillMinutes,
  drillName,
  isDone,
  type DoneMap,
  type SessionGroup,
} from "@/lib/elite/session-flow";
import { feel } from "@/lib/elite/native";
import { cn } from "@/lib/utils";

// The player's ticks, kept on the screen first and saved behind it, so a
// tap answers instantly. Shared by the home card and the week list.
export function useDrillState() {
  const [done, setDone] = useState<DoneMap>({});
  const [, start] = useTransition();

  const toggle = useCallback((id: string, next: boolean) => {
    setDone((s) => ({ ...s, [id]: next }));
    start(() => {
      void toggleHomework(id, next);
    });
  }, []);

  return { done, toggle };
}

// All-time minutes as the screen knows them right now: the server's total
// with this week's rows re-counted from the player's own ticks.
export function liveMinutes(totalMinutes: number, weekRows: Homework[], done: DoneMap): number {
  let total = totalMinutes;
  for (const h of weekRows) {
    const m = drillMinutes(h);
    if (h.completed) total -= m;
    if (isDone(h, done)) total += m;
  }
  return Math.max(0, total);
}

// The week at a glance: one bar per session, gold once every drill in it
// is done. Never pre-filled, never drained.
export function WeekBar({ sessions, done }: { sessions: SessionGroup[]; done: DoneMap }) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {sessions.map((s) => {
        const count = s.list.filter((h) => isDone(h, done)).length;
        const pct = s.list.length ? count / s.list.length : 0;
        return (
          <span key={s.n} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/12">
            <span
              className="block h-full origin-left rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.round(pct * 100)}%` }}
            />
          </span>
        );
      })}
    </div>
  );
}

// A session as a short list: a big tick, the drill's name, how many. The
// tick ticks; the row opens the drill full screen.
export function SessionRows({
  drills,
  done,
  onToggle,
  onOpen,
}: {
  drills: Homework[];
  done: DoneMap;
  onToggle: (id: string, next: boolean) => void;
  onOpen: (index: number) => void;
}) {
  return (
    <ul className="divide-y divide-white/[0.06]">
      {drills.map((d, i) => {
        const ticked = isDone(d, done);
        const kind = drillKind(d.title);
        return (
          <li key={d.id} className="flex items-center">
            <button
              onClick={() => {
                if (!ticked) feel("drill");
                onToggle(d.id, !ticked);
              }}
              aria-label={ticked ? `Untick ${drillName(d.title)}` : `Tick ${drillName(d.title)}`}
              aria-pressed={ticked}
              className="grid h-16 w-14 shrink-0 place-items-center"
            >
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full border-2 transition-colors duration-200",
                  ticked ? "border-accent bg-accent text-black" : "border-white/30 text-transparent"
                )}
              >
                <Check className={cn("h-4.5 w-4.5", ticked && "animate-check-pop")} strokeWidth={3.5} />
              </span>
            </button>
            <button
              onClick={() => onOpen(i)}
              className="flex min-w-0 flex-1 items-center gap-2 py-3 pr-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[15px] font-semibold leading-snug",
                    ticked ? "text-white/45" : "text-bone"
                  )}
                >
                  {drillName(d.title)}
                </span>
                <span className="mt-0.5 block text-xs text-white/55">
                  {kind !== "skill" && (
                    <span className={cn("font-semibold", kind === "finisher" ? "text-accent" : "text-white/75")}>
                      {KIND_LABEL[kind]}
                      {d.reps ? " · " : ""}
                    </span>
                  )}
                  {d.reps}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
