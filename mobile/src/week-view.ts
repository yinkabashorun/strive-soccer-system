import type { AppSession, AppWeek } from "@shared/app-contract";

// The Week tab, worked out: which session is which, and the words on it.
// Pure, tested in tests/logic.test.ts.
//
// A week reads as a path, top to bottom, in the order the coach built it:
//
//   done   a session with every drill ticked off: a short row, gold tick
//   next   the session the week is waiting on: the one big card, with Start
//   open   a session still ahead: a quieter photo card
//
// Nothing here says a session was missed or is late: a session is done,
// next or ahead, and that is all (Oct 12 2026: a break never costs).

export type RowState = "done" | "next" | "open";

export type WeekRow = {
  s: AppSession;
  state: RowState;
  // the path's line above and below this row is gold once the session it
  // leaves is done
  lineAbove: "gold" | "grey" | null;
  lineBelow: "gold" | "grey" | null;
};

export function weekRows(w: Pick<AppWeek, "sessions" | "current">): WeekRow[] {
  return w.sessions.map((s, i) => {
    const before = w.sessions[i - 1];
    const last = i === w.sessions.length - 1;
    return {
      s,
      state: s.complete ? "done" : s.n === w.current ? "next" : "open",
      lineAbove: before ? (before.complete ? "gold" : "grey") : null,
      lineBelow: last ? null : s.complete ? "gold" : "grey",
    };
  });
}

// The actual minutes of the drills done this week, extra sessions included.
export function weekMinutesDone(sessions: readonly AppSession[]): number {
  let m = 0;
  for (const s of sessions) for (const d of s.drills) if (d.completed) m += d.trained ?? 0;
  return m;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The line under the week's focus: what is done of the plan, and the
// minutes it added up to. Before the first session it says what the week
// holds, never "0 of 4".
export function weekSummary(w: Pick<AppWeek, "sessions">): string {
  const plan = w.sessions.filter((s) => !s.extra);
  const done = plan.filter((s) => s.complete).length;
  const minutes = weekMinutesDone(w.sessions);
  const trained = minutes > 0 ? ` · ${minutes} min trained` : "";
  if (plan.length === 0) return trained ? `${minutes} min trained this week` : "";
  if (done === 0) return `${count(plan.length, "session", "sessions")} this week${trained}`;
  if (done === plan.length) return `All ${count(plan.length, "session", "sessions")} done${trained}`;
  return `${done} of ${count(plan.length, "session", "sessions")} done${trained}`;
}

// The words on the big card.
export function nextCard(s: AppSession): { eyebrow: string; line: string; button: string } {
  const started = s.done > 0 && s.done < s.total;
  return {
    eyebrow: started ? "Keep going" : "Up next",
    line: started
      ? `${s.done} of ${count(s.total, "drill", "drills")} done · ${s.minutesTotal} min`
      : `${count(s.total, "drill", "drills")} · ${s.minutesTotal} min`,
    button: started ? "Continue" : "Start",
  };
}

// The line on a session that is not the big card.
export function rowLine(s: AppSession, state: RowState): string {
  const what = s.headline ? `${s.headline} · ` : "";
  if (state !== "done") return `${what}${count(s.total, "drill", "drills")} · ${s.minutesTotal} min`;
  // a finished session shows the time it really took
  const trained = s.drills.reduce((m, d) => m + (d.completed ? d.trained ?? 0 : 0), 0);
  return `${what}${trained} min`;
}

// The drill stills on the big card: five at most, then "+N".
export const NEXT_STILLS = 5;
export function nextStills(s: AppSession): { stills: { id: string; poster: string | null; done: boolean }[]; more: number } {
  const shown = s.drills.slice(0, NEXT_STILLS);
  return {
    stills: shown.map((d) => ({ id: d.id, poster: d.poster, done: d.completed })),
    more: s.drills.length - shown.length,
  };
}
