import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COUNT_IN,
  FIRST_WEEK_LINE,
  activeTab,
  cardName,
  cardTierLabel,
  countInNext,
  countInWanted,
  dropDue,
  dropSeenKey,
  firstWeekStatus,
  hoursMedals,
  memberSinceLabel,
  memberTabs,
  mondayOfProgramWeek,
  nextMilestone,
  parseSeenWeek,
  sessionHeadline,
  sessionImage,
  weakSpotPhrase,
  weekRange,
  weeklyMinutes,
} from "@/lib/elite/experience";
import { courseCover } from "@/lib/elite/courses";
import { APP_BUILD, screenFor } from "@/lib/elite/app-review";
import type { Course, CourseStep, Homework } from "@/lib/elite/types";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const copyOf = (p: string) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");

// The member experience (Nov 21 2026, marketing/app-redesign/experience.md):
// the tabs, the member card, the count-in, the first week, the drop.

const row = (p: Partial<Homework>): Homework => ({
  id: p.id ?? Math.random().toString(36).slice(2),
  player_id: "p",
  week: 1,
  session: 1,
  title: "Drill",
  exercise: "",
  reps: "",
  video_url: null,
  notes: null,
  completed: false,
  completed_at: null,
  sort: 0,
  ...p,
});

describe("the tabs", () => {
  it("Strive Pro gets exactly Home, Week, Courses and You", () => {
    expect(memberTabs("pro").map((t) => t.label)).toEqual(["Home", "Week", "Courses", "You"]);
  });

  it("an offer with the coach chat gets Coach before You, and never more than five", () => {
    for (const tier of ["elite", "complete", null]) {
      expect(memberTabs(tier).map((t) => t.label)).toEqual(["Home", "Week", "Courses", "Coach", "You"]);
    }
  });

  it("Film Room is never a tab; Week is the existing /homework route", () => {
    for (const tier of ["pro", "elite", "complete"]) {
      expect(memberTabs(tier).map((t) => t.href)).not.toContain("/film");
    }
    expect(memberTabs("pro")[1].href).toBe("/homework");
  });

  it("every tab is a screen the iPhone build draws", () => {
    for (const t of memberTabs("elite")) {
      const s = screenFor(t.href);
      expect(s, t.href).not.toBeNull();
      expect(s!.since).not.toBeNull();
      expect(s!.since!).toBeLessThanOrEqual(APP_BUILD);
    }
  });

  it("the page under a tab keeps its tab lit", () => {
    const pro = memberTabs("pro");
    const elite = memberTabs("elite");
    expect(activeTab("/courses/keep-it-up", pro)).toBe("/courses");
    expect(activeTab("/progress", pro)).toBe("/you");
    expect(activeTab("/film", elite)).toBe("/messages");
    expect(activeTab("/dashboard", pro)).toBe("/dashboard");
    expect(activeTab("/somewhere", pro)).toBeNull();
  });
});

