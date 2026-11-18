"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Loader2, Play } from "lucide-react";
import { endBreakNow, startBreak } from "@/lib/elite/break-actions";
import { fmtBreakDate, MAX_BREAK_DAYS } from "@/lib/elite/breaks";

// A break is a date, not a penalty (offer stack item 8). Two states:
//   on a break   -> the hero card: when you're back, and "I'm back early"
//   not on one   -> the date picker, opened from the quiet row under the
//                   session card on Home (HomeMore.tsx)
// Nothing here counts what was missed; the week they come back to is the
// week they left (lib/elite/breaks.ts).
export function BreakCard({
  current,
  firstName,
  today,
  onCancel,
}: {
  current: { since: string; until: string } | null;
  firstName: string;
  today: string; // NY date, YYYY-MM-DD, from the server so the picker's floor is right
  onCancel?: () => void; // closes the picker without setting a break
}) {
  const router = useRouter();
  const [until, setUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const maxDay = (() => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + MAX_BREAK_DAYS);
    return d.toISOString().slice(0, 10);
  })();

  function save() {
    setError(null);
    start(async () => {
      const res = await startBreak(until);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCancel?.();
      router.refresh();
    });
  }

  function back() {
    setError(null);
    start(async () => {
      const res = await endBreakNow();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (current) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/[0.03] p-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
          <CalendarOff className="h-3.5 w-3.5" /> On a break
        </div>
        <p className="mt-1.5 font-display text-2xl font-black uppercase leading-tight sm:text-3xl">
          Back {fmtBreakDate(current.until)}, {firstName}.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Your training picks up right where you left off. Nothing you&apos;ve
          done goes anywhere, and nothing new lands until you&apos;re back.
        </p>
        <button
          type="button"
          onClick={back}
          disabled={pending}
          className="btn mt-4 inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          I&apos;m back early
        </button>
        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
      </section>
    );
  }

  return (
    <section className="elite-card p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
        <CalendarOff className="h-3.5 w-3.5" /> Taking a break
      </div>
      <label htmlFor="break-until" className="mt-2 block text-sm leading-relaxed text-white/65">
        Pick the day you&apos;re back. Your training waits for you and picks up right where you
        left off.
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          id="break-until"
          type="date"
          value={until}
          min={today}
          max={maxDay}
          onChange={(e) => setUntil(e.target.value)}
          className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-bone outline-none focus:border-accent/50"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending || !until}
          className="btn inline-flex min-h-[44px] items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Set my break
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              onCancel();
            }}
            className="inline-flex min-h-[44px] items-center px-3 text-sm text-white/60 hover:text-bone"
          >
            Cancel
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
