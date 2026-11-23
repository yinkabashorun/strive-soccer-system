import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { absoluteMedia, nextWeekLine, weekPayload, youPayload } from "@/lib/elite/app-payload";
import { cleanAnswers, emptyAnswers, firstUnanswered, quizInput, ATTRIBUTES } from "@/lib/elite/quiz";
import { inAppAgreement } from "@/lib/elite/legal";
import type { Homework } from "@/lib/elite/types";

// What the native app is sent (lib/elite/app-payload.ts) is worked out from
// the same rows and rules as the web member pages, and what it sends back
// is cleaned to the quiz's own choices.

const BASE = "https://thestriveapp.com";
// Tuesday of week 2 for a player who started Monday Nov 16.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-24T15:00:00Z"));
});
afterAll(() => vi.useRealTimers());
let n = 0;
function hw(over: Partial<Homework>): Homework {
  n++;
  return {
    id: `h${n}`,
    player_id: "p1",
    week: 1,
    session: 1,
    title: "Weak foot tap, pull, push",
    exercise: "Tap, pull, push with the weak foot.",
    reps: "3 x 1 min, rest 30 sec",
    duration_min: 5,
    video_url: "/drills/weak-foot-tap-pull-push.mp4",
    pillar: "Weak Foot",
    notes: null,
    completed: false,
    completed_at: null,
    sort: n,
    ...over,
  };
}

function week(rows: Homework[], over: Partial<Parameters<typeof weekPayload>[0]> = {}) {
  return weekPayload({
    homework: rows,
    week1Monday: "2026-11-16",
    currentWeek: 1,
    plans: [],
    programGoal: null,
    onboardingGoal: "Make the A team",
    focusName: null,
    onBreak: null,
    hasWall: false,
    base: BASE,
    now: new Date("2026-11-24T15:00:00Z").getTime(),
    nextMonday: "2026-11-30",
    ...over,
  });
}

describe("absoluteMedia", () => {
  it("turns our own paths into whole addresses and passes only https", () => {
    expect(absoluteMedia("/drills/x.mp4", BASE)).toBe("https://thestriveapp.com/drills/x.mp4");
    expect(absoluteMedia("/drills/x.mp4", BASE + "/")).toBe("https://thestriveapp.com/drills/x.mp4");
    expect(absoluteMedia("https://files.manuscdn.com/a.mp4", BASE)).toBe("https://files.manuscdn.com/a.mp4");
    expect(absoluteMedia("http://example.com/a.mp4", BASE)).toBeNull();
    expect(absoluteMedia("//evil.com/a.mp4", BASE)).toBeNull();
    expect(absoluteMedia("javascript:alert(1)", BASE)).toBeNull();
    expect(absoluteMedia(null, BASE)).toBeNull();
  });
});

describe("the week", () => {
  it("groups sessions, names drills and carries clip and still", () => {
    const rows = [
      hw({ session: 1, title: "Plyo warm-up: Pogo jumps", pillar: "Plyo", video_url: "/drills/plyo-pogo.mp4" }),
      hw({ session: 1, completed: true }),
      hw({ session: 2, title: "Strength: Front plank", pillar: "Strengthening", video_url: "https://files.manuscdn.com/p.mp4" }),
    ];
    const w = week(rows);
    expect(w.week).toBe(1); // the coach is behind: the latest built week
    expect(w.sessions.map((s) => s.n)).toEqual([1, 2]);
    expect(w.sessions[0].drills[0]).toMatchObject({ kind: "warmup", kindLabel: "Warm-up", name: "Pogo jumps" });
    expect(w.sessions[0].drills[1]).toMatchObject({
      kind: "skill",
      completed: true,
      video: "https://thestriveapp.com/drills/weak-foot-tap-pull-push.mp4",
      poster: "https://thestriveapp.com/drills/posters/weak-foot-tap-pull-push.jpg",
    });
    expect(w.sessions[1].drills[0]).toMatchObject({ kind: "finisher", name: "Front plank", poster: null });
    expect(w.current).toBe(1);
    expect(w.totalMinutes).toBe(5);
    expect(w.ladder.map((r) => r.key)).toEqual(["goal", "week"]);
    expect(w.ladder[1].value).toBe("0 of 2");
  });

  it("shows only unlocked weeks and never the week after the live one", () => {
    const w = week([hw({ week: 1 }), hw({ week: 2, completed: true, duration_min: 30 }), hw({ week: 3 })]);
    // live week is 2 on Nov 24 for a Nov 16 start
    expect(w.week).toBe(2);
    expect(w.totalMinutes).toBe(30);
    expect(w.sessions.flatMap((s) => s.drills).every((d) => d.completed)).toBe(true);
    expect(w.weekDone).toBe(true);
    expect(w.oneMore).toBeNull();
  });

  it("says one more session when exactly one is left, and nothing on a full week", () => {
    const w = week([hw({ week: 2, session: 1, completed: true }), hw({ week: 2, session: 2 })]);
    expect(w.oneMore).toBe("One more session completes your week.");
    expect(w.sessionsLeft).toBe(1);
  });

  it("is empty and honest before the first week is built", () => {
    const w = week([]);
    expect(w.week).toBe(0);
    expect(w.sessions).toEqual([]);
    expect(w.weekDone).toBe(false);
    expect(w.nextWeekLine).toMatch(/building week/);
  });

  it("names the break", () => {
    const w = week([hw({ week: 2 })], { onBreak: { until: "2026-12-01" } });
    expect(w.onBreak?.line).toMatch(/^On a break until Tue, Dec 1$/);
  });

  it("uses the web Home's next-week words", () => {
    const base = { week: 2, live: 2, maxBuilt: 2, now: 0, nextMonday: "2026-11-30" };
    expect(nextWeekLine({ ...base, plans: [{ week: 3, unlocks_at: "2026-11-30T11:00:00Z" }] })).toBe("Week 3 unlocks Mon, Nov 30.");
    expect(nextWeekLine({ ...base, plans: [], maxBuilt: 1 })).toBe("Your coach is building week 2. It lands the moment it's ready.");
    expect(nextWeekLine({ ...base, plans: [] })).toBe("Your coach is building week 3. It drops Monday.");
  });
});

