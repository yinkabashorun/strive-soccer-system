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
import {
  COUNT_IN_INTRO_MS,
  COUNT_IN_STEP_MS,
  countInNext,
  countInWanted,
  nextMilestone,
  sessionImage,
  type CountInState,
} from "@/lib/elite/experience";
import { fmtDuration } from "@/lib/elite/time-trained";
import { feel, keepAwake } from "@/lib/elite/native";
import { holdRefresh } from "@/lib/elite/fresh";
import { drillPoster, preloadNextClip } from "@/lib/elite/drill-poster";
import { AUTOPLAY_PREF_KEY } from "@/lib/elite/session-flow";
import { SendClip } from "./SendClip";
import { SetTimer } from "./SetTimer";
import { PushOptIn, useNotificationsAsk } from "./PushOptIn";
import { cn } from "@/lib/utils";
import { REFUSED_LINE, UNSENT_LINE_WEB } from "@/lib/elite/tick-outbox";
import { useWebRefused, useWebTicks } from "./web-ticks";

// Where the session grows from: the Home card's box on screen.
export type Origin = { top: number; left: number; width: number; height: number };

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function reducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

// The session, one drill at a time (Nov 18 2026; the experience, Nov 21).
// Start grows the Home card into the full screen; a session not yet
// started opens on its name and a 3, 2, 1 count-in (a tap skips it). Then
// the whole screen is one drill: its video, what to do, how many, one
// button. Done turns into a check, the bar at the top fills gold and the
// next drill slides in; the last one opens the finish screen, where the
// ring closes and the minutes just trained land on the player's total.
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
  headline,
  eyebrow,
  origin,
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
  headline?: string | null; // "Weak foot and ball mastery" (experience.ts sessionHeadline)
  eyebrow?: string; // "Session 3 of 4"
  origin?: Origin | null; // the card it grows out of
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
  const [leaving, setLeaving] = useState(false);
  const [showHow, setShowHow] = useState(false);
  // The count-in, only for a session started from its first drill with
  // nothing done yet (experience.ts countInWanted). A tap skips it.
  const [countIn, setCountIn] = useState<CountInState | null>(() =>
    countInWanted(drills, done, startIndex) ? "intro" : null
  );
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheet = useRef<HTMLDivElement | null>(null);
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

  // The card grows into the session: the sheet opens clipped to the card's
  // own box and widens to the whole screen. Reduced motion: a plain fade.
  useEffect(() => {
    const el = sheet.current;
    if (!mounted || !el) return;
    if (!origin || reducedMotion() || typeof el.animate !== "function") {
      el.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const from = `inset(${Math.max(0, origin.top)}px ${Math.max(0, vw - origin.left - origin.width)}px ${Math.max(
      0,
      vh - origin.top - origin.height
    )}px ${Math.max(0, origin.left)}px round 30px)`;
    el.animate([{ clipPath: from }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], {
      duration: 460,
      easing: EASE,
    });
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // The count-in's clock: the session's name, then 3, 2, 1, a tap felt on
  // each number, then the first drill.
  useEffect(() => {
    if (countIn === null) return;
    if (countIn === "go") {
      setCountIn(null);
      return;
    }
    if (typeof countIn === "number") feel("drill");
    const t = setTimeout(
      () => setCountIn((s) => (s === null ? null : countInNext(s, "tick"))),
      countIn === "intro" ? COUNT_IN_INTRO_MS : COUNT_IN_STEP_MS
    );
    return () => clearTimeout(t);
  }, [countIn]);

  const go = useCallback(
    (i: number) => {
      if (advance.current) clearTimeout(advance.current);
      setJustTicked(false);
      setLeaving(false);
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
      // The check lands, then Done carries the drill off to the left and
      // the next one slides in from the right.
      advance.current = setTimeout(() => {
        setLeaving(true);
        advance.current = setTimeout(() => go(n), 220);
      }, 320);
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

  const closeButton = (
    <button
      onClick={onClose}
      aria-label="Close the session"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/45 text-white/90 backdrop-blur-md active:scale-95"
    >
      <X className="h-5 w-5" />
    </button>
  );

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
  ) : countIn !== null ? (
    <CountIn
      state={countIn}
      image={sessionImage(drills)}
      eyebrow={eyebrow ?? `${weekLabel} · ${title}`}
      headline={headline ?? title}
      drills={progress.total}
      minutes={progress.minutesTotal}
      onSkip={() => setCountIn("go")}
      closeButton={closeButton}
    />
  ) : (
    <>
      {/* Top, over the video: close, how far through, where you are */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.6),rgba(0,0,0,0))] pb-6 pt-safe">
        <div className="pointer-events-auto flex items-center gap-3 px-3.5 pt-3">
          {closeButton}
          <div className="min-w-0 flex-1">
            <Segments drills={drills} done={done} current={index} onPick={go} />
          </div>
          <div className="shrink-0 font-display text-[17px] font-bold tabular-nums text-white/90">
            {progress.done}/{progress.total}
          </div>
        </div>
      </div>

      {/* The drill */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <div
          key={drill.id}
          className={cn(
            "mx-auto max-w-md animate-step-in transition-[opacity,transform] duration-200",
            leaving && "-translate-x-7 opacity-0"
          )}
        >
          <DrillClip
            src={drill.video_url}
            nextSrc={drills[index + 1]?.video_url ?? null}
            done={drillDone}
            justTicked={justTicked}
          />

          <div className="relative -mt-14 px-5">
            <div className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em]">
              <span className="text-gold">
                Drill {index + 1} of {drills.length}
              </span>
              <span className={kind === "finisher" ? "text-gold" : "text-white/60"}>
                {drill.pillar && kind === "skill" ? drill.pillar : KIND_LABEL[kind]}
              </span>
            </div>

            <h2 className="mt-2 m-head text-[34px] leading-[1.04] text-balance">{drillName(drill.title)}</h2>

            {/* The coach's sets, with a timer when the words can be timed.
                Keyed by drill so every drill starts with a fresh clock. */}
            {drill.reps && <SetTimer key={drill.id} reps={drill.reps} />}

            {drill.exercise && (
              <div className="mt-4">
                <p className={cn("text-[15px] leading-relaxed text-white/75", !showHow && "line-clamp-2")}>
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
              <p className="m-card mt-3 flex items-start gap-2 p-3 text-sm text-white/75">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
                {drill.notes}
              </p>
            )}

            {playerId && sendClips && canSendClip(drill.title) && (
              <SendClip playerId={playerId} homeworkId={drill.id} title={drill.title} />
            )}
          </div>
        </div>
      </div>

      {/* Bottom: one button, within reach of a thumb */}
      <div className="bg-black px-4 pt-3 pb-safe">
        <div className="mx-auto flex max-w-md items-center gap-2 pb-3">
          <button
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous drill"
            className="grid h-14 w-12 shrink-0 place-items-center rounded-[18px] bg-fill text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] disabled:opacity-25 active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={markDone}
            aria-label={drillDone ? (progress.complete ? "Done" : "Done. Next drill") : "Done"}
            className={cn(
              "flex h-14 flex-1 items-center justify-center gap-2 rounded-[18px] font-display text-[19px] font-bold uppercase tracking-[0.12em] transition-transform duration-150 active:scale-[0.97]",
              justTicked
                ? "bg-bone text-black"
                : drillDone
                  ? "bg-fill text-bone shadow-[inset_0_0_0_1px_rgba(200,168,88,0.4)]"
                  : "bg-bone text-black"
            )}
          >
            {justTicked ? (
              <Check className="h-8 w-8 animate-check-pop" strokeWidth={3} />
            ) : drillDone ? (
              <>
                <span className="metal-disc grid h-6 w-6 place-items-center rounded-full">
                  <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                </span>
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
            className="grid h-14 w-12 shrink-0 place-items-center rounded-[18px] bg-fill text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] disabled:opacity-25 active:scale-95"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        {drillDone && !justTicked && (
          <div className="mx-auto max-w-md pb-3 text-center">
            <button onClick={undo} className="tap text-sm text-white/60 underline-offset-4 hover:underline">
              Not done yet? Untick it
            </button>
          </div>
        )}
      </div>
    </>
  );

  return createPortal(
    <div
      ref={sheet}
      role="dialog"
      aria-modal="true"
      aria-label={`${weekLabel}, ${title}`}
      className="member-ui fixed inset-0 z-[70] flex flex-col bg-black text-bone"
    >
      {body}
    </div>,
    document.body
  );
}

// The session before the first drill: its picture, its name, "Grab your
// ball", then 3, 2, 1. Anywhere on the screen skips straight to the drill.
function CountIn({
  state,
  image,
  eyebrow,
  headline,
  drills,
  minutes,
  onSkip,
  closeButton,
}: {
  state: CountInState;
  image: string | null;
  eyebrow: string;
  headline: string;
  drills: number;
  minutes: number;
  onSkip: () => void;
  closeButton: React.ReactNode;
}) {
  const R = 96;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[50%_30%] brightness-[0.42]" />
      )}
      <button
        onClick={onSkip}
        aria-label="Skip the count-in and start the first drill"
        className="absolute inset-0 z-0 h-full w-full cursor-pointer"
      />
      <div className="pointer-events-none relative z-10 px-5 pt-[calc(env(safe-area-inset-top)+108px)] animate-rise">
        <div className="m-eyebrow">{eyebrow}</div>
        <h2 className="mt-2.5 m-head text-[44px] leading-none text-balance">{headline}</h2>
        <p className="mt-2.5 text-[15px] text-white/70">
          {drills} drill{drills === 1 ? "" : "s"} · about {minutes} minutes. Grab your ball.
        </p>
      </div>
      {typeof state === "number" && (
        <div className="pointer-events-none absolute inset-x-0 top-[44%] z-10 grid place-items-center" aria-live="assertive">
          <svg viewBox="0 0 220 220" className="absolute h-[200px] w-[200px] -rotate-90" aria-hidden>
            <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
            <circle
              key={state}
              cx="110"
              cy="110"
              r={R}
              fill="none"
              stroke="#c8a858"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              className="animate-ring-close"
              style={{ ["--ring" as string]: `${C}` }}
            />
          </svg>
          <span key={`n${state}`} className="m-head text-[120px] leading-none animate-count-pop">
            {state}
          </span>
        </div>
      )}
      <div className="absolute left-3.5 top-[calc(env(safe-area-inset-top)+12px)] z-20">{closeButton}</div>
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+28px)] z-10 text-center text-[13px] text-white/60">
        Tap anywhere to start now
      </div>
    </div>
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
    <div className="flex gap-1.5">
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
              "block h-1 rounded-full transition-colors duration-300",
              isDone(d, done) ? "bg-metal" : i === current ? "bg-bone" : "bg-white/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}

