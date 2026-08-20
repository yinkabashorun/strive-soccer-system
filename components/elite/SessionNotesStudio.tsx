"use client";

import { useState, useTransition } from "react";
import {
  Brain,
  Check,
  CheckCircle2,
  Loader2,
  Save,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import type { GeneratedPlan } from "@/lib/elite/types";
import { applyGeneratedPlan } from "@/lib/elite/coach-actions";
import { cn } from "@/lib/utils";

const EXAMPLE = `Today we worked on scanning before receiving. Body shape needs to be quicker — he's still square-on when the ball arrives. Composure was better under pressure.

Homework:
200 wall passes
Watch Rodri clips on body orientation
Practice opening hips before the first touch`;

export function SessionNotesStudio({ playerId }: { playerId: string }) {
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [source, setSource] = useState<"ai" | "fallback" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedInfo, setSavedInfo] = useState<{
    week?: number;
    goesLiveNow?: boolean;
  } | null>(null);
  const [isSaving, startSave] = useTransition();

  // --- draft editing: the coach approves by editing then publishing ---
  function editDrill(
    si: number,
    di: number,
    patch: Partial<GeneratedPlan["sessions"][number]["drills"][number]>
  ) {
    setPlan((p) => {
      if (!p) return p;
      const sessions = p.sessions.map((s, i) =>
        i !== si
          ? s
          : {
              ...s,
              drills: s.drills.map((d, j) => (j !== di ? d : { ...d, ...patch })),
            }
      );
      return { ...p, sessions };
    });
    setSaved(false);
  }

  function removeDrill(si: number, di: number) {
    setPlan((p) => {
      if (!p) return p;
      const sessions = p.sessions.map((s, i) =>
        i !== si ? s : { ...s, drills: s.drills.filter((_, j) => j !== di) }
      );
      return { ...p, sessions };
    });
    setSaved(false);
  }

  function editSessionTitle(si: number, title: string) {
    setPlan((p) => {
      if (!p) return p;
      const sessions = p.sessions.map((s, i) =>
        i !== si ? s : { ...s, title }
      );
      return { ...p, sessions };
    });
    setSaved(false);
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/elite/ai/session-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "notes_required" ? "Add a few notes first." : "Generation failed.");
        setLoading(false);
        return;
      }
      setPlan(data.plan);
      setSource(data.source);
    } catch {
      setError("Something went wrong. Try again.");
    }
    setLoading(false);
  }

  function save() {
    if (!plan) return;
    startSave(async () => {
      const res = await applyGeneratedPlan(playerId, notes, plan);
      setSaved(true);
      setSavedInfo(res && "week" in res ? (res as { week?: number; goesLiveNow?: boolean }) : null);
    });
  }

  return (
    <div className="elite-card overflow-hidden">
      <div className="border-b border-white/6 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          <Brain className="h-4 w-4" /> AI session notes
        </div>
        <h3 className="mt-1 font-display text-2xl font-bold uppercase tracking-tight">
          Type the session. Get the whole plan.
        </h3>
        <p className="mt-1 text-sm text-white/50">
          Write notes in plain English. Strive AI drafts the weekly focus,
          homework, progress updates, and the parent report.
        </p>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          placeholder={EXAMPLE}
          className="mt-4 w-full resize-y rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={generate}
            disabled={loading || notes.trim().length < 4}
            className="btn-accent px-5 py-3"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? "Generating…" : "Generate plan"}
          </button>
          {!notes && (
            <button
              onClick={() => setNotes(EXAMPLE)}
              className="btn-ghost text-xs"
            >
              Use an example
            </button>
          )}
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </div>

      {plan && (
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="chip-accent">
              {source === "ai" ? "Generated by Strive AI" : "Draft (template)"}
            </div>
            {saved ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-accent">
                <CheckCircle2 className="h-4 w-4" />
                {savedInfo?.goesLiveNow
                  ? `Published — week ${savedInfo.week ?? ""} is live now`
                  : `Approved — week ${savedInfo?.week ?? ""} unlocks Monday morning`}
              </span>
            ) : (
              <div className="text-right">
                <button
                  onClick={save}
                  disabled={isSaving}
                  className="btn-accent px-4 py-2 text-sm"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Approve &amp; publish
                </button>
                <div className="mt-1 text-[11px] text-white/40">
                  Tap any drill to edit before publishing · unlocks Monday
                  (a player&apos;s first week goes live instantly)
                </div>
              </div>
            )}
          </div>

          {/* Weekly focus */}
          <Block icon={Target} title="Weekly focus">
            <p className="text-lg font-medium text-bone">{plan.weekly_focus}</p>
          </Block>

          {/* Four sessions — a fully editable draft until published */}
          <Block icon={Check} title="The week · 4 sessions · tap to edit">
            <div className="space-y-3">
              {plan.sessions.map((s, si) => (
                <div
                  key={si}
                  className="rounded-2xl border border-white/8 bg-white/[0.02] p-3"
                >
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-accent/15 font-display">
                      {si + 1}
                    </span>
                    <input
                      value={s.title}
                      onChange={(e) => editSessionTitle(si, e.target.value)}
                      disabled={saved}
                      className="w-full bg-transparent uppercase tracking-[0.18em] text-accent outline-none placeholder:text-white/25 focus:text-bone"
                    />
                  </div>
                  <ul className="space-y-1.5">
                    {s.drills.map((d, di) => {
                      const isPlyo = di === 0;
                      return (
                        <li
                          key={di}
                          className={
                            "rounded-xl border p-2.5 " +
                            (isPlyo
                              ? "border-red-500/25 bg-red-500/[0.04]"
                              : "border-white/6 bg-white/[0.02]")
                          }
                        >
                          {isPlyo ? (
                            // The plyo warm-up is the method — not editable.
                            <>
                              <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2 font-medium text-bone">
                                  <span className="rounded bg-red-500/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                                    Plyo
                                  </span>
                                  {d.title}
                                </span>
                                <span className="chip shrink-0 whitespace-nowrap">
                                  {d.reps}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-white/55">
                                {d.exercise}
                              </p>
                            </>
                          ) : (
                            <>
                              {/* Edits happen in place — the draft looks
                                  exactly like the published plan. */}
                              <div className="flex items-center gap-2">
                                <input
                                  value={d.title}
                                  onChange={(e) =>
                                    editDrill(si, di, { title: e.target.value })
                                  }
                                  disabled={saved}
                                  className="min-w-0 flex-1 bg-transparent font-medium text-bone outline-none placeholder:text-white/25 focus:text-accent"
                                  placeholder="Drill name"
                                />
                                <span className="chip shrink-0">
                                  <input
                                    value={d.reps}
                                    onChange={(e) =>
                                      editDrill(si, di, { reps: e.target.value })
                                    }
                                    disabled={saved}
                                    size={Math.max(3, d.reps.length)}
                                    className="bg-transparent text-right uppercase tracking-[0.14em] outline-none"
                                    aria-label="Reps"
                                  />
                                </span>
                                <span className="chip shrink-0 whitespace-nowrap">
                                  <input
                                    type="number"
                                    min={5}
                                    max={30}
                                    value={d.minutes ?? 10}
                                    onChange={(e) =>
                                      editDrill(si, di, {
                                        minutes: Number(e.target.value),
                                      })
                                    }
                                    disabled={saved}
                                    className="no-spin w-7 bg-transparent text-right outline-none"
                                    aria-label="Minutes"
                                  />
                                  min
                                </span>
                                {!saved && (
                                  <button
                                    onClick={() => removeDrill(si, di)}
                                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/20 transition-colors hover:text-red-400"
                                    aria-label="Remove drill"
                                    title="Remove drill"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                              <textarea
                                value={d.exercise}
                                onChange={(e) =>
                                  editDrill(si, di, { exercise: e.target.value })
                                }
                                disabled={saved}
                                rows={2}
                                className="mt-1 w-full resize-none bg-transparent text-xs leading-snug text-white/55 outline-none focus:text-white/80"
                              />
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Block>

          {/* Progress updates */}
          {plan.progress_updates.length > 0 && (
            <Block icon={TrendingUp} title="Progress updates">
              <div className="flex flex-wrap gap-2">
                {plan.progress_updates.map((p) => (
                  <span
                    key={p.metric}
                    className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/[0.06] px-3 py-1.5 text-sm"
                  >
                    <span className="text-white/70">{p.metric}</span>
                    <span className="font-display font-bold text-accent">
                      {p.value}
                    </span>
                  </span>
                ))}
              </div>
            </Block>
          )}

          {/* Parent update */}
          <Block icon={Users} title="Parent update">
            <p className="text-sm leading-relaxed text-white/70">
              {plan.parent_update}
            </p>
          </Block>

          {/* Player summary */}
          <Block icon={Sparkles} title="For the player">
            <p className="text-sm leading-relaxed text-white/70">
              {plan.player_summary}
            </p>
          </Block>

          {/* Next objectives */}
          {plan.next_week_objectives.length > 0 && (
            <Block icon={Target} title="Next week's objectives">
              <ul className="space-y-1.5">
                {plan.next_week_objectives.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {o}
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </div>
      )}
    </div>
  );
}

function Block({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Target;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </div>
  );
}
