import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Homework } from "@/lib/elite/types";
import {
  afterSessionLine,
  canSendClip,
  drillKind,
  drillName,
  dropStartLabel,
  feelEnabled,
  groupSessions,
  hapticFor,
  isDone,
  lastWeekLine,
  nextStep,
  sessionName,
  sessionProgress,
} from "@/lib/elite/session-flow";
import { timeTrained } from "@/lib/elite/time-trained";
import { memberTabs } from "@/lib/elite/experience";

const root = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

let seq = 0;
function hw(over: Partial<Homework>): Homework {
  seq++;
  return {
    id: `h${seq}`,
    player_id: "p1",
    week: 7,
    session: 1,
    title: "Wall pass, touch, stepover",
    exercise: "",
    reps: "3 x 90 sec",
    duration_min: 6,
    video_url: "/drills/x.mp4",
    notes: null,
    completed: false,
    completed_at: null,
    sort: seq,
    ...over,
  };
}

describe("what kind of drill a row is, and what it is called", () => {
  it("reads the bank's two labels", () => {
    expect(drillKind("Plyo warm-up: Pogo jumps")).toBe("warmup");
    expect(drillKind("Strength: Front plank")).toBe("finisher");
    expect(drillKind("Wall pass, touch, stepover")).toBe("skill");
    expect(drillKind("Juggling: one touch, catch")).toBe("skill");
  });

  it("drops the label from the name, since the screen shows it as a badge", () => {
    expect(drillName("Plyo warm-up: Pogo jumps")).toBe("Pogo jumps");
    expect(drillName("Strength: Front plank")).toBe("Front plank");
    expect(drillName("Speed: Kneel and drive")).toBe("Speed: Kneel and drive");
    expect(drillName("Strength:")).toBe("Strength:");
  });

  it("Send a clip stays on skill drills only", () => {
    expect(canSendClip("Wall pass, touch, stepover")).toBe(true);
    expect(canSendClip("Plyo warm-up: Pogo jumps")).toBe(false);
    expect(canSendClip("Strength: V-ups")).toBe(false);
  });
});

describe("how far through a session the player is", () => {
  const drills = [
    hw({ title: "Plyo warm-up: Pogo jumps", duration_min: 4 }),
    hw({ duration_min: 6 }),
    hw({ duration_min: undefined }), // no minutes counts 15, as time trained does
    hw({ title: "Strength: Front plank", duration_min: 5 }),
  ];

  it("a tap on the screen wins over what the server last said", () => {
    expect(isDone(drills[0], {})).toBe(false);
    expect(isDone(drills[0], { [drills[0].id]: true })).toBe(true);
    expect(isDone({ ...drills[0], completed: true }, { [drills[0].id]: false })).toBe(false);
  });

  it("counts drills and minutes, and points at the first one left", () => {
    const p = sessionProgress(drills, { [drills[0].id]: true });
    expect(p).toMatchObject({ total: 4, done: 1, complete: false, nextIndex: 1 });
    expect(p.minutesDone).toBe(4);
    expect(p.minutesTotal).toBe(4 + 6 + 15 + 5);
  });

  it("the minutes on the finish screen are exactly what time trained adds", () => {
    const all = Object.fromEntries(drills.map((d) => [d.id, true]));
    const p = sessionProgress(drills, all);
    expect(p.complete).toBe(true);
    expect(p.nextIndex).toBe(-1);
    const landed = timeTrained(drills.map((d) => ({ ...d, completed: true }))).minutes;
    expect(p.minutesTotal).toBe(landed);
  });

  it("an empty session is never complete", () => {
    expect(sessionProgress([], {}).complete).toBe(false);
  });

  it("after a drill it moves down the list, then back up to anything skipped", () => {
    const done = { [drills[1].id]: true };
    expect(nextStep(drills, done, 1)).toBe(2);
    expect(nextStep(drills, { ...done, [drills[2].id]: true, [drills[3].id]: true }, 3)).toBe(0);
    const all = Object.fromEntries(drills.map((d) => [d.id, true]));
    expect(nextStep(drills, all, 3)).toBe(-1);
  });
});

describe("the week as sessions", () => {
  it("groups by session in order, drills in order, and names extras", () => {
    const rows = [
      hw({ session: 2, sort: 2 }),
      hw({ session: 1, sort: 9 }),
      hw({ session: 2, sort: 1 }),
      hw({ session: 5, is_extra: true }),
    ];
    const g = groupSessions(rows);
    expect(g.map((s) => s.n)).toEqual([1, 2, 5]);
    expect(g[1].list.map((h) => h.sort)).toEqual([1, 2]);
    expect(sessionName(g[0])).toBe("Session 1");
    expect(sessionName(g[2])).toBe("Extra session");
  });
});

