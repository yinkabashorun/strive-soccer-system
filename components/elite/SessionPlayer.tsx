"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Pause, Play, StickyNote, X } from "lucide-react";
import type { Homework } from "@/lib/elite/types";
import {
  KIND_LABEL,
  afterSessionLine,
  canSendClip,
  drillKind,
  drillName,
  isDone,
  milestoneCrossed,
  milestoneLabel,
  nextStep,
  sessionProgress,
  type DoneMap,
} from "@/lib/elite/session-flow";
import { fmtDuration } from "@/lib/elite/time-trained";
import { feel, keepAwake } from "@/lib/elite/native";
import { holdRefresh } from "@/lib/elite/fresh";
import { drillPoster, preloadNextClip } from "@/lib/elite/drill-poster";
import { AUTOPLAY_PREF_KEY } from "@/lib/elite/session-flow";
import { SendClip } from "./SendClip";
import { SetTimer } from "./SetTimer";
import { PushOptIn, useNotificationsAsk } from "./PushOptIn";
import { cn } from "@/lib/utils";

// The session, one drill at a time (Nov 18 2026). The whole screen is one
// drill: its video playing, what to do, how many, and one button. Tapping
// Done ticks it, gives a touch of feedback and moves to the next drill;
// the last one opens the finish screen, where the minutes just trained
// land on the player's total.
//
// It works from a snapshot of the session taken when it opens, so the
// finish screen stays put while the page behind it moves on to the next
// session. The done-state itself belongs to the view that opened it.
export function SessionPlayer({
  drills,
  done,
  onToggle,
  startIndex,
  title,
  weekLabel,
  firstName,
  minutesBefore,
  sessionsLeftAfter,
  sessionsTotal,
  weekDoneLine,
  playerId,
  sendClips = true,
  example = false,
  onClose,
}: {
  drills: Homework[];
  done: DoneMap;
  onToggle: (id: string, next: boolean) => void;
  startIndex: number;
  title: string; // "Session 3" or "Extra session"
  weekLabel: string; // "Week 7"
  firstName: string;
  // All-time minutes trained, not counting the drills of this session.
  minutesBefore: number;
  // Sessions of the week still open once this one is finished.
  sessionsLeftAfter: number;
  // Sessions in the week, counting this one.
  sessionsTotal: number;
  // What to say about next week when this session finishes the week.
  weekDoneLine?: string;
  playerId?: string; // enables Send a clip on skill drills
  sendClips?: boolean; // false for an offer without Send a clip (lib/elite/tiers.ts)
  example?: boolean; // the example player: never asked about notifications
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), drills.length - 1));
  const [finished, setFinished] = useState(false);
  const [justTicked, setJustTicked] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Notifications are asked for once, on its own screen after the finish
  // screen of a member's own session (A8). Never the example player.
  const { ask, shown } = useNotificationsAsk(Boolean(playerId) && !example);
  const [asking, setAsking] = useState(false);

  const progress = useMemo(() => sessionProgress(drills, done), [drills, done]);

  useEffect(() => {
    setMounted(true);
    const release = keepAwake();
    // The page behind must not redraw under an open session (A5).
    const letRefresh = holdRefresh();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      release();
      letRefresh();
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      if (advance.current) clearTimeout(advance.current);
    };
  }, [onClose]);

  const go = useCallback(
    (i: number) => {
      if (advance.current) clearTimeout(advance.current);
      setJustTicked(false);
      setShowHow(false);
      setIndex(Math.min(Math.max(i, 0), drills.length - 1));
    },
    [drills.length]
  );

  if (!mounted || drills.length === 0) return null;

  const drill = drills[index];
  const kind = drillKind(drill.title);
  const drillDone = isDone(drill, done);

  function markDone() {
    if (drillDone) {
      // Already done: this button just moves on.
      const n = nextStep(drills, done, index);
      if (n === -1) go(Math.min(index + 1, drills.length - 1));
      else go(n);
      return;
    }
    const after: DoneMap = { ...done, [drill.id]: true };
    onToggle(drill.id, true);
    setJustTicked(true);
    const n = nextStep(drills, after, index);
    if (n === -1) {
      feel(sessionsLeftAfter <= 0 ? "week" : "session");
      advance.current = setTimeout(() => setFinished(true), 420);
    } else {
      feel("drill");
      advance.current = setTimeout(() => go(n), 520);
    }
  }

  function undo() {
    onToggle(drill.id, false);
    setJustTicked(false);
  }

  // Done on the finish screen: the ask, if there is one to make, else out.
  function leaveFinish() {
    if (!ask) return onClose();
    shown();
    setAsking(true);
  }

  const body = asking && ask ? (
    <PushOptIn ask={ask} onDone={onClose} />
  ) : finished ? (
    <Finish
      title={title}
      weekLabel={weekLabel}
      firstName={firstName}
      sessionsTotal={sessionsTotal}
      minutes={progress.minutesTotal}
      minutesBefore={minutesBefore}
      sessionsLeftAfter={sessionsLeftAfter}
      weekDoneLine={weekDoneLine}
      onClose={leaveFinish}
    />
  ) : (
    <>
      {/* Top: close, where you are, how far through */}
      <div className="pt-safe">
        <div className="flex items-center gap-3 px-4 pb-3 pt-3">
          <button
            onClick={onClose}
            aria-label="Close the session"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/80 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
              {weekLabel} · {title}
            </div>
            <Segments drills={drills} done={done} current={index} onPick={go} />
          </div>
          <div className="shrink-0 font-display text-lg font-black tabular-nums text-white/80">
            {progress.done}/{progress.total}
          </div>
        </div>
      </div>

      {/* Middle: the drill */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div key={drill.id} className="mx-auto max-w-md animate-drill-in">
          <DrillClip
            src={drill.video_url}
            nextSrc={drills[index + 1]?.video_url ?? null}
            done={drillDone}
            justTicked={justTicked}
          />

          <div className="mt-4 flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em]",
                kind === "finisher"
                  ? "bg-accent/15 text-accent"
                  : "bg-white/[0.08] text-white/75"
              )}
            >
              {KIND_LABEL[kind]}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              {index + 1} of {drills.length}
            </span>
          </div>

          <h2 className="mt-2 font-display text-[30px] font-black uppercase leading-[1.02] text-bone">
            {drillName(drill.title)}
          </h2>

          {/* The coach's sets, with a timer when the words can be timed.
              Keyed by drill so every drill starts with a fresh clock. */}
          {drill.reps && <SetTimer key={drill.id} reps={drill.reps} />}

          {drill.exercise && (
            <div className="mt-4">
              <p
                className={cn(
                  "text-[15px] leading-relaxed text-white/75",
                  !showHow && "line-clamp-2"
                )}
              >
                {drill.exercise}
              </p>
              {drill.exercise.length > 90 && (
                <div className="mt-1">
                  <button
                    onClick={() => setShowHow((v) => !v)}
                    aria-expanded={showHow}
                    className="tap text-sm font-semibold text-white/60 underline-offset-4 hover:underline"
                  >
                    {showHow ? "Show less" : "How to do it"}
                  </button>
                </div>
              )}
            </div>
          )}

          {drill.notes && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/75">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {drill.notes}
            </p>
          )}

          {playerId && sendClips && canSendClip(drill.title) && (
            <SendClip playerId={playerId} homeworkId={drill.id} title={drill.title} />
          )}
        </div>
      </div>

      {/* Bottom: one button, within reach of a thumb */}
      <div className="border-t border-white/[0.07] bg-black/90 px-4 pt-3 backdrop-blur-xl pb-safe">
        <div className="mx-auto flex max-w-md items-center gap-2 pb-3">
          <button
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous drill"
            className="grid h-14 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 text-white/70 disabled:opacity-25 active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={markDone}
            className={cn(
              "flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl font-display text-xl font-black uppercase tracking-wide transition-all active:scale-[0.98]",
              drillDone
                ? "border border-accent/40 bg-accent/[0.10] text-accent"
                : "bg-white text-black"
            )}
          >
            {drillDone ? (
              <>
                <Check className="h-5 w-5" strokeWidth={3} />
                {progress.complete ? "Done" : "Done. Next"}
              </>
            ) : (
              "Done"
            )}
          </button>
          <button
            onClick={() => go(index + 1)}
            disabled={index === drills.length - 1}
            aria-label="Next drill"
            className="grid h-14 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 text-white/70 disabled:opacity-25 active:scale-95"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        {drillDone && !justTicked && (
          <div className="mx-auto max-w-md pb-3 text-center">
            <button onClick={undo} className="tap text-sm text-white/50 underline-offset-4 hover:underline">
              Not done yet? Untick it
            </button>
          </div>
        )}
      </div>
    </>
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${weekLabel}, ${title}`}
      className="fixed inset-0 z-[70] flex flex-col bg-black text-bone animate-sheet-in"
    >
      {body}
    </div>,
    document.body
  );
}

// One bar per drill: gold when done, bright for the one on screen. Tapping
// a bar jumps to that drill.
function Segments({
  drills,
  done,
  current,
  onPick,
}: {
  drills: Homework[];
  done: DoneMap;
  current: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="mt-1.5 flex gap-1.5">
      {drills.map((d, i) => (
        <button
          key={d.id}
          onClick={() => onPick(i)}
          aria-label={`Drill ${i + 1}`}
          aria-current={i === current ? "step" : undefined}
          className="group relative flex-1 py-1.5 before:absolute before:inset-x-0 before:-inset-y-[13px] before:content-['']"
        >
          <span
            className={cn(
              "block h-1.5 rounded-full transition-colors duration-300",
              isDone(d, done) ? "bg-accent" : i === current ? "bg-white/80" : "bg-white/15"
            )}
          />
        </button>
      ))}
    </div>
  );
}

// The demo, playing: muted, looping, no controls to fight with. One tap
// pauses it. When the drill is ticked a gold check lands over it.
function DrillClip({
  src,
  nextSrc,
  done,
  justTicked,
}: {
  src: string | null;
  nextSrc: string | null; // the drill after this one, fetched ahead
  done: boolean;
  justTicked: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // The player's own setting (Account page): demos play on their own unless
  // switched off, in which case one tap plays them.
  const [autoplay] = useState(() => {
    try {
      return window.localStorage.getItem(AUTOPLAY_PREF_KEY) !== "off";
    } catch {
      return true;
    }
  });
  // Starts true: the badge shows Play until the clip is really playing
  // (Low Power Mode and the "no autoplay" setting both leave it paused).
  const [paused, setPaused] = useState(true);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  }

  // The still for this clip shows at once; the next drill's still and
  // (unless the member switched demos off) its clip are fetched ahead, so
  // moving on never starts from a black box (lib/elite/drill-poster.ts).
  const poster = drillPoster(src);
  const nextPoster = drillPoster(nextSrc);
  const fetchNext = preloadNextClip({ autoplay, nextSrc });
  useEffect(() => {
    if (!nextPoster) return;
    const img = new Image();
    img.src = nextPoster;
  }, [nextPoster]);

  return (
    <div className="relative mx-auto aspect-[4/5] max-h-[46svh] w-full overflow-hidden rounded-3xl border border-white/10 bg-ink-100">
      {fetchNext && nextSrc && (
        <video
          key={nextSrc}
          src={nextSrc}
          preload="auto"
          muted
          playsInline
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
      )}
      {src ? (
        <button onClick={toggle} aria-label={paused ? "Play the demo" : "Pause the demo"} className="block h-full w-full">
          <video
            ref={ref}
            src={src}
            poster={poster ?? undefined}
            autoPlay={autoplay}
            muted
            loop
            playsInline
            preload="auto"
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
            className="h-full w-full object-cover"
          />
          <span
            className={cn(
              "pointer-events-none absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-opacity",
              paused ? "opacity-100" : "opacity-60"
            )}
          >
            {paused ? <Play className="ml-0.5 h-4 w-4" fill="currentColor" /> : <Pause className="h-4 w-4" fill="currentColor" />}
          </span>
        </button>
      ) : (
        <div className="grid h-full w-full place-items-center text-sm text-white/50">
          The demo for this drill is on its way.
        </div>
      )}
      {done && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 grid place-items-center bg-black/45",
            justTicked && "animate-fade-in"
          )}
        >
          <span
            className={cn(
              "grid h-20 w-20 place-items-center rounded-full bg-accent text-black shadow-glow",
              justTicked && "animate-check-pop"
            )}
          >
            <Check className="h-10 w-10" strokeWidth={3.5} />
          </span>
        </div>
      )}
    </div>
  );
}

// Counts a number up once, quickly, easing out. Reduced-motion users get
// the final number straight away.
function useCountUp(target: number, ms = 900, delay = 250): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target <= 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    let startAt = 0;
    const tick = (now: number) => {
      if (!startAt) startAt = now + delay;
      const t = Math.min(1, Math.max(0, (now - startAt) / ms));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return value;
}

// The finish: the ring closes, the minutes land on the total. Nothing
// about what is left undone beyond the plain fact, nothing to tap but Done.
function Finish({
  title,
  weekLabel,
  firstName,
  sessionsTotal,
  minutes,
  minutesBefore,
  sessionsLeftAfter,
  weekDoneLine,
  onClose,
}: {
  title: string;
  weekLabel: string;
  firstName: string;
  sessionsTotal: number;
  minutes: number;
  minutesBefore: number;
  sessionsLeftAfter: number;
  weekDoneLine?: string;
  onClose: () => void;
}) {
  const weekDone = sessionsLeftAfter <= 0;
  const added = useCountUp(minutes);
  const total = minutesBefore + added;
  const milestone = milestoneCrossed(minutesBefore, minutesBefore + minutes);
  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-safe">
      {/* Scrolls from the top on a short screen, centres on a tall one. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 text-center">
       <div className="flex min-h-full flex-col items-center justify-center py-6">
        <div className="relative grid h-32 w-32 shrink-0 place-items-center">
          <span className="absolute inset-0 rounded-full bg-accent/20 blur-2xl animate-glow-once" />
          <svg viewBox="0 0 128 128" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="8" />
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke="#D4AF37"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={C}
              className="animate-ring-close"
              style={{ ["--ring" as string]: `${C}` }}
            />
          </svg>
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-accent text-black animate-check-pop [animation-delay:520ms]">
            <Check className="h-8 w-8" strokeWidth={3.5} />
          </span>
        </div>

        <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-accent animate-rise [animation-delay:200ms]">
          {weekLabel} · {title}
        </div>
        <h2 className="mt-2 font-display text-4xl font-black uppercase leading-[0.95] animate-rise [animation-delay:260ms]">
          {weekDone ? `${weekLabel} complete, ${firstName}` : `Session complete, ${firstName}`}
        </h2>

        <div className="mt-6 animate-rise [animation-delay:360ms]">
          <div className="font-display text-7xl font-black leading-none text-accent tabular-nums">
            +{added}
            <span className="ml-1 text-3xl">min</span>
          </div>
          <div className="mt-2 text-sm text-white/65">added to your time trained</div>
        </div>

        <div className="mt-6 flex w-full max-w-xs items-stretch justify-center gap-3 animate-rise [animation-delay:460ms]">
          <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <div className="font-display text-2xl font-black tabular-nums">{fmtDuration(total)}</div>
            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              All time
            </div>
          </div>
          <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <div className="font-display text-2xl font-black tabular-nums">
              {Math.max(0, sessionsTotal - sessionsLeftAfter)}/{sessionsTotal}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Sessions this week
            </div>
          </div>
        </div>

        {milestone !== null && (
          <div className="mt-5 w-full max-w-xs rounded-2xl border border-accent/40 bg-accent/[0.08] px-4 py-3 animate-rise [animation-delay:620ms]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
              Milestone
            </div>
            <div className="mt-0.5 font-display text-2xl font-black uppercase leading-none text-bone">
              {milestoneLabel(milestone)}
            </div>
            <div className="mt-1 text-sm text-white/65">Every minute of it is yours for good.</div>
          </div>
        )}

        <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-white/70 animate-rise [animation-delay:540ms]">
          {weekDone
            ? weekDoneLine ?? "Every session of the week, done."
            : afterSessionLine(sessionsLeftAfter)}
        </p>

       </div>
      </div>

      <div className="px-4 pt-3 pb-safe">
        <div className="mx-auto max-w-md pb-3">
          <button
            onClick={onClose}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
