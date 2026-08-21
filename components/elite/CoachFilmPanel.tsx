"use client";

import { useState, useTransition } from "react";
import { Loader2, PlayCircle, Send } from "lucide-react";
import type { FilmMoment, FilmReview, FilmUpload } from "@/lib/elite/types";
import { sendFilmReview } from "@/lib/elite/coach-actions";
import { FilmReviewView } from "@/components/elite/FilmReviewView";
import { timeAgo } from "@/lib/utils";

// Coach view of the monthly film submissions: watch the link, compose the
// structured breakdown (summary, timestamped moments, strengths, fixes,
// next steps), send. The player gets the same deep layout + a notification.
export function CoachFilmPanel({
  playerId,
  films,
}: {
  playerId: string;
  films: FilmUpload[];
}) {
  const sorted = [...films].sort((a, b) => (b.month ?? 1) - (a.month ?? 1));
  if (films.length === 0) {
    return (
      <div className="elite-card p-6 text-center text-sm text-white/40">
        No film yet. Their monthly submission will land here — watch it, then
        drop the breakdown.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {sorted.map((f) => (
        <FilmRow key={f.id} playerId={playerId} film={f} />
      ))}
    </div>
  );
}

// "12:30 + note" / "12:30 - note" / "12:30 note" → a FilmMoment per line.
// A leading + marks a highlight, a leading - a teaching point; no sign
// defaults to a highlight. The timestamp is optional.
function parseMoments(text: string): FilmMoment[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const t = l.match(/^(\d{1,3}:\d{2})\s*/);
      const time = t ? t[1] : "";
      let rest = t ? l.slice(t[0].length) : l;
      let kind: FilmMoment["kind"] = "good";
      const sign = rest.match(/^([+\-–—])\s*/);
      if (sign) {
        kind = sign[1] === "+" ? "good" : "fix";
        rest = rest.slice(sign[0].length);
      }
      return { time, note: rest.trim(), kind };
    })
    .filter((m) => m.note);
}

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

// Turn a stored review back into composer text so a sent breakdown can be
// reopened and refined.
function momentsToText(moments: FilmMoment[]): string {
  return moments
    .map((m) => `${m.time ? m.time + " " : ""}${m.kind === "good" ? "+" : "-"} ${m.note}`)
    .join("\n");
}

function FilmRow({ playerId, film }: { playerId: string; film: FilmUpload }) {
  const existing = film.review ?? null;
  const [summary, setSummary] = useState(existing?.summary ?? film.coach_notes ?? "");
  const [momentsText, setMomentsText] = useState(existing ? momentsToText(existing.moments) : "");
  const [strengthsText, setStrengthsText] = useState(existing?.strengths.join("\n") ?? "");
  const [fixesText, setFixesText] = useState(existing?.fixes.join("\n") ?? "");
  const [stepsText, setStepsText] = useState(existing?.next_steps.join("\n") ?? "");
  const [sentReview, setSentReview] = useState<FilmReview | null>(existing);
  const [editing, setEditing] = useState(!existing && !film.coach_notes);
  const [pending, start] = useTransition();

  const legacyOnly = !sentReview && Boolean(film.coach_notes) && !editing;

  function send() {
    const review: FilmReview = {
      summary: summary.trim(),
      moments: parseMoments(momentsText),
      strengths: lines(strengthsText),
      fixes: lines(fixesText),
      next_steps: lines(stepsText),
    };
    if (!review.summary) return;
    start(async () => {
      await sendFilmReview(film.id, playerId, review);
      setSentReview(review);
      setEditing(false);
    });
  }

  return (
    <div className="elite-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          Month {film.month ?? 1}
        </div>
        <div className="text-xs text-white/40">
          {timeAgo(film.created_at)} ·{" "}
          {sentReview || legacyOnly ? "Reviewed" : "Awaiting your review"}
        </div>
      </div>

      {film.url && (
        <a
          href={film.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-2 text-sm text-white/80 underline-offset-2 hover:text-accent hover:underline"
        >
          <PlayCircle className="h-4 w-4 shrink-0 text-accent" />
          <span className="truncate">{film.title || film.url}</span>
        </a>
      )}

      {!editing && sentReview ? (
        <div className="mt-3 rounded-2xl border border-accent/20 bg-accent/[0.05] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Your breakdown
            </div>
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] font-medium text-white/40 transition-colors hover:text-bone"
            >
              Edit
            </button>
          </div>
          <FilmReviewView review={sentReview} compact />
        </div>
      ) : legacyOnly ? (
        <div className="mt-3 rounded-2xl border border-accent/20 bg-accent/[0.05] p-3">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Your breakdown
            </div>
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] font-medium text-white/40 transition-colors hover:text-bone"
            >
              Upgrade to full breakdown
            </button>
          </div>
          <p className="whitespace-pre-line text-sm text-white/75">
            {film.coach_notes}
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <Field label="The big picture" hint="What you saw overall — their headline.">
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="You played brave — that's the headline…"
              className={inputCls}
            />
          </Field>
          <Field
            label="Key moments"
            hint="One per line. 12:30 + what to keep · 12:30 - what to fix."
          >
            <textarea
              rows={3}
              value={momentsText}
              onChange={(e) => setMomentsText(e.target.value)}
              placeholder={"04:12 + body feint into space — exactly what we drilled\n12:30 - runner in behind, never scanned"}
              className={inputCls}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="What's working" hint="One per line.">
              <textarea
                rows={3}
                value={strengthsText}
                onChange={(e) => setStrengthsText(e.target.value)}
                placeholder="Take-on bravery — 6 attempted, 4 clean"
                className={inputCls}
              />
            </Field>
            <Field label="What we're fixing" hint="One per line.">
              <textarea
                rows={3}
                value={fixesText}
                onChange={(e) => setFixesText(e.target.value)}
                placeholder="Exit speed after the move"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Next steps" hint="One per line — their marching orders.">
            <textarea
              rows={2}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder="Every take-on rep ends with a two-step burst"
              className={inputCls}
            />
          </Field>
          <button
            onClick={send}
            disabled={pending || !summary.trim()}
            className="btn-accent px-4 py-2 text-sm"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send breakdown
          </button>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm leading-relaxed text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {label}
        </span>
        <span className="truncate text-[10px] text-white/25">{hint}</span>
      </div>
      {children}
    </div>
  );
}
