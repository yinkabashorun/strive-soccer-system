import { describe, expect, it } from "vitest";
import { fmtDuration, timeTrained, weekMinutes } from "@/lib/elite/time-trained";
import type { Homework } from "@/lib/elite/types";

// Offer stack item 8 (Oct 12 2026): progress counts time trained and
// never what was missed. A gap of any length changes none of the numbers.
let n = 0;
function row(p: Partial<Homework> & { week: number; session: number; completed: boolean }): Homework {
  n++;
  return {
    id: `h${n}`,
    player_id: "p",
    title: `Drill ${n}`,
    exercise: "",
    reps: "",
    video_url: "https://v/x",
    notes: null,
    completed_at: p.completed ? `2026-10-0${(n % 9) + 1}T12:00:00.000Z` : null,
    sort: n,
    duration_min: 10,
    pillar: "Ball Mastery",
    ...p,
  } as Homework;
}

const week1 = [
  row({ week: 1, session: 1, completed: true, pillar: "Plyo", duration_min: 5 }),
  row({ week: 1, session: 1, completed: true }),
  row({ week: 1, session: 1, completed: true, pillar: "Confidence" }),
  row({ week: 1, session: 2, completed: true }),
  row({ week: 1, session: 2, completed: false }),
];

describe("timeTrained", () => {
  it("adds every completed minute, counts full sessions and weeks trained", () => {
    const t = timeTrained(week1);
    expect(t.minutes).toBe(35);
    expect(t.sessions).toBe(1); // session 2 has an unfinished drill
    expect(t.weeks).toBe(1);
    expect(t.byPillar).toEqual([
      { pillar: "Ball Mastery", minutes: 20 },
      { pillar: "Confidence", minutes: 10 },
      { pillar: "Plyo", minutes: 5 },
    ]);
  });
  it("a break of any length takes nothing away: weeks 2 to 5 missing, week 6 adds on top", () => {
    const before = timeTrained(week1);
    const after = timeTrained([
      ...week1,
      row({ week: 6, session: 1, completed: true, duration_min: 12 }),
    ]);
    expect(after.minutes).toBe(before.minutes + 12);
    expect(after.weeks).toBe(2);
    expect(after.sessions).toBe(2);
  });
  it("extras count like any session and a drill with no minutes counts 15", () => {
    const t = timeTrained([
      ...week1,
      row({ week: 1, session: 5, completed: true, is_extra: true, duration_min: undefined }),
    ]);
    expect(t.minutes).toBe(50);
    expect(t.sessions).toBe(2);
  });
  it("rows without a pillar (pre-034 legacy, demo) count toward time but not toward a pillar", () => {
    const t = timeTrained([row({ week: 1, session: 1, completed: true, pillar: null })]);
    expect(t.minutes).toBe(10);
    expect(t.byPillar).toEqual([]);
  });
  it("never produces a percentage or a streak", () => {
    const keys = Object.keys(timeTrained(week1));
    expect(keys.some((k) => /pct|percent|streak/i.test(k))).toBe(false);
  });
  it("weekMinutes is one week's completed minutes", () => {
    expect(weekMinutes(week1, 1)).toBe(35);
    expect(weekMinutes(week1, 2)).toBe(0);
  });
});

describe("fmtDuration", () => {
  it("writes time the one way the family sees it", () => {
    expect(fmtDuration(0)).toBe("0m");
    expect(fmtDuration(45)).toBe("45m");
    expect(fmtDuration(60)).toBe("1h");
    expect(fmtDuration(260)).toBe("4h 20m");
  });
});
