"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Play } from "lucide-react";
import type { Homework } from "@/lib/elite/types";
import {
  groupSessions,
  isDone,
  sessionName,
  sessionProgress,
  type SessionGroup,
} from "@/lib/elite/session-flow";
import { sessionsWord } from "@/lib/elite/training";
import { SessionPlayer } from "./SessionPlayer";
import { SessionRows, WeekBar, liveMinutes, useDrillState } from "./SessionRows";
import { cn } from "@/lib/utils";

// The player's whole week: one card per session (four In-Season, six
// Off-Season, plus any Extra Work). The session to do next is open with a
// Start button; finished ones fold away under a gold tick; any of them
// opens with a tap. Start opens the session full screen, one drill at a
// time (SessionPlayer). Earlier weeks collapse underneath. When the whole
// week is done the player is told the next one is on its way, never a
// false "new week ready".
export function WeekList({
  items,
  currentWeek,
  showPast = true,
  playerId,
  firstName = "",
  totalMinutes = 0,
  example = false,
}: {
  items: Homework[];
  currentWeek: number;
  showPast?: boolean;
  playerId?: string; // set on the player's own view: enables Send a clip (036)
  firstName?: string;
  totalMinutes?: number; // all time, as the server last counted it
  example?: boolean; // the example player
}) {
  const router = useRouter();
  const { done, toggle } = useDrillState();
  const [open, setOpen] = useState<{ group: SessionGroup; index: number } | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const weeks = useMemo(() => {
    const by = new Map<number, Homework[]>();
    for (const h of items) by.set(h.week, [...(by.get(h.week) ?? []), h]);
    return [...by.entries()]
      .map(([week, list]) => ({ week, list }))
      .sort((a, b) => b.week - a.week);
  }, [items]);

  const close = useCallback(() => {
    setOpen(null);
    router.refresh();
  }, [router]);

  if (!items.length) {
    return (
      <div className="elite-card p-8 text-center text-white/60">
        No drills yet. Your coach is building your week. It lands here the moment it is ready.
      </div>
    );
  }

  const topWeek = weeks.find((w) => w.week === currentWeek) ?? weeks[0];
  const past = weeks.filter((w) => w.week !== topWeek.week);
  const sessions = groupSessions(topWeek.list);
  const nextUp = sessions.find((s) => s.list.some((h) => !isDone(h, done)));
  const sessionsDone = sessions.filter((s) => s.list.every((h) => isDone(h, done))).length;
  const allDone = sessionsDone === sessions.length;
  const allTime = liveMinutes(totalMinutes, topWeek.list, done);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
          <span>Week {topWeek.week}</span>
          <span className="tabular-nums">
            {sessionsDone}/{sessions.length} sessions
          </span>
        </div>
        <div className="mt-2.5">
          <WeekBar sessions={sessions} done={done} />
        </div>
      </div>

      {allDone && (
        <div className="flex items-start gap-3 rounded-3xl border border-accent/30 bg-accent/[0.07] p-5">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-black">
            <Check className="h-3.5 w-3.5" strokeWidth={4} />
          </span>
          <div>
            <div className="font-display text-xl font-black uppercase leading-none">
              Week complete
            </div>
            <p className="mt-1.5 text-[15px] text-white/75">
              All {sessionsWord(sessions.length)} sessions done. Your next week is on its way.
            </p>
          </div>
        </div>
      )}

      {sessions.map((s) => {
        const p = sessionProgress(s.list, done);
        const isNext = nextUp?.n === s.n;
        const isOpen = expanded[s.n] ?? isNext;
        return (
          <section
            key={s.n}
            className={cn(
              "overflow-hidden rounded-3xl border bg-white/[0.03]",
              isNext ? "border-white/15" : "border-white/[0.08]"
            )}
          >
            <button
              onClick={() => setExpanded((e) => ({ ...e, [s.n]: !isOpen }))}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-lg font-black",
                  p.complete ? "bg-accent text-black" : "bg-white/[0.08] text-bone"
                )}
              >
                {p.complete ? <Check className="h-4.5 w-4.5" strokeWidth={3.5} /> : s.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl font-black uppercase leading-none">
                  {sessionName(s)}
                </span>
                <span className="mt-1 block text-xs text-white/55">
                  {p.complete
                    ? `Done · ${p.minutesTotal} min`
                    : `${p.done}/${p.total} drills · about ${p.minutesTotal} min`}
                </span>
              </span>
              <ChevronDown
                className={cn("h-5 w-5 shrink-0 text-white/50 transition-transform", isOpen && "rotate-180")}
              />
            </button>

            {isOpen && (
              <>
                <div className="border-t border-white/[0.06] px-1.5">
                  <SessionRows
                    drills={s.list}
                    done={done}
                    onToggle={toggle}
                    onOpen={(index) => setOpen({ group: s, index })}
                  />
                </div>
                {!p.complete && (
                  <div className="p-4 pt-3">
                    <button
                      onClick={() => setOpen({ group: s, index: Math.max(0, p.nextIndex) })}
                      className={cn(
                        "flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl font-display text-xl font-black uppercase tracking-wide transition-transform active:scale-[0.98]",
                        isNext ? "bg-white text-black" : "border border-white/15 text-bone"
                      )}
                    >
                      <Play className="h-5 w-5" fill="currentColor" />
                      {p.done > 0 ? "Continue session" : "Start session"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}

      {showPast && past.map((w) => <PastWeek key={w.week} week={w.week} list={w.list} />)}

      {open && (
        <SessionPlayer
          drills={open.group.list}
          done={done}
          onToggle={toggle}
          startIndex={open.index}
          title={sessionName(open.group)}
          weekLabel={`Week ${topWeek.week}`}
          firstName={firstName}
          minutesBefore={allTime - sessionProgress(open.group.list, done).minutesDone}
          sessionsLeftAfter={
            sessions.filter((s) => s.n !== open.group.n && s.list.some((h) => !isDone(h, done))).length
          }
          sessionsTotal={sessions.length}
          playerId={playerId}
          example={example}
          onClose={close}
        />
      )}
    </div>
  );
}

function PastWeek({ week, list }: { week: number; list: Homework[] }) {
  const [open, setOpen] = useState(false);
  const done = list.filter((h) => h.completed).length;
  const ordered = [...list].sort(
    (a, b) => (a.session ?? 1) - (b.session ?? 1) || a.sort - b.sort
  );
  return (
    <div className="elite-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <span className="text-[15px] font-medium text-white/80">Week {week}</span>
        <span className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-white/55">
            {done}/{list.length} done
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-white/50 transition-transform", open && "rotate-180")}
          />
        </span>
      </button>
      {open && (
        <ul className="space-y-2 border-t border-white/6 p-4">
          {ordered.map((h) => (
            <li key={h.id} className="flex items-center gap-2.5 text-sm text-white/70">
              <Check
                className={cn("h-4 w-4 shrink-0", h.completed ? "text-accent" : "text-white/50")}
                strokeWidth={3}
              />
              <span className="min-w-0 flex-1 truncate">{h.title}</span>
              <span className="shrink-0 text-xs text-white/50">{h.reps}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
