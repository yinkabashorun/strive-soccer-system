import type { AppWeek } from "@shared/app-contract";
import { oneMoreLine } from "@shared/session-flow";

// A drill ticked on the phone shows at once (an optimistic update), before
// the server has answered. This is that change to the cached week, worked
// out by the same rules the server uses (lib/elite/app-payload.ts), so the
// screen and the next fetch agree. Pure, tested in tests/week-cache.test.ts.
export function applyDone(week: AppWeek, drillId: string, completed: boolean): AppWeek {
  let deltaMinutes = 0;
  const sessions = week.sessions.map((s) => {
    if (!s.drills.some((d) => d.id === drillId)) return s;
    const drills = s.drills.map((d) => {
      if (d.id !== drillId || d.completed === completed) return d;
      deltaMinutes += completed ? d.minutes : -d.minutes;
      return { ...d, completed };
    });
    const done = drills.filter((d) => d.completed).length;
    return { ...s, drills, done, complete: drills.length > 0 && done === drills.length };
  });
  if (deltaMinutes === 0) return week;

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