describe("the member card", () => {
  it("member since is the real join month, in New York time", () => {
    expect(memberSinceLabel("2026-11-21T15:00:00Z")).toBe("Member since Nov 2026");
    // 2 am UTC on Dec 1 is still Nov 30 in New York
    expect(memberSinceLabel("2026-12-01T02:00:00Z")).toBe("Member since Nov 2026");
    expect(memberSinceLabel(null)).toBeNull();
    expect(memberSinceLabel("not a date")).toBeNull();
  });

  it("a first name and an initial, and the tier by its name", () => {
    expect(cardName("Marcus Bryant")).toBe("Marcus B.");
    expect(cardName("Marcus")).toBe("Marcus");
    expect(cardName("  ")).toBe("");
    expect(cardTierLabel("pro")).toBe("Pro");
    expect(cardTierLabel("elite")).toBe("Elite");
    expect(cardTierLabel(null)).toBe("Complete");
  });

  it("carries no member number", () => {
    const card = copyOf("components/elite/MemberCard.tsx");
    expect(card).not.toMatch(/member\s*(no|number|#)|#\{/i);
  });
});

describe("the count-in", () => {
  const drills = [row({ id: "a" }), row({ id: "b" })];

  it("runs only for a session started from its first drill with nothing done", () => {
    expect(countInWanted(drills, {}, 0)).toBe(true);
    expect(countInWanted(drills, {}, 1)).toBe(false);
    expect(countInWanted(drills, { a: true }, 0)).toBe(false);
    expect(countInWanted([row({ id: "a", completed: true }), row({ id: "b" })], {}, 0)).toBe(false);
    expect(countInWanted([], {}, 0)).toBe(false);
  });

  it("counts 3, 2, 1 after the session's name, then goes", () => {
    expect(COUNT_IN).toEqual([3, 2, 1]);
    let s = countInNext("intro", "tick");
    const seen = [s];
    while (s !== "go") {
      s = countInNext(s, "tick");
      seen.push(s);
    }
    expect(seen).toEqual([3, 2, 1, "go"]);
  });

  it("a tap skips it from any point", () => {
    for (const s of ["intro", 3, 2, 1] as const) expect(countInNext(s, "tap")).toBe("go");
  });

  it("the session player skips it on a tap anywhere", () => {
    const player = read("components/elite/SessionPlayer.tsx");
    expect(player).toContain('onSkip={() => setCountIn("go")}');
    expect(player).toMatch(/aria-label="Skip the count-in and start the first drill"\s*className="absolute inset-0/);
  });
});

describe("the first week", () => {
  const today = "2026-11-22"; // a Sunday
  it("says where the week really is, never a finished week that was not built", () => {
    expect(firstWeekStatus({ active: false, built: true, week1Monday: null, today })).toBe("off");
    expect(firstWeekStatus({ active: true, built: false, week1Monday: null, today })).toBe("waiting");
    // finished on a Sunday: built, held to Monday
    expect(firstWeekStatus({ active: true, built: true, week1Monday: "2026-11-23", today })).toBe("monday");
    expect(firstWeekStatus({ active: true, built: true, week1Monday: "2026-11-16", today })).toBe("live");
  });

  it("each honest line is plain and never says AI", () => {
    for (const l of Object.values(FIRST_WEEK_LINE)) {
      expect(`${l.title} ${l.body}`).not.toMatch(/—|\bAI\b|automated|algorithm/);
    }
    expect(FIRST_WEEK_LINE.waiting.title).toBe("Your week lands within the hour.");
    expect(FIRST_WEEK_LINE.monday.title).toBe("Your first week starts Monday.");
  });

  it("builds through the hourly builder's own body, for the member's own record only", () => {
    const action = read("lib/elite/first-week-actions.ts");
    expect(action).toContain("buildFirstWeekFor(viewer.playerId)");
    expect(action).toContain("state.active && !state.built");
    const plan = read("lib/elite/auto-plan.ts");
    expect(plan).toContain("runAutoWeeklyPlans(undefined, playerId)");
    expect(plan).toContain('if (onlyPlayerId) rosterQuery = rosterQuery.eq("id", onlyPlayerId);');
    // Logged apart from the hourly builder, so a join never masks a dead cron.
    expect(plan).toContain("job: FIRST_WEEK_JOB");
    expect(read("lib/elite/cron-log.ts")).toContain('FIRST_WEEK_JOB = "first-week"');
  });
});

describe("the drop", () => {
  it("shows once per new week, before anything in it is done", () => {
    expect(dropDue({ seenWeek: null, week: 1, sessions: 4, anyDone: false })).toBe(true);
    expect(dropDue({ seenWeek: 6, week: 7, sessions: 4, anyDone: false })).toBe(true);
    expect(dropDue({ seenWeek: 7, week: 7, sessions: 4, anyDone: false })).toBe(false);
    expect(dropDue({ seenWeek: 6, week: 7, sessions: 4, anyDone: true })).toBe(false);
    expect(dropDue({ seenWeek: null, week: 1, sessions: 0, anyDone: false })).toBe(false);
  });

  it("remembers per player, and a broken store reads as never shown", () => {
    expect(dropSeenKey("abc")).toBe("strive_drop_seen:abc");
    expect(parseSeenWeek("7")).toBe(7);
    expect(parseSeenWeek(null)).toBeNull();
    expect(parseSeenWeek("junk")).toBeNull();
    expect(parseSeenWeek("0")).toBeNull();
  });

  it("every storage call is guarded", () => {
    const drop = read("components/elite/WeekDrop.tsx");
    const calls = drop.match(/localStorage\.(get|set)Item/g) ?? [];
    const guarded = drop.match(/try \{\s*(seen = parseSeenWeek\(window\.localStorage\.getItem|window\.localStorage\.setItem)/g) ?? [];
    expect(calls.length).toBe(2);
    expect(guarded.length).toBe(2);
  });
});

describe("their own words", () => {
  it("names the weak spot from the quiz", () => {
    expect(weakSpotPhrase(["Weak foot"])).toBe("your weak foot");
    expect(weakSpotPhrase(["1v1 moves"])).toBe("your 1v1 moves");
    expect(weakSpotPhrase(["My first touch"])).toBe("your first touch");
    expect(weakSpotPhrase([])).toBeNull();
    expect(weakSpotPhrase(["Slows down a lot when pressed by two defenders at once"])).toBeNull();
  });

  it("the session's headline is the two areas most of its drills work", () => {
    const list = [
      row({ title: "Plyo warm-up: Pogo jumps", pillar: "Plyo" }),
      row({ title: "Weak foot tap, pull, push", pillar: "Weak Foot" }),
      row({ title: "Weak foot pop and settle", pillar: "Weak Foot" }),
      row({ title: "2 touch ball mastery", pillar: "Ball Mastery" }),
      row({ title: "Strength: V-ups", pillar: "Strengthening" }),
    ];
    expect(sessionHeadline(list)).toBe("Weak foot and ball mastery");
    expect(sessionHeadline([row({ title: "Elastico", pillar: "Confidence" })])).toBe("1v1 moves");
    expect(sessionHeadline([row({ title: "Drill" })])).toBeNull();
  });

  it("a session's picture is Strive's own still, skill drill first", () => {
    const list = [
      row({ title: "Plyo warm-up: Pogo jumps", video_url: "/drills/plyo-pogo-jumps.mp4" }),
      row({ title: "Elastico", video_url: "https://files.manuscdn.com/x.mp4" }),
      row({ title: "Weak foot tap, pull, push", video_url: "https://thestriveapp.com/drills/weak-foot-tap-pull-push.mp4" }),
    ];
    expect(sessionImage(list)).toBe("/drills/posters/weak-foot-tap-pull-push.jpg");
    expect(sessionImage([row({ video_url: "https://files.manuscdn.com/x.mp4" })])).toBeNull();
  });

  it("a course's picture is its first step's still in ladder order", () => {
    const step = (p: Partial<CourseStep>): CourseStep => ({
      id: "s",
      course_id: "c",
      level_no: 1,
      level_name: null,
      tag: null,
      drill_id: null,
      title: null,
      body: null,
      video_url: null,
      download_url: null,
      cue: null,
      pass_mark: null,
      sort: 0,
      ...p,
    });
    const course = {
      steps: [
        step({ level_no: 2, video_url: "/drills/juggling-head-it-up.mp4" }),
        step({ level_no: 1, video_url: "/drills/juggling-one-touch-catch.mp4" }),
      ],
    } as Pick<Course, "steps">;
    expect(courseCover(course)).toBe("/drills/posters/juggling-one-touch-catch.jpg");
    expect(courseCover({ steps: [step({ title: "A page", body: "Words" })] })).toBeNull();
  });
});

describe("what only goes up", () => {
  it("the next hours medal and how far away it is", () => {
    expect(nextMilestone(0)).toEqual({ hours: 1, minutesAway: 60 });
    expect(nextMilestone(282)).toEqual({ hours: 5, minutesAway: 18 });
    expect(nextMilestone(300)).toEqual({ hours: 10, minutesAway: 300 });
    expect(nextMilestone(1_000_000)).toBeNull();
  });

  it("You shows the medals earned and the next one, dim", () => {
    expect(hoursMedals(282)).toEqual([
      { hours: 1, earned: true },
      { hours: 3, earned: true },
      { hours: 5, earned: false },
    ]);
    expect(hoursMedals(0)).toEqual([{ hours: 1, earned: false }]);
    expect(hoursMedals(61 * 60).filter((m) => m.earned).length).toBe(3);
    expect(hoursMedals(61 * 60).length).toBe(4);
  });

  it("the weekly bars are minutes trained, a quiet week a short bar, never a mark", () => {
    const rows = [
      row({ week: 1, completed: true, duration_min: 20 }),
      row({ week: 1, completed: false, duration_min: 20 }),
      row({ week: 3, completed: true }),
    ];
    expect(weeklyMinutes(rows, 3, 7)).toEqual([
      { week: 1, minutes: 20 },
      { week: 2, minutes: 0 },
      { week: 3, minutes: 15 },
    ]);
    expect(weeklyMinutes(rows, 9, 3).map((b) => b.week)).toEqual([7, 8, 9]);
  });

  it("week dates read Nov 23 to Nov 29", () => {
    expect(mondayOfProgramWeek("2026-11-02", 4)).toBe("2026-11-23");
    expect(weekRange("2026-11-23")).toBe("Nov 23 to Nov 29");
    expect(weekRange(null)).toBeNull();
  });
});

describe("nothing on the new screens counts what was missed", () => {
  it("no streaks, misses, points or percentages, no em dashes, no AI", () => {
    for (const f of [
      "components/elite/QuizFlow.tsx",
      "components/elite/WeekDrop.tsx",
      "components/elite/MemberCard.tsx",
      "components/elite/MemberNav.tsx",
      "components/elite/YouParts.tsx",
      "components/elite/TodaySession.tsx",
      "components/elite/WeekList.tsx",
      "components/elite/SessionPlayer.tsx",
      "app/(player)/you/page.tsx",
      "app/(player)/homework/page.tsx",
      "app/onboarding/page.tsx",
      "lib/elite/experience.ts",
    ]) {
      const copy = copyOf(f);
      expect(copy, f).not.toMatch(/streak|missed|you missed|behind|points|leaderboard|percent|%\s*<\/|—|\bAI\b|automated|algorithm/i);
    }
  });

  it("gold is never a button: the main button is off-white with black type", () => {
    const css = read("app/globals.css");
    const button = css.slice(css.indexOf(".m-button {"), css.indexOf("}", css.indexOf(".m-button {")));
    expect(button).toContain("bg-bone");
    expect(button).toContain("text-black");
    expect(button).not.toMatch(/gold|metal|accent/);
  });

  it("the member type is ours: Oswald and Inter from our own files, with their licences", () => {
    const fonts = read("app/fonts/index.ts");
    for (const f of ["Oswald-Bold.woff2", "Inter-Medium.woff2", "Inter-SemiBold.woff2"]) {
      expect(fonts).toContain(f);
      expect(() => read(`app/fonts/${f}`)).not.toThrow();
    }
    expect(() => read("app/fonts/OFL-Oswald.txt")).not.toThrow();
    expect(() => read("app/fonts/OFL-Inter.txt")).not.toThrow();
    expect(read("app/(player)/layout.tsx")).toContain('className="member-ui');
    expect(read("app/onboarding/page.tsx")).toContain('className="member-ui');
  });
});
