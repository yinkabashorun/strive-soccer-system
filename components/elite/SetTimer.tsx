"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Pause, Play, RotateCcw, Timer } from "lucide-react";
import {
  clock,
  parseReps,
  stepSeconds,
  timerNext,
  timerStart,
  type TimerStep,
} from "@/lib/elite/set-timer";
import { cue, primeSound } from "@/lib/elite/sound";
import { feel } from "@/lib/elite/native";
import { cn } from "@/lib/utils";

// The drill's sets, timed. The coach's words stay on screen exactly as
// written; when they say something a clock can run ("3 x 1 min, rest 30
// sec") a Timer button sits beside them. One tap and the phone counts the
// sets and the rest, with a tone and a tap of feedback at every change, so
// the player never leaves the app for a stopwatch. A drill whose words
// cannot be timed shows just the words.
export function SetTimer({ reps }: { reps: string }) {
  const plan = useMemo(() => parseReps(reps), [reps]);
  const [step, setStep] = useState<TimerStep | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null); // ms, while the clock runs
  const [pausedLeft, setPausedLeft] = useState<number | null>(null); // seconds, while paused
  const [now, setNow] = useState(() => Date.now());
  const lastTick = useRef<number | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const started = step !== null;

  // The clock is the thing to look at once it starts: bring it fully on
  // screen, above the Done bar.
  useEffect(() => {
    if (!started) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    box.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [started]);

  const enter = useCallback(
    (next: TimerStep) => {
      if (!plan) return;
      const secs = stepSeconds(plan, next);
      setStep(next);
      setPausedLeft(null);
      setEndsAt(secs === null ? null : Date.now() + secs * 1000);
      setNow(Date.now());
      lastTick.current = null;
      if (next.phase === "work") {
        cue("go");
        feel("drill");
      } else if (next.phase === "rest" || next.phase === "between") {
        cue("rest");
        feel("drill");
      } else if (next.phase === "done") {
        cue("done");
        feel("drill");
      }
    },
    [plan]
  );

  // The clock: read from the wall, so a phone that dozes or a tab that is
  // throttled never drifts.
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [endsAt]);

  const left = endsAt === null ? null : Math.max(0, (endsAt - now) / 1000);

  useEffect(() => {
    if (!plan || !step || left === null) return;
    if (left <= 0) {
      enter(timerNext(plan, step));
      return;
    }
    // Three soft ticks into every set, so the player is ready on the tone.
    const whole = Math.ceil(left);
    if ((step.phase === "ready" || step.phase === "rest") && whole <= 3 && lastTick.current !== whole) {
      lastTick.current = whole;
      cue("tick");
    }
  }, [left, plan, step, enter]);

  if (!plan) {
    return (
      <div className="mt-3 inline-flex rounded-2xl border border-accent/35 bg-accent/[0.08] px-4 py-2.5 font-display text-xl font-bold uppercase tracking-wide text-accent">
        {reps}
      </div>
    );
  }

  const start = () => {
    primeSound();
    enter(timerStart(plan));
  };
  const reset = () => {
    setStep(null);
    setEndsAt(null);
    setPausedLeft(null);
  };
  const pause = () => {
    if (left === null) return;
    setPausedLeft(left);
    setEndsAt(null);
  };
  const resume = () => {
    if (pausedLeft === null) return;
    setEndsAt(Date.now() + pausedLeft * 1000);
    setNow(Date.now());
    setPausedLeft(null);
  };

  if (!step) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-2xl border border-accent/35 bg-accent/[0.08] px-4 py-2.5 font-display text-xl font-bold uppercase tracking-wide text-accent">
          {reps}
        </div>
        <button
          onClick={start}
          className="inline-flex h-[46px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-4 text-sm font-semibold text-bone active:scale-[0.97]"
        >
          <Timer className="h-4 w-4" />
          {plan.workSec !== null ? "Start timer" : "Time my rest"}
        </button>
      </div>
    );
  }

  const total = stepSeconds(plan, step);
  const shown = pausedLeft ?? left;
  const running = endsAt !== null;
  const label =
    step.phase === "ready"
      ? "Get ready"
      : step.phase === "work"
        ? "Go"
        : step.phase === "rest"
          ? "Rest"
          : step.phase === "between"
            ? `Set ${step.set} done`
            : plan.sets === 1
              ? "Time"
              : `All ${plan.sets} sets done`;
  const working = step.phase === "work";

  return (
    <div
      ref={box}
      className={cn(
        "mt-3 scroll-my-4 rounded-2xl border p-4 transition-colors",
        step.phase === "done"
          ? "border-accent/40 bg-accent/[0.08]"
          : working
            ? "border-white/25 bg-white/[0.07]"
            : "border-white/10 bg-white/[0.03]"
      )}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
          {step.phase === "done" ? reps : `Set ${step.set} of ${plan.sets}`}
        </div>
        <button
          onClick={reset}
          aria-label="Reset the timer"
          className="-m-2 grid h-11 w-11 place-items-center rounded-full text-white/50 active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div
            className={cn(
              "font-display text-lg font-black uppercase tracking-wide",
              step.phase === "done" || step.phase === "rest" || step.phase === "between"
                ? "text-accent"
                : "text-bone"
            )}
          >
            {label}
          </div>
          {shown !== null && total !== null ? (
            <div className="font-display text-6xl font-black leading-none tabular-nums text-bone">
              {clock(shown)}
            </div>
          ) : step.phase === "done" ? (
            <div className="mt-1 text-sm text-white/65">Tap Done below when you are finished.</div>
          ) : (
            <div className="mt-1 text-sm text-white/65">
              {working ? "Count your reps, then tap Set done." : "Start the next set when you are ready."}
            </div>
          )}
        </div>

        {step.phase === "done" ? (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-black animate-check-pop">
            <Check className="h-6 w-6" strokeWidth={3.5} />
          </span>
        ) : total !== null ? (
          <button
            onClick={running ? pause : resume}
            aria-label={running ? "Pause the timer" : "Resume the timer"}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-black active:scale-95"
          >
            {running ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
          </button>
        ) : (
          <button
            onClick={() => enter(timerNext(plan, step))}
            className="h-12 shrink-0 rounded-2xl bg-white px-4 text-sm font-bold uppercase tracking-wide text-black active:scale-[0.97]"
          >
            {working ? "Set done" : `Start set ${step.set + 1}`}
          </button>
        )}
      </div>

      {shown !== null && total !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/12">
          <div
            className={cn("h-full rounded-full", working ? "bg-white" : "bg-accent")}
            style={{ width: `${Math.min(100, Math.max(0, (1 - shown / total) * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}
