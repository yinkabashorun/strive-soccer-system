"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Minus, Plus } from "lucide-react";
import { saveQuiz } from "@/lib/elite/tracker-actions";
import { fmtDuration } from "@/lib/elite/time-trained";
import {
  FREE_HOME,
  GOALS,
  GRADES,
  LEVELS,
  QUIZ_QUESTIONS,
  SEASONS,
  TARGET_MAX,
  TARGET_MIN,
  recommendLine,
  recommendation,
  stepTarget,
  type Goal,
  type Grade,
  type Level,
  type Season,
  type TargetRow,
} from "@/lib/elite/tracker";

type Step = (typeof QUIZ_QUESTIONS)[number] | "target";
const ORDER: Step[] = [...QUIZ_QUESTIONS, "target"];

// Four questions, one a screen, then the weekly target. A tap answers a
// question and moves on; nothing is saved until the target is chosen.
export function TrackerQuiz({
  targets,
  initial,
  currentTarget,
}: {
  targets: TargetRow[];
  initial: { grade: Grade | null; level: Level | null; season: Season | null; goal: Goal | null };
  // Set when the player has a target already and is here to change it.
  currentTarget: number | null;
}) {
  const [step, setStep] = useState<Step>("grade");
  const [grade, setGrade] = useState<Grade | null>(initial.grade);
  const [level, setLevel] = useState<Level | null>(initial.level);
  const [season, setSeason] = useState<Season | null>(initial.season);
  const [goal, setGoal] = useState<Goal | null>(initial.goal);
  const [own, setOwn] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const at = ORDER.indexOf(step);
  const back = () => {
    setError(null);
    if (own !== null) return setOwn(null);
    if (at > 0) setStep(ORDER[at - 1]);
  };

  function save(target: number) {
    if (!grade || !level || !season || !goal) return;
    setError(null);
    startSaving(async () => {
      const res = await saveQuiz({ grade, level, season, goal, target });
      if (!res.ok) return setError(res.error);
      // A full load, so the week opens on what was just saved.
      window.location.assign(FREE_HOME);
    });
  }

  const row = season ? recommendation(targets, season) : null;

  return (
    <div className="flex min-h-[calc(100svh-9rem)] flex-col">
      <div className="flex h-11 items-center justify-between">
        {at > 0 || own !== null ? (
          <button
            type="button"
            onClick={back}
            className="-ml-2 inline-flex h-11 items-center gap-1 pl-1 pr-3 text-[15px] font-medium text-white/70"
          >
            <ChevronLeft className="h-5 w-5" /> Back
          </button>
        ) : currentTarget ? (
          <Link
            href={FREE_HOME}
            className="-ml-2 inline-flex h-11 items-center gap-1 pl-1 pr-3 text-[15px] font-medium text-white/70"
          >
            <ChevronLeft className="h-5 w-5" /> Back
          </Link>
        ) : (
          <span />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
          {step === "target" ? "Your target" : `${at + 1} of ${QUIZ_QUESTIONS.length}`}
        </span>
      </div>

      {step === "grade" && (
        <Question title="What grade are you in?">
          {GRADES.map((o) => (
            <Option
              key={o.id}
              label={o.label}
              picked={grade === o.id}
              onPick={() => {
                setGrade(o.id);
                setStep("level");
              }}
            />
          ))}
        </Question>
      )}

      {step === "level" && (
        <Question title="What team do you play for?">
          {LEVELS.map((o) => (
            <Option
              key={o.id}
              label={o.label}
              picked={level === o.id}
              onPick={() => {
                setLevel(o.id);
                setStep("season");
              }}
            />
          ))}
        </Question>
      )}

      {step === "season" && (
        <Question title="Are you in season right now?">
          {SEASONS.map((o) => (
            <Option
              key={o.id}
              label={o.label}
              detail={o.detail}
              picked={season === o.id}
              onPick={() => {
                setSeason(o.id);
                setStep("goal");
              }}
            />
          ))}
        </Question>
      )}

      {step === "goal" && (
        <Question title="What are you working toward?">
          {GOALS.map((o) => (
            <Option
              key={o.id}
              label={o.label}
              picked={goal === o.id}
              onPick={() => {
                setGoal(o.id);
                setStep("target");
              }}
            />
          ))}
        </Question>
      )}

      {step === "target" && row && level && (
        <div className="flex flex-1 flex-col pt-6">
          {own === null ? (
            <>
              <h1 className="font-display text-4xl font-black uppercase leading-[0.95]">
                Your weekly target
              </h1>
              <div className="mt-6 font-display text-7xl font-black leading-none text-accent tabular-nums">
                {fmtDuration(row.minutes)}
              </div>
              <p className="mt-5 text-[17px] leading-relaxed text-bone">{recommendLine(row)}</p>
              {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
              <div className="mt-auto space-y-3 pt-8">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save(row.minutes)}
                  className="flex h-14 w-full items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Make that my target"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setOwn(currentTarget ?? row.minutes)}
                  className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
                >
                  Set my own
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="font-display text-4xl font-black uppercase leading-[0.95]">
                Set your own target
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-white/70">
                How much you want to train on your own each week.
              </p>
              <div className="mt-8 flex items-center justify-between gap-4">
                <button
                  type="button"
                  aria-label="30 minutes less"
                  disabled={own <= TARGET_MIN}
                  onClick={() => setOwn(stepTarget(own, -1))}
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/15 text-bone disabled:opacity-30"
                >
                  <Minus className="h-6 w-6" />
                </button>
                <div className="font-display text-6xl font-black leading-none text-accent tabular-nums">
                  {fmtDuration(own)}
                </div>
                <button
                  type="button"
                  aria-label="30 minutes more"
                  disabled={own >= TARGET_MAX}
                  onClick={() => setOwn(stepTarget(own, 1))}
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/15 text-bone disabled:opacity-30"
                >
                  <Plus className="h-6 w-6" />
                </button>
              </div>
              <p className="mt-3 text-center text-sm text-white/60">a week</p>
              {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
              <div className="mt-auto pt-8">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save(own)}
                  className="flex h-14 w-full items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save my target"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-6">
      <h1 className="font-display text-4xl font-black uppercase leading-[0.95]">{title}</h1>
      <div className="mt-6 space-y-3">{children}</div>
    </div>
  );
}

function Option({
  label,
  detail,
  picked,
  onPick,
}: {
  label: string;
  detail?: string;
  picked: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={
        "flex min-h-[64px] w-full flex-col justify-center rounded-2xl border px-5 py-3 text-left " +
        (picked ? "border-white bg-white/[0.08]" : "border-white/15 bg-white/[0.03]")
      }
    >
      <span className="text-[17px] font-semibold text-bone">{label}</span>
      {detail && <span className="mt-0.5 text-sm text-white/60">{detail}</span>}
    </button>
  );
}
