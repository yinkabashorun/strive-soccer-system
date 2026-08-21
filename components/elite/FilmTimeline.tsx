"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Clapperboard, Loader2, Lock, PlayCircle } from "lucide-react";
import type { FilmUpload } from "@/lib/elite/types";
import { submitFilm } from "@/lib/elite/player-actions";
import { FilmReviewView } from "@/components/elite/FilmReviewView";
import { cn, timeAgo } from "@/lib/utils";

// Month 1 / Month 2 / Month 3 film timeline. One video link per program
// month: the current month takes a submission, past months show the film
// + the coach's review, future months are locked.
export function FilmTimeline({
  films,
  currentMonth,
  firstName,
}: {
  films: FilmUpload[];
  currentMonth: number;
  firstName: string;
}) {
  // Always show at least three months - the program's arc.
  const monthsToShow = Math.max(3, currentMonth);
  const byMonth = new Map<number, FilmUpload>();
  for (const f of films) byMonth.set(f.month ?? 1, f);

  return (
    <div className="space-y-4">
      {Array.from({ length: monthsToShow }, (_, i) => i + 1).map((m) => {
        const film = byMonth.get(m);
        const locked = m > currentMonth;
        return (
          <MonthCard
            key={m}
            month={m}
            film={film}
            locked={locked}
            isCurrent={m === currentMonth}
            firstName={firstName}
          />
        );
      })}
    </div>
  );
}

function MonthCard({
  month,
  film,
  locked,
  isCurrent,
  firstName,
}: {
  month: number;
  film?: FilmUpload;
  locked: boolean;
  isCurrent: boolean;
  firstName: string;
}) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await submitFilm({ url, note });
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      setDone(true);
    });
  }

  const label = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
        <Clapperboard className="h-3.5 w-3.5 text-accent" /> Month {month}
      </div>
      {film?.status === "Reviewed" ? (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-accent">
          <CheckCircle2 className="h-3.5 w-3.5" /> Reviewed
        </span>
      ) : film || done ? (
        <span className="text-[11px] text-white/45">With your coach</span>
      ) : locked ? (
        <span className="flex items-center gap-1 text-[11px] text-white/30">
          <Lock className="h-3 w-3" /> Unlocks month {month}
        </span>
      ) : null}
    </div>
  );

  if (locked) {
    return (
      <section className="rounded-3xl border border-white/6 bg-white/[0.01] p-5 opacity-60">
        {label}
        <p className="mt-2 text-sm text-white/35">Keep stacking weeks.</p>
      </section>
    );
  }

  if (film || done) {
    return (
      <section
        className={cn(
          "rounded-3xl border p-5",
          film?.review || film?.coach_notes
            ? "border-accent/25 bg-accent/[0.04]"
            : "border-white/10 bg-white/[0.02]"
        )}
      >
        {label}
        {film?.url && (
          <a
            href={film.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center gap-2 text-sm text-white/75 underline-offset-2 hover:text-accent hover:underline"
          >
            <PlayCircle className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">{film.title || "Watch your film"}</span>
          </a>
        )}
        {film?.review ? (
          <div className="mt-3 rounded-2xl border border-white/8 bg-black/40 p-4 sm:p-5">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
              Coach&apos;s breakdown
            </div>
            <FilmReviewView review={film.review} />
          </div>
        ) : film?.coach_notes ? (
          <div className="mt-3 rounded-2xl border border-white/8 bg-black/40 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Coach&apos;s review
            </div>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-white/80">
              {film.coach_notes}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-white/50">
            Film received{film ? ` ${timeAgo(film.created_at)}` : ""}. Your
            coach is reviewing it, {firstName}. The breakdown lands here.
          </p>
        )}
      </section>
    );
  }

  // current month, nothing submitted yet
  return (
    <section
      className={cn(
        "rounded-3xl border p-5",
        isCurrent ? "border-white/15 bg-white/[0.03]" : "border-white/10 bg-white/[0.02]"
      )}
    >
      {label}
      <p className="mt-2 text-sm text-white/60">
        Drop a link to game or training footage (Veo, Hudl, YouTube, anything
        watchable). Coach breaks it down once a month.
      </p>
      <div className="mt-3 space-y-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https:// your video link"
          inputMode="url"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What should Coach look at? (optional)"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          onClick={submit}
          disabled={pending || !url.trim()}
          className="btn-accent w-full py-2.5"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            `Submit month ${month} film`
          )}
        </button>
      </div>
    </section>
  );
}
