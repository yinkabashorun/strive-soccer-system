"use client";

import { useState, useTransition } from "react";
import { Loader2, PlayCircle, Send } from "lucide-react";
import type { FilmUpload } from "@/lib/elite/types";
import { setFilmNotes } from "@/lib/elite/coach-actions";
import { timeAgo } from "@/lib/utils";

// Coach view of the monthly film submissions: watch the link, write the
// breakdown, send. Feedback notifies the player automatically.
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

function FilmRow({ playerId, film }: { playerId: string; film: FilmUpload }) {
  const [notes, setNotes] = useState(film.coach_notes ?? "");
  const [sent, setSent] = useState(Boolean(film.coach_notes));
  const [pending, start] = useTransition();

  function send() {
    const body = notes.trim();
    if (!body) return;
    start(async () => {
      await setFilmNotes(film.id, playerId, body);
      setSent(true);
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
          {sent ? "Reviewed" : "Awaiting your review"}
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

      {sent ? (
        <div className="mt-3 rounded-2xl border border-accent/20 bg-accent/[0.05] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            Your breakdown
          </div>
          <p className="mt-1 whitespace-pre-line text-sm text-white/75">{notes}</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What you saw, what to fix, what to keep doing…"
            className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm leading-relaxed text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
          />
          <button
            onClick={send}
            disabled={pending || !notes.trim()}
            className="btn-accent px-4 py-2 text-sm"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send review
          </button>
        </div>
      )}
    </div>
  );
}
