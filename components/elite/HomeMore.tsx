"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarOff, MessageSquare, Plus, type LucideIcon } from "lucide-react";
import { homeMoreItems, type HomeMoreKey } from "@/lib/elite/home";
import { ExtraWork } from "./ExtraWork";
import { BreakCard } from "./BreakCard";
import { cn } from "@/lib/utils";

const ICON: Record<HomeMoreKey, LucideIcon> = {
  extra: Plus,
  coach: MessageSquare,
  break: CalendarOff,
};

// The one quiet row under the session card on Home (lib/elite/home.ts):
// Extra work, the coach's latest note, Take a break. Each is one tap and
// opens in place; nothing is open until asked for, so the Start button
// above has the screen to itself.
export function HomeMore({
  extra,
  note,
  breakFrom,
}: {
  // Extra work: shown once the week exists.
  extra: { hasWall: boolean; blocked: string | null } | null;
  // The coach's latest message to this player.
  note: { body: string; when: string } | null;
  // A real member not on a break: their first name and today's NY date.
  breakFrom: { firstName: string; today: string } | null;
}) {
  const [open, setOpen] = useState<HomeMoreKey | null>(null);
  const items = homeMoreItems({
    hasWeek: Boolean(extra),
    hasCoachNote: Boolean(note),
    canSetBreak: Boolean(breakFrom),
  });
  if (items.length === 0) return null;

  return (
    <section aria-label="More">
      <div
        className={cn(
          "grid gap-2",
          items.length === 1 ? "grid-cols-1" : items.length === 2 ? "grid-cols-2" : "grid-cols-3"
        )}
      >
        {items.map((item) => {
          const Icon = ICON[item.key];
          const on = open === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-expanded={on}
              aria-controls={`home-more-${item.key}`}
              onClick={() => setOpen(on ? null : item.key)}
              className={cn(
                "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-[13px] font-semibold transition-colors",
                on
                  ? "border-white/25 bg-white/[0.06] text-bone"
                  : "border-white/[0.08] bg-white/[0.02] text-white/70"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", on ? "text-accent" : "text-white/50")} />
              {item.label}
            </button>
          );
        })}
      </div>

      {open === "extra" && extra && (
        <div id="home-more-extra" className="mt-3 animate-fade-up">
          <ExtraWork hasWall={extra.hasWall} blocked={extra.blocked} />
        </div>
      )}

      {open === "coach" && note && (
        <div id="home-more-coach" className="elite-card mt-3 p-5 animate-fade-up">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            <MessageSquare className="h-3.5 w-3.5" /> From your coach · {note.when}
          </div>
          <p className="mt-2 select-text text-[15px] leading-relaxed text-white/80">“{note.body}”</p>
          <Link
            href="/messages"
            className="btn mt-3 inline-flex min-h-[44px] items-center px-4 text-sm"
          >
            Reply to your coach
          </Link>
        </div>
      )}

      {open === "break" && breakFrom && (
        <div id="home-more-break" className="mt-3 animate-fade-up">
          <BreakCard
            current={null}
            firstName={breakFrom.firstName}
            today={breakFrom.today}
            onCancel={() => setOpen(null)}
          />
        </div>
      )}
    </section>
  );
}
