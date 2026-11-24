"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Play } from "lucide-react";
import { sessionHeadline, sessionImage } from "@/lib/elite/experience";
import { creditedMinutes, fmtDuration } from "@/lib/elite/time-trained";
import type { Homework } from "@/lib/elite/types";
import {
  groupSessions,
  isDone,
  planSessionCount,
  planSessionsLeft,
  sessionName,
  sessionProgress,
  type SessionGroup,
} from "@/lib/elite/session-flow";
import { sessionsWord } from "@/lib/elite/training";
import { SessionPlayer, type Origin } from "./SessionPlayer";
import { liveMinutes, useDrillState } from "./SessionRows";
import { cn } from "@/lib/utils";

// The player's whole week (approved mock v4, Nov 20 2026): a bar per
// session that fills gold as each is done, then one photo card per session
// (four In-Season, six Off-Season, plus any Extra Work): a gold tick on a
// finished one, a white ring and a play button on the one up next. Any
// card opens its session full screen, one drill at a time (SessionPlayer),
// growing out of the card. Earlier weeks collapse underneath. When the
// whole week is done the player is told the next one is on its way, never
// a false "new week ready".
export function WeekList({
  items,
  currentWeek,
  showPast = true,
  playerId,
  sendClips = true,
  firstName = "",
  totalMinutes = 0,
  example = false,
  startSession,
}: {
  items: Homework[];
  currentWeek: number;
  showPast?: boolean;
  playerId?: string; // set on the player's own view: enables Send a clip (036)
  sendClips?: boolean; // false for an offer without Send a clip (lib/elite/tiers.ts)
  firstName?: string;
  totalMinutes?: number; // all time, as the server last counted it
  example?: boolean; // the example player
  // A session to open straight away (/homework?start=N): the Extra Work
  // session the player just added. Opened once, then the address is
  // cleaned so a reload or the back button does not open it again.
  startSession?: number | null;
}) {
  const router = useRouter();
  const { done, toggle, trained } = useDrillState();
  const [open, setOpen] = useState<{ group: SessionGroup; index: number; origin: Origin | null } | null>(null);

  const weeks = useMemo(() => {
    const by = new Map<number, Homework[]>();
    for (const h of items) by.set(h.week, [...(by.get(h.week) ?? []), h]);
    return [...by.entries()]
      .map(([week, list]) => ({ week, list }))
      .sort((a, b) => b.week - a.week);
  }, [items]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current || !startSession) return;
    started.current = true;
    router.replace("/homework", { scroll: false });
    const group = groupSessions(items.filter((h) => h.week === currentWeek)).find((g) => g.n === startSession);
    if (!group) return;
    const p = sessionProgress(group.list, {});
    if (p.complete) return;
    setOpen({ group, index: Math.max(0, p.nextIndex), origin: null });
  }, [startSession, items, currentWeek, router]);

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
  const allTime = liveMinutes(totalMinutes, topWeek.list, done, trained);

  const regular = sessions.filter((s) => !s.extra);
  const position = (g: SessionGroup) => regular.findIndex((s) => s.n === g.n) + 1;

  function openSession(s: SessionGroup, el: HTMLElement) {
    const p = sessionProgress(s.list, done);
    const r = el.getBoundingClientRect();
    setOpen({
      group: s,
      index: p.complete ? 0 : Math.max(0, p.nextIndex),
      origin: { top: r.top, left: r.left, width: r.width, height: r.height },
    });
  }

  return (
    <div className="space-y-4">
      {/* One bar per session: metal once it is done. Never drained. */}
      <div className="flex gap-1.5" aria-label={`${sessionsDone} of ${sessions.length} sessions done this week`}>
        {sessions.map((s) => (
          <span
            key={s.n}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              s.list.every((h) => isDone(h, done)) ? "bg-metal" : "bg-fill-2"
            )}
          />
        ))}
      </div>

      {allDone && (
        <div className="m-card flex items-start gap-3 p-5 shadow-[inset_0_0_0_1px_rgba(200,168,88,0.35)]">
          <span className="metal-disc mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full">
            <Check className="h-4 w-4" strokeWidth={3.5} />
          </span>
          <div>
            <div className="m-head text-[22px] leading-none">Week complete</div>
            <p className="mt-1.5 text-[15px] text-white/75">
              All {sessionsWord(sessions.length)} sessions done. Your next week is on its way.
            </p>
          </div>
        </div>
      )}

      <ol className="-mx-1.5 space-y-2.5">
        {sessions.map((s) => {
          const p = sessionProgress(s.list, done);
          const isNext = nextUp?.n === s.n;
          const image = sessionImage(s.list);
          const headline = sessionHeadline(s.list);
          const name = s.extra ? "Extra session" : `Session ${position(s)}`;
          return (
            <li key={s.n}>
              <button
                onClick={(e) => openSession(s, e.currentTarget)}
                aria-label={`${name}${headline ? `, ${headline}` : ""}${p.complete ? ", done" : isNext ? ", up next" : ""}`}
                className={cn(
                  "press relative flex h-[108px] w-full overflow-hidden rounded-[24px] bg-fill text-left",
                  isNext && "shadow-[0_0_0_2.5px_#F5F4EF]"
                )}
              >
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt=""
                    aria-hidden
                    className={cn(
                      "absolute inset-0 h-full w-full object-cover object-[50%_45%]",
                      p.complete ? "brightness-[0.28] saturate-50" : "brightness-[0.55]"
                    )}
                  />
                )}
                <span className="relative flex flex-1 flex-col justify-between px-[18px] py-4">
                  <span className="m-head text-[26px] leading-none">{name}</span>
                  <span className="text-[13px] text-white/80">
                    {p.complete
                      ? `Done · ${p.minutesTotal} min`
                      : `${isNext ? "Up next · " : ""}${p.total} drills · ${p.minutesTotal} min${p.done > 0 ? ` · ${p.done} done` : ""}`}
                  </span>
                </span>
                <span className="relative grid w-[86px] place-items-center" aria-hidden>
                  {p.complete ? (
                    <span className="metal-disc grid h-10 w-10 place-items-center rounded-full">
                      <Check className="h-5 w-5" strokeWidth={3.5} />
                    </span>
                  ) : isNext ? (
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-bone text-black">
                      <Play className="ml-0.5 h-[18px] w-[18px]" fill="currentColor" />
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {showPast && past.map((w) => <PastWeek key={w.week} week={w.week} list={w.list} />)}

      {open && (
        <SessionPlayer
          drills={open.group.list}
          done={done}
          onToggle={toggle}
          startIndex={open.index}
          title={sessionName(open.group)}
          headline={sessionHeadline(open.group.list)}
          eyebrow={open.group.extra ? "Extra session" : `Session ${position(open.group)} of ${regular.length}`}
          origin={open.origin}
          weekLabel={`Week ${topWeek.week}`}
          firstName={firstName}
          trained={trained}
          minutesBefore={allTime - sessionProgress(open.group.list, done, trained).minutesDone}
          sessionsLeftAfter={planSessionsLeft(sessions, done, open.group.n)}
          sessionsTotal={planSessionCount(sessions)}
          playerId={playerId}
          sendClips={sendClips}
          example={example}
          onClose={close}
        />
      )}
    </div>
  );
}

function PastWeek({ week, list }: { week: number; list: Homework[] }) {
  const [open, setOpen] = useState(false);
  const minutes = list.reduce((m, h) => m + creditedMinutes(h), 0);
  const ordered = [...list].sort(
    (a, b) => (a.session ?? 1) - (b.session ?? 1) || a.sort - b.sort
  );
  return (
    <div className="m-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center justify-between p-4 text-left"
      >
        <span className="text-[15px] font-semibold text-white/80">Week {week}</span>
        <span className="flex items-center gap-3">
          <span className="text-[13px] tabular-nums text-white/60">
            {minutes > 0 ? `${fmtDuration(minutes)} trained` : ""}
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
                className={cn("h-4 w-4 shrink-0", h.completed ? "text-gold" : "text-white/50")}
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