describe("the finish screen never nags", () => {
  it("says what is left as a plain fact, with no guilt", () => {
    expect(afterSessionLine(0)).toBe("That was the last session of the week.");
    expect(afterSessionLine(1)).toBe("One more session completes your week.");
    for (const n of [0, 1, 2, 5]) {
      expect(afterSessionLine(n)).not.toMatch(/miss|behind|streak|don't|hurry|only/i);
    }
  });

  it("no streaks, points or countdowns anywhere in the session screens", () => {
    for (const f of [
      "components/elite/SessionPlayer.tsx",
      "components/elite/SessionRows.tsx",
      "components/elite/TodaySession.tsx",
      "components/elite/WeekList.tsx",
    ]) {
      const copy = read(f).replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      expect(copy, f).not.toMatch(/streak|points|xp\b|leaderboard|hurry|expires/i);
      expect(copy, f).not.toMatch(/—|\bAI\b|automated|algorithm/);
    }
  });
});

describe("the feel of each moment", () => {
  it("is a ladder: a drill is the lightest, a week the strongest", () => {
    const drill = hapticFor("drill");
    const session = hapticFor("session");
    const week = hapticFor("week");
    expect(drill.native).toEqual([{ method: "impact", options: { style: "LIGHT" } }]);
    expect(session.native).toEqual([{ method: "notification", options: { type: "SUCCESS" } }]);
    expect(week.native).toHaveLength(2);
    const weight = (p: number[]) => p.reduce((s, n) => s + n, 0);
    expect(weight(drill.pattern)).toBeLessThan(weight(session.pattern));
    expect(weight(session.pattern)).toBeLessThan(weight(week.pattern));
  });

  it("only ever uses the success meaning, never a warning or an error", () => {
    for (const m of ["drill", "session", "week"] as const) {
      expect(JSON.stringify(hapticFor(m))).not.toMatch(/WARNING|ERROR/);
    }
  });

  it("vibration is on unless the player switched it off", () => {
    expect(feelEnabled(null)).toBe(true);
    expect(feelEnabled("off")).toBe(false);
  });
});

describe("the player shell", () => {
  it("has at most five tabs", () => {
    for (const tier of ["pro", "elite", "complete", null] as const) {
      expect(memberTabs(tier).length).toBeLessThanOrEqual(5);
    }
    expect(read("app/(player)/layout.tsx")).toContain("memberTabs(player?.tier, social)");
  });

  it("sign out is not a one-tap icon in the phone header", () => {
    const nav = read("components/elite/AppNav.tsx");
    const top = nav.slice(nav.indexOf("Mobile top bar"), nav.indexOf("Mobile bottom tab bar"));
    expect(top).not.toContain("signOut");
    expect(top).toContain('href="/account"');
    // The member app's corner is the bell and the member's ring, which
    // opens You (where Account is); sign out lives on Account only.
    const member = read("components/elite/MemberNav.tsx");
    expect(member).not.toContain("signOut");
    expect(member).toContain('href="/you" aria-label="You"');
  });
});

// The drop: what it says about the week before, and its one button.
describe("the drop: last week's line and the start button", () => {
  const row = (week: number, session: number, completed: boolean, duration_min = 5, actual_seconds: number | null = null) =>
    ({ id: `${week}-${session}-${Math.random()}`, week, session, sort: 0, completed, duration_min, actual_seconds, is_extra: false }) as unknown as import("../lib/elite/types").Homework;

  it("says the sessions finished and the time trained, in whole words", () => {
    const rows = [row(3, 1, true, 10), row(3, 1, true, 12), row(3, 2, true, 20), row(3, 3, true, 30), row(3, 3, false)];
    expect(lastWeekLine(rows, 4)).toBe("Last week you finished 2 sessions and trained 1h 12m.");
    expect(lastWeekLine([row(3, 1, true, 20)], 4)).toBe("Last week you finished 1 session and trained 20m.");
  });

  it("counts the measured time when a drill has one", () => {
    expect(lastWeekLine([row(2, 1, true, 20, 300)], 3)).toBe("Last week you finished 1 session and trained 5m.");
  });

  it("time without a finished session is still said; nothing trained says nothing", () => {
    expect(lastWeekLine([row(3, 1, true, 8), row(3, 1, false)], 4)).toBe("Last week you trained 8m.");
    expect(lastWeekLine([row(3, 1, false), row(3, 2, false)], 4)).toBeNull();
    expect(lastWeekLine([], 4)).toBeNull();
    expect(lastWeekLine([row(1, 1, true)], 1)).toBeNull();
  });

  it("never counts what was left undone", () => {
    const line = lastWeekLine([row(3, 1, true, 10), row(3, 2, false), row(3, 3, false), row(3, 4, false)], 4) ?? "";
    expect(line).not.toMatch(/missed|left|of 4|behind|only/i);
  });

  it("the button names the first session", () => {
    expect(dropStartLabel({ n: 1, extra: false })).toBe("Start session 1");
    expect(dropStartLabel(null)).toBe("Let's go");
  });
});
