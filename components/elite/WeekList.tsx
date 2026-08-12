"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  PlayCircle,
  StickyNote,
} from "lucide-react";
import type { Homework } from "@/lib/elite/types";
import { toggleHomework } from "@/lib/elite/player-actions";
import { cn } from "@/lib/utils";

const DEFAULT_MIN = 15;

// The player's daily loop list: the current week is open with a red
// "Next up" highlight on the first incomplete drill; earlier weeks are
// collapsed. Per-item check-off flips completed/completed_at optimistically.
export function WeekList({
  items,
  currentWeek,
  showPast = true,
}: {
  items: Homework[];
  currentWeek: number;
  showPast?: boolean;
}) {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((h) => [h.id, h.completed]))
  );
  const [, start] = useTransition();

  const weeks = useMemo(() => {
    const by = new Map<number, Homework[]>();
    for (const h of items) {
      const arr = by.get(h.week) ?? [];
      arr.push(h);
      by.set(h.week, arr);
    }
    return [...by.entries()]
      .map(([week, list]) => ({
        week,
        list: [...list].sort((a, b) => a.sort - b.sort),
      }))
      .sort((a, b) => b.week - a.week);
  }, [items]);

  function toggle(id: string) {
    const next = !state[id];
    setState((s) => ({ ...s, [id]: next }));
    start(() => {
      toggleHomework(id, next);
    });
  }

  if (!items.length) {
    return (
      <div className="elite-card p-8 text-center text-white/45">
        No drills assigned yet. Your coach will set this week&apos;s plan soon.
      </div>
    );
  }

  const topWeek = weeks.find((w) => w.week === currentWeek) ?? weeks[0];
  const past = weeks.filter((w) => w.week !== topWeek.week);

  // first incomplete drill in the current week = "Next up"
  const nextUpId = topWeek.list.find((h) => !state[h.id])?.id ?? null;

  return (
    <div className="space-y-5">
      {/* Current week */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            This week · Week {topWeek.week}
          </span>
          <span className="text-xs text-white/45">
            {topWeek.list.filter((h) => state[h.id]).length}/
            {topWeek.list.length} done
          </span>
        </div>
        <ul className="space-y-3">
          {topWeek.list.map((h) => (
            <DrillRow
              key={h.id}
              hw={h}
              done={state[h.id]}
              nextUp={h.id === nextUpId}
              onToggle={() => toggle(h.id)}
            />
          ))}
        </ul>
      </div>

      {/* Past weeks, collapsed */}
      {showPast &&
        past.map((w) => (
          <PastWeek key={w.week} week={w.week} list={w.list} state={state} />
        ))}
    </div>
  );
}

function DrillRow({
  hw,
  done,
  nextUp,
  onToggle,
}: {
  hw: Homework;
  done: boolean;
  nextUp: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className={cn(
        "elite-card flex gap-4 p-4 transition-colors",
        done && "border-accent/20 bg-accent/[0.03]",
        nextUp && !done && "border-red-500/40 bg-red-500/[0.04]"
      )}
    >
      <button
        onClick={onToggle}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        className={cn(
          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all",
          done
            ? "border-accent bg-accent text-black"
            : "border-white/20 text-transparent hover:border-white/40"
        )}
      >
        <Check className="h-4 w-4" strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {nextUp && !done && (
              <span className="rounded-full bg-red-500/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white">
                Next up
              </span>
            )}
            <h4
              className={cn(
                "font-semibold leading-snug",
                done ? "text-white/50 line-through" : "text-bone"
              )}
            >
              {hw.title}
            </h4>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="chip whitespace-nowrap">{hw.reps}</span>
            <span className="chip flex items-center gap-1 whitespace-nowrap">
              <Clock className="h-3 w-3" />
              {hw.duration_min ?? DEFAULT_MIN}m
            </span>
          </div>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-white/55">
          {hw.exercise}
        </p>
        {hw.notes && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-white/45">
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {hw.notes}
          </p>
        )}
        {hw.video_url && (
          <a
            href={hw.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
          >
            <PlayCircle className="h-4 w-4" /> Watch reference
          </a>
        )}
      </div>
    </li>
  );
}

function PastWeek({
  week,
  list,
  state,
}: {
  week: number;
  list: Homework[];
  state: Record<string, boolean>;
}) {
  const [open, setOpen] = useState(false);
  const done = list.filter((h) => state[h.id]).length;
  return (
    <div className="elite-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <span className="text-sm font-medium text-white/70">Week {week}</span>
        <span className="flex items-center gap-3">
          <span className="text-xs text-white/40">
            {done}/{list.length} done
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-white/40 transition-transform",
              open && "rotate-180"
            )}
          />
        </span>
      </button>
      {open && (
        <ul className="space-y-1.5 border-t border-white/6 p-4">
          {list.map((h) => (
            <li
              key={h.id}
              className="flex items-center gap-2.5 text-sm text-white/60"
            >
              <Check
                className={cn(
                  "h-4 w-4 shrink-0",
                  state[h.id] ? "text-accent" : "text-white/20"
                )}
                strokeWidth={3}
              />
              <span className={state[h.id] ? "line-through" : ""}>
                {h.title}
              </span>
              <span className="ml-auto text-xs text-white/30">{h.reps}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
