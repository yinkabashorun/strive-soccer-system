"use client";

import { useEffect, useState } from "react";
import { Check, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";

// The obsession checklist: small relationship deposits that make families
// love Strive. Resets every Monday (VA time) alongside the training week.
// Stored in localStorage only - this is the coach's private habit tracker,
// not business data.

const DEPOSITS: { id: string; label: string; why: string }[] = [
  {
    id: "specific-texts",
    label: "Two unprompted player-specific texts",
    why: "Specificity is love. Name the exact move, the exact moment.",
  },
  {
    id: "streak-shoutouts",
    label: "Shout out every streak and achievement",
    why: "Celebrate in public. Parents screenshot it.",
  },
  {
    id: "game-touch",
    label: "One sideline appearance or post-game text",
    why: "Being seen caring beats any ad.",
  },
  {
    id: "checkin-replies",
    label: "Reply to every check-in with something specific",
    why: "The check-in is a kid talking to you. Never leave it on read.",
  },
  {
    id: "parent-updates",
    label: "Parent update sent to every active family",
    why: "Generate the week, tap copy, paste. Five seconds each.",
  },
  {
    id: "story-post",
    label: "One player story told (group chat or post)",
    why: "Before and after. Make a kid the protagonist this week.",
  },
];

// This NY week's Monday as YYYY-MM-DD - the storage key, so the list
// resets itself every Monday morning without any server involvement.
function mondayKeyNY(): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = now.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? 6 : day - 1;
  now.setDate(now.getDate() - diff);
  return now.toISOString().slice(0, 10);
}

export function WeeklyDeposits() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  const storageKey = `strive_deposits_${mondayKeyNY()}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(JSON.parse(raw));
    } catch {
      // storage unavailable: the list still works, it just won't persist
    }
    setReady(true);
  }, [storageKey]);

  function toggle(id: string) {
    setDone((s) => {
      const next = { ...s, [id]: !s[id] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // best effort
      }
      return next;
    });
  }

  const count = DEPOSITS.filter((d) => done[d.id]).length;
  const all = count === DEPOSITS.length;

  return (
    <section
      className={cn(
        "rounded-3xl border p-5 transition-colors",
        all ? "border-accent/35 bg-accent/[0.05]" : "border-white/10 bg-white/[0.02]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
          <HeartHandshake className="h-4 w-4 text-accent" /> Weekly deposits
        </h2>
        <span
          className={cn(
            "font-display text-lg font-black",
            all ? "text-accent" : "text-white/40"
          )}
        >
          {count}/{DEPOSITS.length}
        </span>
      </div>
      <p className="mt-1 text-sm text-white/45">
        Obsession is built in ten-minute touches, not campaigns. Resets Monday.
      </p>

      <ul className="mt-3 space-y-1.5">
        {DEPOSITS.map((d) => {
          const checked = Boolean(done[d.id]);
          return (
            <li key={d.id}>
              <button
                onClick={() => toggle(d.id)}
                disabled={!ready}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.99]",
                  checked
                    ? "border-accent/25 bg-accent/[0.04]"
                    : "border-white/8 bg-white/[0.02] hover:border-white/15"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-all",
                    checked
                      ? "border-accent bg-accent text-black"
                      : "border-white/25 text-transparent"
                  )}
                >
                  <Check className="h-3 w-3" strokeWidth={3.5} />
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-semibold",
                      checked ? "text-white/45 line-through" : "text-bone"
                    )}
                  >
                    {d.label}
                  </span>
                  {!checked && (
                    <span className="mt-0.5 block text-xs leading-snug text-white/40">
                      {d.why}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {all && (
        <p className="mt-3 text-sm font-medium text-accent">
          All six in. That is how a program becomes the thing families talk
          about at dinner.
        </p>
      )}
    </section>
  );
}