// The demo, playing edge to edge: muted, looping, no controls to fight
// with. One tap pauses it. When the drill is ticked a gold check lands
// over it.
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
    <div className="relative h-[60svh] max-h-[560px] min-h-[300px] w-full overflow-hidden bg-fill">
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
              "pointer-events-none absolute bottom-20 right-4 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-opacity",
              paused ? "opacity-100" : "opacity-0"
            )}
          >
            {paused ? <Play className="ml-0.5 h-4 w-4" fill="currentColor" /> : <Pause className="h-4 w-4" fill="currentColor" />}
          </span>
        </button>
      ) : (
        <div className="grid h-full w-full place-items-center text-sm text-white/60">
          The demo for this drill is on its way.
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_55%,#000_100%)]"
        aria-hidden
      />
      {done && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 grid place-items-center bg-black/45",
            justTicked && "animate-fade-in"
          )}
        >
          <span
            className={cn(
              "metal-disc grid h-20 w-20 place-items-center rounded-full shadow-[0_0_40px_-6px_rgba(200,168,88,0.6)]",
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
    if (reducedMotion() || target <= 0) {
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

// The gold flecks that fly out of the ring when it closes. Fixed places,
// so every finish looks the same and nothing random runs on render.
const SPARKS = [
  { x: -118, y: -96, r: -24, w: 4, h: 12, d: 620 },
  { x: 120, y: -104, r: 30, w: 4, h: 10, d: 680 },
  { x: -150, y: 6, r: -60, w: 3, h: 9, d: 740 },
  { x: 152, y: 20, r: 64, w: 3, h: 11, d: 700 },
  { x: -96, y: 112, r: 20, w: 4, h: 9, d: 780 },
  { x: 104, y: 120, r: -18, w: 4, h: 12, d: 820 },
  { x: -18, y: -150, r: 8, w: 3, h: 10, d: 660 },
  { x: 30, y: 150, r: -8, w: 3, h: 8, d: 860 },
];

// The finish: the ring closes, the minutes land on the total, the next
// medal and how close it is. Nothing about what is left undone beyond the
// plain fact, nothing to tap but Done.
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
  // the truth about saving: ticks still on their way, or one the server refused
  const unsent = useWebTicks().length > 0;
  const notSaved = useWebRefused().length > 0;
  const weekDone = sessionsLeftAfter <= 0;
  const added = useCountUp(minutes);
  const total = minutesBefore + added;
  const milestone = milestoneCrossed(minutesBefore, minutesBefore + minutes);
  const next = nextMilestone(minutesBefore + minutes);
  const R = 108;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(85%_50%_at_50%_28%,#221c0d_0%,#0a0805_48%,#000_76%)] pt-safe">
      {/* Scrolls from the top on a short screen, centres on a tall one. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 text-center">
        <div className="flex min-h-full flex-col items-center justify-center py-6">
          <div className="relative h-[220px] w-[220px] shrink-0">
            {SPARKS.map((s, i) => (
              <span
                key={i}
                aria-hidden
                className="absolute left-1/2 top-1/2 rounded-sm bg-metal opacity-0 animate-spark"
                style={{
                  width: s.w,
                  height: s.h,
                  animationDelay: `${s.d}ms`,
                  ["--dx" as string]: `${s.x}px`,
                  ["--dy" as string]: `${s.y}px`,
                  ["--r" as string]: `${s.r}deg`,
                }}
              />
            ))}
            <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
              <defs>
                <linearGradient id="finish-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#f0dca0" />
                  <stop offset=".45" stopColor="#c8a858" />
                  <stop offset="1" stopColor="#8c6d2c" />
                </linearGradient>
              </defs>
              <circle cx="120" cy="120" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <circle
                cx="120"
                cy="120"
                r={R}
                fill="none"
                stroke="url(#finish-gold)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={C}
                className="animate-ring-close"
                style={{ ["--ring" as string]: `${C}` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="metal-text m-head text-[68px] leading-none tabular-nums">+{added}</span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/60">Minutes</span>
            </div>
          </div>

          <h2 className="mt-6 m-head text-[36px] leading-[1.02] animate-rise [animation-delay:260ms]">
            {weekDone ? `${weekLabel} done, ${firstName}` : `Session done, ${firstName}`}
          </h2>
          <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-white/65 animate-rise [animation-delay:340ms]">
            {weekDone ? weekDoneLine ?? "Every session of the week, done." : afterSessionLine(sessionsLeftAfter)}
          </p>
          {notSaved || unsent ? (
            <p className={cn("mt-2 max-w-xs text-[13px] leading-relaxed", notSaved ? "text-white" : "text-white/60")}>
              {notSaved ? REFUSED_LINE : UNSENT_LINE_WEB}
            </p>
          ) : null}
          <span className="sr-only">{title}</span>

          <div className="mt-6 flex w-full max-w-sm gap-2.5 text-left animate-rise [animation-delay:440ms]">
            <div className="m-card flex-1 px-3.5 py-3">
              <div className="m-num text-[26px] leading-none tabular-nums">
                {Math.max(0, sessionsTotal - sessionsLeftAfter)} / {sessionsTotal}
              </div>
              <div className="mt-1 text-[12px] text-white/60">sessions this week</div>
            </div>
            <div className="m-card flex-1 px-3.5 py-3">
              <div className="m-num text-[26px] leading-none tabular-nums">{fmtDuration(total)}</div>
              <div className="mt-1 text-[12px] text-white/60">trained, all time</div>
            </div>
          </div>

          {milestone !== null ? (
            <MedalLine
              disc={milestone < 10 ? `${milestone}H` : `${milestone}`}
              title={milestoneLabel(milestone)}
              line="Every minute of it is yours for good."
            />
          ) : next ? (
            <MedalLine
              disc={next.hours < 10 ? `${next.hours}H` : `${next.hours}`}
              title={`Next up: ${milestoneLabel(next.hours)}`}
              line={`${fmtDuration(next.minutesAway)} away.${next.minutesAway <= Math.max(minutes, 20) ? " One session gets you there." : ""}`}
              dim
            />
          ) : null}
        </div>
      </div>

      <div className="px-4 pt-3 pb-safe">
        <div className="mx-auto max-w-md pb-3">
          <button onClick={onClose} className="m-button">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// The medal under the finish: a milestone just reached in full metal, or
// the next one, how far away, with its disc in metal waiting.
function MedalLine({ disc, title, line, dim = false }: { disc: string; title: string; line: string; dim?: boolean }) {
  return (
    <div
      className={cn(
        "mt-3 flex w-full max-w-sm items-center gap-3.5 rounded-[20px] px-4 py-3.5 text-left animate-rise [animation-delay:620ms]",
        "bg-[linear-gradient(90deg,rgba(200,168,88,0.16),rgba(200,168,88,0.03))] shadow-[inset_0_0_0_1px_rgba(200,168,88,0.38)]"
      )}
    >
      <span
        className={cn(
          "grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full font-display text-[18px] font-bold",
          dim ? "bg-fill-2 text-gold shadow-[inset_0_0_0_1.5px_rgba(200,168,88,0.6)]" : "metal-disc"
        )}
        aria-hidden
      >
        {disc}
      </span>
      <span className="min-w-0">
        <span className="block text-[16px] font-semibold text-bone">{title}</span>
        <span className="mt-0.5 block text-[13px] text-white/65">{line}</span>
      </span>
    </div>
  );
}
