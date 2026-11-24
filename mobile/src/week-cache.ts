import type { AppWeek } from "@shared/app-contract";
import { oneMoreLine } from "@shared/session-flow";
import { cappedSeconds, creditedMinutes } from "@shared/time-trained";

// A drill ticked on the phone shows at once (an optimistic update), before
// the server has answered. This is that change to the cached week, worked
// out by the same rules the server uses (lib/elite/app-payload.ts), so the
// screen and the next fetch agree. Pure, tested in tests/week-cache.test.ts.
//
// `seconds` is the time the session player measured for the drill. What it
// adds is worked out by the server's own rule (creditedMinutes), so the
// figure on the phone before the save and the figure after it are the same.
export function applyDone(week: AppWeek, drillId: string, completed: boolean, seconds?: number): AppWeek {
  let deltaMinutes = 0;
  let changed = false;
  const sessions = week.sessions.map((s) => {
    if (!s.drills.some((d) => d.id === drillId)) return s;
    const drills = s.drills.map((d) => {
      if (d.id !== drillId || d.completed === completed) return d;
      const trained = creditedMinutes({ completed, duration_min: d.minutes, actual_seconds: cappedSeconds(seconds, d.minutes) });
      deltaMinutes += trained - (d.trained ?? 0);
      changed = true;
      return { ...d, completed, trained };
    });
    const done = drills.filter((d) => d.completed).length;
    return { ...s, drills, done, complete: drills.length > 0 && done === drills.length };
  });
  if (!changed) return week;

  const plan = sessions.filter((s) => !s.extra);
  const left = plan.filter((s) => !s.complete).length;
  const current = sessions.find((s) => !s.complete)?.n ?? null;
  const ladder = week.ladder.map((r) =>
    r.key === "week" ? { ...r, value: `${plan.length - left} of ${plan.length}` } : r
  );
  return {
    ...week,
    sessions,
    current,
    sessionsLeft: left,
    weekDone: sessions.length > 0 && current === null,
    oneMore: oneMoreLine(left),
    ladder,
    totalMinutes: Math.max(0, week.totalMinutes + deltaMinutes),
  };
}
