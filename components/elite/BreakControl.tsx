"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Loader2 } from "lucide-react";
import { coachEndBreak, coachSetBreak } from "@/lib/elite/break-actions";
import { fmtBreakDate, MAX_BREAK_DAYS } from "@/lib/elite/breaks";
import type { TrainingBreak } from "@/lib/elite/types";

// Coach side of a break (034): set a return date for a family (or move
// it), end one early, see the history. While a break is on, the builder,
// the audit, the Monday unlock and every text leave this player alone;
// on return the program clock moves so they resume the week they left.
export function BreakControl({
  playerId,
  breaks,
  today,
}: {
  playerId: string;
  breaks: TrainingBreak[];
  today: string;
}) {
  const router = useRouter();
  const current = breaks.find((b) => b.since <= today && today <= b.until) ?? null;
  const [until, setUntil] = useState(current?.until ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const history = breaks.filter((b) => b.until < today);

  const maxDay = (() => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + MAX_BREAK_DAYS);
    return d.toISOString().slice(0, 10);
  })();

  function save() {
    setError(null);
    start(async () => {
      const res = await coachSetBreak(playerId, until, note);
      if (!res.ok) return setError(res.error);
      setNote("");
      router.refresh();
    });
  }
  function end() {
    setError(null);
    start(async () => {
      const res = await coachEndBreak(playerId);
      if (!res.ok) return setError(res.error);
      setUntil("");
      router.refresh();
    });
  }

  return (
    <div className="elite-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          <CalendarOff className="h-3.5 w-3.5" /> Break
        </div>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />}
      </div>

      {current ? (
        <p className="text-sm text-white/75">
          On a break since {fmtBreakDate(current.since)}, back {fmtBreakDate(current.until)}.
          {current.note ? <span className="text-white/45"> {current.note}</span> : null}
        </p>
      ) : (
        <p className="text-sm text-white/45">
          Not on a break. Set one when the family is away: nothing is built or sent
          until the return date, and they pick up the week they left.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={until}
          min={today}
          max={maxDay}
          onChange={(e) => setUntil(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-bone outline-none focus:border-accent/50"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-bone outline-none placeholder:text-white/25 focus:border-accent/50"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !until}
          className="btn px-4 py-2 text-sm disabled:opacity-50"
        >
          {current ? "Move return date" : "Set break"}
        </button>
        {current && (
          <button
            type="button"
            onClick={end}
            disabled={pending}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:border-white/30 disabled:opacity-50"
          >
            End break today
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {history.length > 0 && (
        <div className="mt-4 border-t border-white/6 pt-3 text-xs text-white/40">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Past breaks
          </div>
          {history.slice(0, 5).map((b) => (
            <div key={b.id}>
              {fmtBreakDate(b.since)} to {fmtBreakDate(b.until)}
              {b.note ? ` · ${b.note}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
