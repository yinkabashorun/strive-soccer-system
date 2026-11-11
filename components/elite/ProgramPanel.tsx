"use client";

import { useState, useTransition } from "react";
import { CalendarRange, Loader2 } from "lucide-react";
import { endProgram, saveProgram } from "@/lib/elite/program-actions";
import {
  draftFocuses,
  FOCUS_SLOTS,
  pillarName,
  PROGRAM_CATEGORIES,
  programWeekFor,
  slotLabel,
  THREAD_KINDS,
  THREAD_NAMES,
  type Program,
  type ProgramQuiz,
  type ProgramThread,
  type ThreadKind,
} from "@/lib/elite/program";
import { cn } from "@/lib/utils";

// The 3-month program (065) on the coach's player page. The quiz first
// (who the player is and what holds them back), then the draft it makes,
// then the six half-month focuses and the threads the coach confirms.
// Saving shapes the next week that is not built yet; a week already built
// is never rewritten.

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none";
const labelCls = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40";

const SPANS: { value: string; label: string; from: number; to: number }[] = [
  { value: "1-3", label: "All three months", from: 1, to: 3 },
  { value: "1-2", label: "Months 1 and 2", from: 1, to: 2 },
  { value: "2-3", label: "Months 2 and 3", from: 2, to: 3 },
  { value: "1-1", label: "Month 1 only", from: 1, to: 1 },
  { value: "2-2", label: "Month 2 only", from: 2, to: 2 },
  { value: "3-3", label: "Month 3 only", from: 3, to: 3 },
];

function spanOf(threads: ProgramThread[], kind: ThreadKind): string {
  const t = threads.find((x) => x.kind === kind);
  return t ? `${t.from_block}-${t.to_block}` : "";
}