describe("You", () => {
  it("only ever adds up", () => {
    const y = youPayload({
      fullName: "Marcus Bryant",
      joinedAt: "2026-11-01T15:00:00Z",
      tier: "pro",
      position: "Winger",
      homework: [hw({ week: 1, completed: true, duration_min: 45 }), hw({ week: 2, completed: true, duration_min: 30 }), hw({ week: 2 })],
      achievements: [{ id: "a1", title: "10 Sessions", detail: "Ten sessions done" }],
      week1Monday: "2026-11-16",
      currentWeek: 1,
    });
    expect(y.card).toEqual({ name: "Marcus B.", since: "Member since Nov 2026", tier: "Pro" });
    expect(y.allTimeMinutes).toBe(75);
    expect(y.weekMinutesDone).toBe(30);
    expect(y.weekMinutesPlanned).toBe(35);
    expect(y.bars.map((b) => b.minutes)).toEqual([45, 30]);
    expect(y.medals[0]).toEqual({ hours: 1, earned: true });
    expect(y.next).toEqual({ hours: 3, minutesAway: 105 });
    expect(JSON.stringify(y)).not.toMatch(/streak|percent|missed/i);
  });
});

describe("answers from the phone", () => {
  it("keep only the quiz's own choices", () => {
    const a = cleanAnswers({
      gender: "boy",
      team: "3-4",
      age: 14,
      position: "Winger",
      foot: "Left",
      level: "Competitive",
      space: "open",
      wall: true,
      goal: "yes",
      nearbyAnswered: true,
      club: "x".repeat(900),
      attrs: { first_touch: 3, weak_foot: 9, dribbling: 2.5, nonsense: 1 },
      parentName: "Tatsiana",
      role: "admin",
    });
    expect(a.goal).toBe(false);
    expect(a.club.length).toBe(200);
    expect(a.attrs).toEqual({ first_touch: 3 });
    expect((a as Record<string, unknown>).role).toBeUndefined();
    expect(cleanAnswers({ age: 99, position: "Quarterback", level: "Pro" })).toEqual(emptyAnswers());
    expect(cleanAnswers("nope")).toEqual(emptyAnswers());
  });

  it("a fully answered quiz reaches the intake shape", () => {
    const attrs = Object.fromEntries(ATTRIBUTES.map((x) => [x.id, 4]));
    const a = cleanAnswers({
      gender: "girl",
      team: "off",
      age: 13,
      position: "Striker",
      foot: "Right",
      level: "Advanced",
      space: "tight",
      nearbyAnswered: true,
      attrs: { ...attrs, weak_foot: 2 },
      parentName: "Ana",
    });
    expect(firstUnanswered(a)).toBe(-1);
    const input = quizInput(a);
    expect(input.training_load).toBe("off_season");
    expect(input.weaknesses).toEqual(["Weak foot"]);
  });

  it("the agreement needs both boxes and a name", () => {
    expect(inAppAgreement({ guardian: true, terms: true, guardianName: " Ana  Lopez " })).toEqual({ ok: true, name: "Ana Lopez" });
    expect(inAppAgreement({ guardian: "true", terms: true, guardianName: "Ana" }).ok).toBe(false);
    expect(inAppAgreement({ guardian: true, terms: true, guardianName: "A" }).ok).toBe(false);
  });
});
