"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  PartyPopper,
  PlayCircle,
  StickyNote,
} from "lucide-react";
import type { Homework } from "@/lib/elite/types";
import { toggleHomework } from "@/lib/elite/player-actions";
import { cn } from "@/lib/utils";

const DEFAULT_MIN = 15;

function isPlyo(title: string): boolean {
  return /plyo|warm-?up/i.test(title);
}

// The player's weekly loop: the current week broken into its four sessions,
// each starting with a plyometric warm-up (badged). A red "Next up" marks
// the first incomplete drill. Earlier weeks collapse. When the whole week is
// done, the player is told the next week drops at the weekend — no false
// "new week ready" until the coach actually builds it.
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
      .map(([week, list]) => ({ week, list }))
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
        No drills assigned yet. Your coach builds your week — it lands here soon.
      </div>
    );
  }

  const topWeek = weeks.find((w) => w.week === currentWeek) ?? weeks[0];
  const past = weeks.filter((w) => w.week !== topWeek.week);

  // group the current week into sessions
  const sessionMap = new Map<number, Homework[]>();
  for (const h of topWeek.list) {
    const s = h.session ?? 1;
    const arr = sessionMap.get(s) ?? [];
    arr.push(h);
    sessionMap.set(s, arr);
  }
  const sessions = [...sessionMap.entries()]
    .map(([session, list]) => ({
      session,
      list: [...list].sort((a, b) => a.sort - b.sort),
    }))
    .sort((a, b) => a.session - b.session);

  // "Next up" = first incomplete drill across sessions in order
  let nextUpId: string | null = null;
  for (const s of sessions) {
    const hit = s.list.find((h) => !state[h.id]);
    if (hit) {
      nextUpId = hit.id;
      break;
    }
  }

  const sessionsDone = sessions.filter((s) =>
    s.list.every((h) => state[h.id])
  ).length;
  const allDone = sessionsDone === sessions.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          This week · Week {topWeek.week}
        </span>
        <span className="text-xs text-white/45">
          {sessionsDone}/{sessions.length} sessions done
        </span>
      </div>

      {allDone && (
        <div className="flex items-start gap-3 rounded-3xl border border-accent/25 bg-accent/[0.06] p-5">
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <div className="font-display text-lg font-bold uppercase tracking-tight">
              Week complete
            </div>
            <p className="mt-1 text-sm text-white/60">
              All four sessions done — real work. Rest and recover; your coach
              drops next week&apos;s plan over the weekend.
            </p>
          </div>
        </div>
      )}

      {sessions.map((s) => {
        const done = s.list.filter((h) => state[h.id]).length;
        return (
          <div key={s.session}>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-tight">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent/15 text-accent">
                  {s.session}
                </span>
                Session {s.session}
              </span>
              <span className="text-xs text-white/40">
                {done}/{s.list.length}
              </span>
            </div>
            <ul className="space-y-2.5">
              {s.list.map((h) => (
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
        );
      })}

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
  const plyo = isPlyo(hw.title);
  return (
    <li
      className={cn(
        "elite-card flex gap-4 p-4 transition-colors",
        done && "border-accent/20 bg-accent/[0.03]",
        nextUp && !done && "border-red-500/40 bg-red-500/[0.04]",
        plyo && !done && !nextUp && "border-red-500/20"
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
          <div className="flex flex-wrap items-center gap-2">
            {nextUp && !done && (
              <span className="rounded-full bg-red-500/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white">
                Next up
              </span>
            )}
            {plyo && (
              <span className="rounded-full border border-red-500/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-red-300">
                Plyo warm-up
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
  const ordered = [...list].sort(
    (a, b) => (a.session ?? 1) - (b.session ?? 1) || a.sort - b.sort
  );
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
          {ordered.map((h) => (
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