export function ProgramPanel({
  playerId,
  program,
  counts,
  liveWeek,
  nextWeek,
}: {
  playerId: string;
  program: Program | null;
  counts: Record<string, number>; // focus pillar key -> drills this player can do
  liveWeek: number;
  nextWeek: number; // the first week not built yet
}) {
  const [quiz, setQuiz] = useState<ProgramQuiz>(
    program?.quiz ?? { target: "", injury: "", cleared_to_run: true, limiters: [], goal: "", notes: "" }
  );
  const [focuses, setFocuses] = useState<string[]>(program?.focuses ?? Array(FOCUS_SLOTS).fill(""));
  const [threads, setThreads] = useState<ProgramThread[]>(program?.threads ?? []);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const available = Object.keys(counts).filter((k) => (counts[k] ?? 0) > 0);
  const limiters = quiz.limiters ?? [];
  const now = programWeekFor(program, liveWeek);
  const thin = [...new Set(focuses.filter(Boolean))].filter((k) => (counts[k] ?? 0) < 2);

  const setLimiter = (i: number, key: string) => {
    const next = [...limiters];
    next[i] = key;
    setQuiz({ ...quiz, limiters: next.filter(Boolean) });
  };
  const setFocus = (i: number, key: string) => {
    const next = [...focuses];
    next[i] = key;
    setFocuses(next);
  };
  const setSpan = (kind: ThreadKind, value: string) => {
    const span = SPANS.find((s) => s.value === value);
    const rest = threads.filter((t) => t.kind !== kind);
    setThreads(span ? [...rest, { kind, from_block: span.from, to_block: span.to }] : rest);
  };

  const pillarOptions = (
    <>
      {PROGRAM_CATEGORIES.filter((c) => c.mode === "focus").map((c) => (
        <optgroup key={c.key} label={c.name}>
          {c.pillars.map((p) => {
            const n = counts[p.key] ?? 0;
            return (
              <option key={p.key} value={p.key} disabled={n === 0}>
                {p.name} ({n === 0 ? "no drills yet" : `${n} drill${n === 1 ? "" : "s"}`})
              </option>
            );
          })}
        </optgroup>
      ))}
    </>
  );

  const save = () => {
    setError(null);
    setMessage(null);
    if (focuses.some((f) => !f)) {
      setError("Pick a focus for all six half-months.");
      return;
    }
    start(async () => {
      const res = await saveProgram(playerId, { focuses, threads, quiz });
      if (!res.ok) setError(res.error ?? "Couldn't save.");
      else setMessage(`Saved. The program starts with week ${res.start_week}.`);
    });
  };

  return (
    <div className={cn("elite-card space-y-4 p-5", pending && "opacity-70")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          <CalendarRange className="h-3.5 w-3.5" /> 3-month program
        </div>
        {program && (
          <span className="rounded-full border border-accent/50 bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
            {now ? `Week ${now.index + 1} of ${program.weeks}` : `Starts week ${program.start_week}`}
          </span>
        )}
      </div>
      <p className="text-xs text-white/40">
        {program
          ? now
            ? `This week's focus: ${now.focusName}. Changes apply from the next week built.`
            : `Starts with week ${program.start_week}. Weeks already built are not changed.`
          : `No program yet. Saving one shapes week ${nextWeek} onward; weeks already built are not changed.`}
      </p>

      {/* The quiz */}
      <div className="space-y-3">
        <div>
          <label className={labelCls}>The date or moment that matters</label>
          <input
            value={quiz.target ?? ""}
            onChange={(e) => setQuiz({ ...quiz, target: e.target.value })}
            placeholder="Tryout in March, preseason, back in games by..."
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Injury and what they are cleared for</label>
          <input
            value={quiz.injury ?? ""}
            onChange={(e) => setQuiz({ ...quiz, injury: e.target.value })}
            placeholder="None, or the area and what the PT has cleared"
            className={inputCls}
          />
        </div>
        <label className="flex items-center gap-2.5 text-sm text-white/70">
          <input
            type="checkbox"
            checked={quiz.cleared_to_run !== false}
            onChange={(e) => setQuiz({ ...quiz, cleared_to_run: e.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Cleared to run and sprint
        </label>
        <div>
          <label className={labelCls}>What holds them back most, in order</label>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <select
                key={i}
                value={limiters[i] ?? ""}
                onChange={(e) => setLimiter(i, e.target.value)}
                className={inputCls}
                aria-label={`Limiter ${i + 1}`}
              >
                <option value="">{`${i + 1}. Pick an area`}</option>
                {pillarOptions}
              </select>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>What they want to be known for in three months</label>
          <input
            value={quiz.goal ?? ""}
            onChange={(e) => setQuiz({ ...quiz, goal: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Anything else about this player</label>
          <textarea
            value={quiz.notes ?? ""}
            onChange={(e) => setQuiz({ ...quiz, notes: e.target.value })}
            rows={2}
            className={inputCls}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const draft = draftFocuses(limiters, quiz.cleared_to_run !== false, available);
            if (draft.length === FOCUS_SLOTS) setFocuses(draft);
            else setError("Pick at least one area that has drills.");
          }}
          className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-white/70 hover:border-accent/50 hover:text-accent"
        >
          Draft the three months from these answers
        </button>
      </div>

      {/* The six half-month focuses */}
      <div className="space-y-2 border-t border-white/8 pt-4">
        <div className={labelCls}>Focus, two of every session&apos;s three skill drills</div>
        {focuses.map((f, i) => (
          <div key={i}>
            <div className="mb-1 text-xs text-white/45">{slotLabel(i)}</div>
            <select value={f} onChange={(e) => setFocus(i, e.target.value)} className={inputCls} aria-label={slotLabel(i)}>
              <option value="">Pick a focus</option>
              {pillarOptions}
            </select>
          </div>
        ))}
        {thin.length > 0 && (
          <p className="text-xs text-amber-300/80">
            Thin for this player: {thin.map((k) => `${pillarName(k)} (${counts[k] ?? 0})`).join(", ")}. The same drill
            will repeat inside a session week until more are filmed.
          </p>
        )}
      </div>

      {/* Threads */}
      <div className="space-y-2 border-t border-white/8 pt-4">
        <div className={labelCls}>Runs beside the focus</div>
        {THREAD_KINDS.map((kind) => (
          <div key={kind}>
            <div className="mb-1 text-xs text-white/45">{THREAD_NAMES[kind]}</div>
            <select
              value={spanOf(threads, kind)}
              onChange={(e) => setSpan(kind, e.target.value)}
              className={inputCls}
              aria-label={THREAD_NAMES[kind]}
            >
              <option value="">Off</option>
              {SPANS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-accent">{message}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={pending} className="btn-accent px-5 py-2.5 text-sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : program ? "Save changes" : "Save program"}
        </button>
        {program && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("End this program? Weeks already built stay; the next week goes back to the ordinary build.")) return;
              start(async () => {
                const res = await endProgram(playerId);
                if (!res.ok) setError(res.error ?? "Couldn't end the program.");
                else setMessage("Program ended.");
              });
            }}
            className="text-xs font-semibold uppercase tracking-wider text-white/40 hover:text-red-300"
          >
            End program
          </button>
        )}
      </div>
    </div>
  );
}
