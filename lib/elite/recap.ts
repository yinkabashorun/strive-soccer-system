// The end-of-week parent recap - the accountability text.
//
// After a training week closes, the coach's 99% job is telling the parent
// the truth about it: celebrate a full week loudly, name what got skipped
// plainly. This builds that text FROM THE DATA (sessions actually completed,
// real minutes, the exact sessions missed), so it is instant, always
// accurate, and copy-paste ready. Tone shifts with completion:
//   4/4 -> celebration · 2-3 -> praise + direct nudge · 0-1 -> honest
//   accountability that enlists the parent, never shames the kid.
// No em dashes anywhere; first person coach voice; first name only.

import type { Homework, Player } from "./types";
import { liveWeekNumber } from "./time";

export type WeekRecap = {
  week: number; // the week being recapped (the one that just ended)
  done: number; // sessions fully completed
  total: number; // sessions that existed that week
  minutes: number; // minutes of completed work
  missedTitles: string[]; // headline drill of each missed session
  text: string; // the copy-paste parent text
};

// A session counts as done when every drill in it is checked off - the
// same rule the player's week view uses.
export function buildWeekRecap(
  player: Player,
  homework: Homework[]
): WeekRecap | null {
  const liveWeek = player.week1_monday
    ? liveWeekNumber(player.week1_monday)
    : player.current_week;
  const week = liveWeek - 1;
  if (week < 1) return null; // still in their first week - nothing to recap

  const rows = homework.filter((h) => h.week === week);
  if (rows.length === 0) return null;

  const bySession = new Map<number, Homework[]>();
  for (const h of rows) {
    const s = h.session ?? 1;
    bySession.set(s, [...(bySession.get(s) ?? []), h]);
  }
  const sessions = [...bySession.entries()].sort((a, b) => a[0] - b[0]);
  const total = sessions.length;
  let done = 0;
  const missedTitles: string[] = [];
  let minutes = 0;
  for (const [, drills] of sessions) {
    const complete = drills.every((d) => d.completed);
    if (complete) done += 1;
    else {
      // Headline the session by its first non-warm-up drill.
      const lead =
        drills.find((d) => !/warm.?up|plyo/i.test(d.title)) ?? drills[0];
      missedTitles.push(lead.title);
    }
    for (const d of drills) if (d.completed) minutes += d.duration_min ?? 0;
  }

  const first = player.full_name.split(" ")[0];
  const text = recapText(first, done, total, minutes, missedTitles);
  return { week, done, total, minutes, missedTitles, text };
}

function recapText(
  first: string,
  done: number,
  total: number,
  minutes: number,
  missed: string[]
): string {
  const mins = minutes > 0 ? `${minutes} minutes` : "";

  if (total > 0 && done === total) {
    return (
      `Quick recap on ${first}'s week: all ${total} sessions done, ` +
      `${mins ? mins + " of " : ""}completely self-driven work. ` +
      `Weeks like this are exactly how the change happens, it compounds. ` +
      `Tell ${first} I saw every check mark. This week's plan is already loaded.`
    );
  }

  if (done >= Math.ceil(total / 2)) {
    const missedLine =
      missed.length === 1
        ? `The skipped one was ${missed[0]}, and that is the exact work ${first} needs most.`
        : `The skipped ones were ${missed.slice(0, 2).join(" and ")}, and that is the exact work ${first} needs most.`;
    return (
      `Recap on ${first}'s week: ${done} of ${total} sessions done` +
      `${mins ? `, about ${mins} of real work` : ""}. Good week, not a full one. ` +
      `${missedLine} ` +
      `Let's get all ${total} in this week, that is where the real jump happens. The new plan is loaded.`
    );
  }

  return (
    `Being straight with you about ${first}'s week: ${done} of ${total} sessions got done. ` +
    `No lecture, life gets busy, but the program only works when the reps happen, ` +
    `and right now the reps are not happening. Can you help me get ${first} to open the app ` +
    `after school this week? Even 20 focused minutes a day changes everything. ` +
    `The new week is loaded and waiting, and I am watching for the first check mark.`
  );
}
