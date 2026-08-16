import { Check, Clock } from "lucide-react";
import type { Homework } from "@/lib/elite/types";
import { cn } from "@/lib/utils";

function isPlyo(title: string): boolean {
  return /plyo|warm-?up/i.test(title);
}

// Read-only view of a player's current-week plan for the coach: the four
// sessions and exactly which drills the player has completed. Answers the
// question a coach actually asks — "are they doing the work?"
export function CoachWeekView({
  homework,
  currentWeek,
}: {
  homework: Homework[];
  currentWeek: number;
}) {
  const thisWeek = homework.filter((h) => h.week === currentWeek);

  if (thisWeek.length === 0) {
    return (
      <div className="elite-card p-6 text-sm text-white/45">
        No plan built for week {currentWeek} yet. Use{" "}
        <span className="text-bone">AI Session Notes</span> below to generate
        this week&apos;s four sessions.
      </div>
    );
  }

  const bySession = new Map<number, Homework[]>();
  for (const h of thisWeek) {
    const s = h.session ?? 1;
    const arr = bySession.get(s) ?? [];
    arr.push(h);
    bySession.set(s, arr);
  }
  const sessions = [...bySession.entries()]
    .map(([session, list]) => ({
      session,
      list: [...list].sort((a, b) => a.sort - b.sort),
      done: list.every((h) => h.completed),
    }))
    .sort((a, b) => a.session - b.session);

  const sessionsDone = sessions.filter((s) => s.done).length;

  return (
    <div className="elite-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Week {currentWeek} plan
        </span>
        <span className="font-display text-lg font-black">
          {sessionsDone}
          <span className="text-white/40">/{sessions.length}</span>{" "}
          <span className="text-xs font-medium uppercase tracking-wide text-white/45">
            sessions done
          </span>
        </span>
      </div>

      <div className="space-y-3">
        {sessions.map((s) => (
          <div
            key={s.session}
            className={cn(
              "rounded-2xl border p-3",
              s.done
                ? "border-accent/25 bg-accent/[0.04]"
                : "border-white/8 bg-white/[0.02]"
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-bone">
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-md text-[11px] font-bold",
                    s.done ? "bg-accent text-black" : "bg-white/10 text-white/60"
                  )}
                >
                  {s.session}
                </span>
                Session {s.session}
              </span>
              <span className="text-xs text-white/40">
                {s.list.filter((h) => h.completed).length}/{s.list.length}
              </span>
            </div>
            <ul className="space-y-1">
              {s.list.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 shrink-0 place-items-center rounded-full",
                      h.completed
                        ? "bg-accent text-black"
                        : "border border-white/20"
                    )}
                  >
                    {h.completed && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1.5",
                      h.completed ? "text-white/45 line-through" : "text-white/75"
                    )}
                  >
                    {isPlyo(h.title) && (
                      <span className="rounded bg-red-500/80 px-1 py-0.5 text-[8px] font-bold uppercase text-white">
                        Plyo
                      </span>
                    )}
                    {h.title}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-white/35">
                    <Clock className="h-3 w-3" />
                    {h.duration_min ?? 15}m
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
