import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CARD_HANDLE,
  DEFAULT_TARGETS,
  FREE_AGREEMENT_POINTS,
  FREE_HOME,
  FREE_ACCOUNT_EXISTS_MESSAGE,
  FREE_QUIZ,
  GOALS,
  GRADES,
  GYM_REFUSED_MESSAGE,
  LEVELS,
  QUIZ_QUESTIONS,
  LOG_CHIPS,
  SEASONS,
  TARGET_MAX,
  TARGET_MIN,
  allTimeMinutes,
  cardFacts,
  BOARD_CAP,
  BOARD_EMPTY_LINE,
  BOARD_TITLE,
  FREE_DAYS,
  addFriendQuestion,
  cleanJoin,
  joinProblem,
  cleanKind,
  cleanPlanDays,
  friendAskPath,
  friendPair,
  friendsBoard,
  perDayMinutes,
  planDaysLabel,
  shortName,
  splitLine,
  stripDayLabel,
  todayLine,
  longDayLabel,
  weekStrip,
  cleanReferralCode,
  cleanTarget,
  dayLabel,
  freeLanding,
  labelOf,
  programLink,
  gymThisWeekLine,
  homeFor,
  joinLink,
  logsThisWeek,
  mayLog,
  newReferralCode,
  recommendLine,
  recommendation,
  stepTarget,
  tracksGym,
  validateMinutes,
  validateQuiz,
  weekLabel,
  weekOf,
  weekProgress,
  type TrainingLog,
} from "@/lib/elite/tracker";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");

const log = (trained_on: string, minutes: number, kind: "training" | "gym" = "training"): TrainingLog => ({
  id: `${trained_on}-${minutes}-${kind}`,
  trained_on,
  minutes,
  kind,
});

// The free training log (migration 069): the pure rules.

describe("the four questions", () => {
  it("asks grade first, then team, season and goal, and nothing else", () => {
    expect([...QUIZ_QUESTIONS]).toEqual(["grade", "level", "season", "goal"]);
    expect(GRADES.map((g) => g.id)).toEqual(["middle_or_younger", "high_school", "college_or_older"]);
    expect(GRADES.map((g) => g.label)).toEqual(["Middle school or younger", "High school", "College or older"]);
    expect(LEVELS.map((l) => l.id)).toEqual(["rec", "travel", "elite", "high_school", "college"]);
    expect(SEASONS.map((s) => s.id)).toEqual(["in_season", "off_season"]);
    expect(GOALS.map((g) => g.id)).toEqual(["start", "higher_team", "college", "pro"]);
    const quiz = code("components/elite/TrackerQuiz.tsx");
    expect(quiz).toContain('useState<Step>("grade")');
    // then the target, then the days; nothing is saved before the last screen
    expect(quiz).toContain('const ORDER: Step[] = [...QUIZ_QUESTIONS, "target", "days"];');
    expect((quiz.match(/saveQuiz\(/g) ?? []).length).toBe(1);
    expect(quiz).toContain("saveQuiz({ grade, level, season, goal, target, days })");
    expect(quiz).toContain("What grade are you in?");
    expect(quiz).toContain("${at + 1} of ${QUIZ_QUESTIONS.length}");
  });

  it("the team options are about the team, never the age", () => {
    expect(LEVELS.map((l) => l.label)).toEqual([
      "Rec or town team",
      "Travel or club team",
      "ECNL, MLS NEXT or similar",
      "High school team only",
      "College team",
    ]);
    expect(labelOf(LEVELS, "high_school")).toBe("High school team only");
    expect(labelOf(GRADES, "high_school")).toBe("High school");
  });

  it("takes four real answers and refuses anything else", () => {
    const good = { grade: "high_school", level: "elite", season: "in_season", goal: "college" };
    expect(validateQuiz(good)).toEqual(good);
    expect(validateQuiz({ ...good, grade: undefined })).toBeNull();
    expect(validateQuiz({ ...good, grade: "ninth" })).toBeNull();
    expect(validateQuiz({ ...good, level: "pro" })).toBeNull();
    expect(validateQuiz({ ...good, season: "winter" })).toBeNull();
    expect(validateQuiz({ ...good, goal: undefined })).toBeNull();
    expect(validateQuiz({ grade: 9, level: 1, season: null, goal: {} })).toBeNull();
  });

  it("the database holds the same three grades", () => {
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).toContain("grade in ('middle_or_younger', 'high_school', 'college_or_older')");
    expect(code("lib/elite/tracker-actions.ts")).toContain("grade: answers.grade,");
  });

  it("promises nothing in a goal", () => {
    const words = GOALS.map((g) => g.label).join(" ");
    expect(words).not.toMatch(/guarantee|scholarship|roster/i);
  });
});

describe("the weekly target", () => {
  it("is Coach Yinka's numbers: 4 hours in season, 6 to 12 off season", () => {
    expect(recommendation(DEFAULT_TARGETS, "in_season")).toEqual({
      season: "in_season",
      minutes: 240,
      minutes_max: null,
    });
    expect(recommendation(DEFAULT_TARGETS, "off_season")).toEqual({
      season: "off_season",
      minutes: 360,
      minutes_max: 720,
    });
  });

  it("the migration seeds the same two rows, by season only", () => {
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).toContain("values ('in_season', 240, null), ('off_season', 360, 720)");
    expect(sql).toMatch(/season\s+text primary key/);
  });

  it("reads the coach's table, and falls back to the defaults when a row is missing", () => {
    const table = [{ season: "in_season" as const, minutes: 300, minutes_max: null }];
    expect(recommendation(table, "in_season").minutes).toBe(300);
    expect(recommendation(table, "off_season").minutes).toBe(360);
    expect(recommendation([], "in_season").minutes).toBe(240);
  });

  it("says it in his words", () => {
    expect(recommendLine(recommendation(DEFAULT_TARGETS, "in_season"))).toBe(
      "We recommend 4 hours a week on your own, outside team training."
    );
    expect(recommendLine(recommendation(DEFAULT_TARGETS, "off_season"))).toBe(
      "We recommend 6 to 12 hours a week on your own."
    );
    expect(recommendLine({ season: "in_season", minutes: 60, minutes_max: null })).toBe(
      "We recommend 1 hour a week on your own, outside team training."
    );
    expect(recommendLine({ season: "off_season", minutes: 330, minutes_max: 720 })).toBe(
      "We recommend 5h 30m to 12h a week on your own."
    );
  });

  it("is training hours: the quiz says nothing about gym", () => {
    const quiz = code("components/elite/TrackerQuiz.tsx");
    expect(quiz).not.toMatch(/gym/i);
  });

  it("a target of your own moves in half-hour steps and stays in range", () => {
    expect(cleanTarget(240)).toBe(240);
    expect(cleanTarget(250)).toBe(240);
    expect(cleanTarget("390")).toBe(390);
    expect(cleanTarget(0)).toBeNull();
    expect(cleanTarget(TARGET_MAX + 30)).toBeNull();
    expect(cleanTarget("abc")).toBeNull();
    expect(stepTarget(360, 1)).toBe(390);
    expect(stepTarget(720, 1)).toBe(750); // past 12 hours is fine
    expect(stepTarget(TARGET_MIN, -1)).toBe(TARGET_MIN);
    expect(stepTarget(TARGET_MAX, 1)).toBe(TARGET_MAX);
  });
});

describe("logging", () => {
  it("one tap logs one of five lengths", () => {
    expect([...LOG_CHIPS]).toEqual([15, 30, 45, 60, 90]);
  });

  it("takes whole minutes from 1 to 300", () => {
    expect(validateMinutes(45)).toBe(45);
    expect(validateMinutes("90")).toBe(90);
    expect(validateMinutes(0)).toBeNull();
    expect(validateMinutes(301)).toBeNull();
    expect(validateMinutes(12.5)).toBeNull();
    expect(validateMinutes("x")).toBeNull();
  });
});

describe("the week", () => {
  // Wed Nov 18 2026
  const today = "2026-11-18";

  it("runs Monday to Sunday", () => {
    expect(weekOf(today)).toEqual({ monday: "2026-11-16", sunday: "2026-11-22" });
    expect(weekOf("2026-11-16")).toEqual({ monday: "2026-11-16", sunday: "2026-11-22" });
    expect(weekOf("2026-11-22")).toEqual({ monday: "2026-11-16", sunday: "2026-11-22" });
    expect(weekOf("2026-11-23").monday).toBe("2026-11-23");
    expect(weekLabel(today)).toBe("Nov 16 to Nov 22");
    expect(dayLabel("2026-11-16")).toBe("Mon, Nov 16");
  });

  it("counts only this week's minutes", () => {
    const logs = [log("2026-11-16", 45), log("2026-11-18", 30), log("2026-11-15", 60), log("2026-11-23", 60)];
    expect(logsThisWeek(logs, today)).toHaveLength(2);
    expect(weekProgress(logs, 240, today)).toEqual({ minutes: 75, gymMinutes: 0, target: 240, percent: 31 });
    expect(allTimeMinutes(logs)).toBe(195);
  });

  it("the ring stops at full, the number never does", () => {
    const logs = [log("2026-11-16", 300), log("2026-11-17", 300)];
    const p = weekProgress(logs, 240, today);
    expect(p.percent).toBe(100);
    expect(p.minutes).toBe(600);
    expect(weekProgress([], 240, today)).toEqual({ minutes: 0, gymMinutes: 0, target: 240, percent: 0 });
    expect(weekProgress(logs, 0, today).percent).toBe(0);
  });
});

describe("gym work is tracked apart", () => {
  const today = "2026-11-18";

  it("never fills the ring and never counts toward the target", () => {
    const logs = [log("2026-11-16", 60), log("2026-11-17", 90, "gym"), log("2026-11-18", 300, "gym")];
    expect(weekProgress(logs, 240, today)).toEqual({ minutes: 60, gymMinutes: 390, target: 240, percent: 25 });
    // only gym logged: the ring is empty
    expect(weekProgress([log("2026-11-17", 240, "gym")], 240, today).percent).toBe(0);
  });

  it("all time is training hours", () => {
    expect(allTimeMinutes([log("2026-11-01", 60), log("2026-11-02", 500, "gym")])).toBe(60);
  });

  it("is for players in high school or older, read from the grade and never from the team", () => {
    expect(tracksGym("high_school")).toBe(true);
    expect(tracksGym("college_or_older")).toBe(true);
    for (const g of ["middle_or_younger", null, undefined, ""]) expect(tracksGym(g)).toBe(false);
    // a team answer is not a grade: none of them switches gym on
    for (const team of ["rec", "travel", "elite", "college"]) expect(tracksGym(team)).toBe(false);
    expect(mayLog("training", "middle_or_younger")).toBe(true);
    expect(mayLog("training", null)).toBe(true);
    expect(mayLog("gym", "high_school")).toBe(true);
    expect(mayLog("gym", "college_or_older")).toBe(true);
    expect(mayLog("gym", "middle_or_younger")).toBe(false);
    expect(mayLog("gym", null)).toBe(false);
  });

  it("a high school player on an ECNL team sees the gym switch; a middle school player on one does not", () => {
    // the Dec 19 players: the team answer is "ECNL, MLS NEXT or similar" for both
    for (const f of ["app/(free)/layout.tsx", "app/(free)/log/week/page.tsx"]) {
      expect(code(f), f).toContain("gym={tracksGym(tracker.grade)}");
      expect(code(f), f).not.toContain("tracksGym(tracker.level)");
    }
    expect(code("app/api/elite/tracker/post/route.ts")).toContain("mayLog(kind, tracker.grade)");
    expect(code("app/api/elite/tracker/card/route.tsx")).toContain("tracksGym(tracker.grade)");
    for (const f of ["lib/elite/tracker-actions.ts", "lib/elite/tracker-server.ts", "app/(free)/layout.tsx", "app/api/elite/tracker/post/route.ts"]) {
      expect(code(f), f).not.toMatch(/tracksGym\([^)]*level|mayLog\([^)]*level/);
    }
  });

  it("there are two kinds and nothing else", () => {
    expect(cleanKind("training")).toBe("training");
    expect(cleanKind("gym")).toBe("gym");
    expect(cleanKind("strength")).toBeNull();
    expect(cleanKind(undefined)).toBeNull();
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).toContain("kind       text not null default 'training' check (kind in ('training', 'gym'))");
  });

  it("the server refuses a gym log from a player who does not track gym, before writing", () => {
    const actions = code("lib/elite/tracker-actions.ts");
    const refuse = actions.indexOf("if (!mayLog(kind, o.grade)) return fail(GYM_REFUSED_MESSAGE);");
    expect(refuse).toBeGreaterThan(-1);
    // the one write is insertLog (tracker-server.ts), after the refusal
    expect(refuse).toBeLessThan(actions.indexOf("insertLog(o.admin"));
    expect(code("lib/elite/tracker-server.ts")).toMatch(/export async function insertLog\([\s\S]*?\.from\("elite_training_logs"\)\s*\.insert\(/);
    // the grade comes from the player's own saved row, never from the browser
    expect(actions).toContain("grade: tracker.grade");
    expect(GYM_REFUSED_MESSAGE).toBe("Gym work is logged by players in high school or older.");
  });

  it("has no target and shows one quiet line, only when there is gym this week", () => {
    expect(gymThisWeekLine(0)).toBeNull();
    expect(gymThisWeekLine(90)).toBe("Gym this week: 1h 30m");
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).not.toMatch(/gym_target|gym_minutes/);
    const composer = code("components/elite/PostComposer.tsx");
    // the switch is drawn only for a player who tracks gym, and a younger
    // player's post is always training
    expect(composer).toMatch(/\{gym && \(\s*<div role="radiogroup"/);
    expect(composer).toContain('form.set("kind", gym ? kind : "training");');
    expect(code("app/(free)/layout.tsx")).toContain("<FreeShell gym={tracksGym(tracker.grade)}");
    expect(code("app/(free)/log/week/page.tsx")).toContain("gym={tracksGym(tracker.grade)}");
  });
});

describe("the weekly card", () => {
  it("carries the time, the dates and the first name, and nothing else", () => {
    const facts = cardFacts({
      fullName: "Anthony  Example",
      logs: [log("2026-11-16", 200), log("2026-11-18", 180), log("2026-11-01", 90)],
      today: "2026-11-18",
    });
    expect(facts).toEqual({ time: "6h 20m", week: "Nov 16 to Nov 22", name: "Anthony", gym: null });
    expect(Object.keys(facts).sort()).toEqual(["gym", "name", "time", "week"]);
    expect(CARD_HANDLE).toBe("@strivesoccerfc");
  });

  it("the big number is training; gym is one small line, only when it was logged this week", () => {
    const facts = cardFacts({
      fullName: "Anthony Example",
      logs: [log("2026-11-16", 120), log("2026-11-17", 90, "gym"), log("2026-11-02", 60, "gym")],
      today: "2026-11-18",
    });
    expect(facts.time).toBe("2h");
    expect(facts.gym).toBe("Gym 1h 30m");
  });

  it("the picture is story size, drawn only for the signed-in player, never cached", () => {
    const route = code("app/api/elite/tracker/card/route.tsx");
    expect(route).toMatch(/width:\s*1080/);
    expect(route).toMatch(/height:\s*1920/);
    expect(route).toContain("getViewer()");
    expect(route.indexOf("status: 401")).toBeLessThan(route.indexOf("new ImageResponse("));
    // sent under our own headers, not the picture maker's public, year-long default
    expect(route).toMatch(/return new Response\(picture\.body,[\s\S]*"Cache-Control": "private, no-store"/);
    expect(route).not.toMatch(/return new ImageResponse\(/);
    expect(route).toContain("STRIVE");
    expect(route).toContain("CARD_HANDLE");
    // no count of sessions and no stamp
    expect(route).not.toMatch(/\bsessions\b|\d+ sessions?|target hit/i);
  });

  it("its fonts ship with the route", () => {
    for (const f of ["BarlowCondensed-900.ttf", "Barlow-600.ttf"]) {
      expect(statSync(join(root, "lib/elite/fonts", f)).size).toBeGreaterThan(10_000);
    }
    expect(read("next.config.js")).toContain('"/api/elite/tracker/card": ["./lib/elite/fonts/*.ttf"]');
  });
});

describe("the link a player shares", () => {
  it("is eight characters nobody can misread", () => {
    for (let i = 0; i < 200; i++) {
      const c = newReferralCode();
      expect(c).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
      expect(cleanReferralCode(c)).toBe(c);
    }
    expect(newReferralCode(() => 0)).toBe("AAAAAAAA");
    expect(newReferralCode(() => 0.999999)).toBe("99999999");
  });

  it("a bad code is simply not a code", () => {
    expect(cleanReferralCode(" abcdefgh ")).toBe("ABCDEFGH");
    expect(cleanReferralCode("ABC")).toBeNull();
    expect(cleanReferralCode("ABCDEFG0")).toBeNull(); // no zero
    expect(cleanReferralCode("ABCDEFGH'; drop")).toBeNull();
    expect(cleanReferralCode(undefined)).toBeNull();
    expect(cleanReferralCode(42)).toBeNull();
  });

  it("points at /join on the real domain", () => {
    expect(joinLink("https://thestriveapp.com", "ABCDEFGH")).toBe("https://thestriveapp.com/join?ref=ABCDEFGH");
    expect(joinLink("https://thestriveapp.com/", "ABCDEFGH")).toBe("https://thestriveapp.com/join?ref=ABCDEFGH");
  });

  it("promises nothing for inviting", () => {
    const board = code("components/elite/FriendsBoard.tsx");
    expect(board).not.toMatch(/unlock|reward|earn|\bpro\b|free month/i);
    expect(BOARD_EMPTY_LINE).not.toMatch(/unlock|reward|earn|win\b/i);
  });
});

describe("joining", () => {
  const good = {
    firstName: " Anthony ",
    lastName: "Example",
    email: " A@Example.com ",
    phone: "(703) 555-0100",
    password: "longenough",
  };

  it("needs a first and last name, an email, a phone and a password of 8", () => {
    expect(cleanJoin(good)).toEqual({
      firstName: "Anthony",
      lastName: "Example",
      email: "a@example.com",
      phone: "(703) 555-0100",
      password: "longenough",
    });
    expect(cleanJoin({ ...good, lastName: "" })).toBeNull();
    expect(cleanJoin({ ...good, email: "not-an-email" })).toBeNull();
    expect(cleanJoin({ ...good, phone: "555-0100" })).toBeNull();
    expect(cleanJoin({ ...good, password: "short" })).toBeNull();
    expect(cleanJoin({})).toBeNull();
  });

  it("names the detail that is wrong and the screen it lives on", () => {
    expect(joinProblem(good)).toBeNull();
    expect(joinProblem({ ...good, firstName: " " })).toEqual({ step: "name", message: "Enter your first and last name." });
    expect(joinProblem({ ...good, email: "a@b" })?.step).toBe("contact");
    expect(joinProblem({ ...good, phone: "555-0100" })).toEqual({
      step: "contact",
      message: "Enter a phone number with the area code, 10 digits.",
    });
    expect(joinProblem({ ...good, password: "short" })?.step).toBe("password");
    // screen order: the earliest screen with a problem comes first
    expect(joinProblem({ ...good, lastName: "", password: "x" })?.step).toBe("name");
    // one screen at a time, the way the form checks before Next
    expect(joinProblem({ ...good, password: "x" }, "contact")).toBeNull();
    expect(joinProblem({ firstName: "A", lastName: "B" }, "name")).toBeNull();
    // cleanJoin and joinProblem never disagree
    for (const input of [good, { ...good, phone: "1" }, { ...good, email: "" }, {}]) {
      expect(cleanJoin(input) === null).toBe(joinProblem(input) !== null);
    }
  });

  it("the sign-up form checks each screen before Next and goes back to the screen the server names", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("components/elite/JoinForm.tsx", "utf8");
    for (const step of ["name", "contact", "password"]) {
      expect(src).toContain(`nextIfValid(e, "${step}"`);
    }
    expect(src).toContain('data.reason === "field"');
    const route = readFileSync("app/api/elite/auth/join/route.ts", "utf8");
    expect(route).toContain('reason: "field", step:');
  });

  it("the agreement lines say what a free account stores and how to stop texts", () => {
    const all = FREE_AGREEMENT_POINTS.join(" ");
    expect(all).toContain("the training you log");
    expect(all).toContain("the days you plan to train");
    // what a friend sees, said before the account exists
    expect(all).toContain("The free app is for players 13 and older.");
    expect(all).toContain(
      "The friends you added see your first name, last initial, your training time and the photos you post. So do our coaches."
    );
    expect(all).toContain("You can report a post or block a player. We can remove a post.");
    expect(all).toContain("service providers");
    expect(all).toContain("Reply STOP");
    expect(all).not.toContain("—");
  });
});

describe("where a signed-in person belongs", () => {
  const done = { quizDone: true };
  const fresh = { quizDone: false };

  it("staff to the coach side, a member to the member app, a free account to the log", () => {
    expect(homeFor({ role: "admin", hasPlayer: false, tracker: null })).toBe("/coach");
    expect(homeFor({ role: "coach", hasPlayer: false, tracker: done })).toBe("/coach");
    expect(homeFor({ role: "player", hasPlayer: true, tracker: null })).toBe("/dashboard");
    expect(homeFor({ role: "player", hasPlayer: false, tracker: done })).toBe(FREE_HOME);
    expect(FREE_HOME).toBe("/log");
  });

  it("a free account that has not finished the set-up opens on it, in one step", () => {
    expect(FREE_QUIZ).toBe("/log/quiz");
    expect(freeLanding(true)).toBe("/log");
    expect(freeLanding(false)).toBe("/log/quiz");
    expect(homeFor({ role: "player", hasPlayer: false, tracker: fresh })).toBe("/log/quiz");
  });

  it("a member never lands in the free log, even with an old free account behind them", () => {
    expect(homeFor({ role: "player", hasPlayer: true, tracker: done })).toBe("/dashboard");
  });

  it("a player with neither waits on the member side", () => {
    expect(homeFor({ role: "player", hasPlayer: false, tracker: null })).toBe("/dashboard");
  });

  it("is the rule the front door, the member shell and the free shell all use", () => {
    expect(code("app/page.tsx")).toContain("homePathFor(viewer)");
    const free = code("app/(free)/layout.tsx");
    expect(free).toContain('if (viewer.role !== "player") redirect("/coach")');
    expect(free).toContain('if (!side) redirect("/dashboard")');
    expect(free).toMatch(/!viewer\.demo && \(await consentDue/);
    // an invite family or a member who joined Strive Pro directly has no
    // free account, so trackerFor answers null for them. A free account
    // keeps its free app before, during and after Strive Pro
    // (lib/elite/one-app.ts keepsFreeApp); freeAccountFor is the one that
    // is not switched on (lib/elite/member-gate.ts livesInFreeApp).
    const server = code("lib/elite/tracker-server.ts");
    expect(server).toContain("if (!viewer.playerId) return { tracker, lives: true };");
    expect(server).toContain("if (!keepsFreeApp({ hasTracker: true, hasPlayer: true, tier: player?.tier, status: player?.subscription_status })) return null;");
    expect(server).toContain("return { tracker, lives: livesInFreeApp({ hasTracker: true, hasPlayer: true, player }) };");
  });

  it("signing in takes a free account to its screen in one redirect after /dashboard", () => {
    // sign-in lands every player on /dashboard (lib/elite/sign-in.ts)...
    expect(code("lib/elite/sign-in.ts")).toContain('safeNext(input.next, staff ? "/coach" : "/dashboard")');
    // ...and the member shell sends a free account straight to where it
    // opens (the week, or the four questions), not to /log to be sent on.
    const member = code("app/(player)/layout.tsx");
    expect(member).toContain("if (tracker) redirect(freeLanding(quizDone(tracker)));");
    expect(member.indexOf("redirect(freeLanding(")).toBeLessThan(member.indexOf("NO_PROFILE_GATE} />"));
    // the free shell and its two pages never send a free account anywhere
    // else: the only redirects left are for people who are not one, and
    // the week page's own check for an unanswered quiz
    const page = code("app/(free)/log/page.tsx");
    expect(page).toContain("redirect(FREE_QUIZ)");
    expect((page.match(/redirect\(/g) ?? []).length).toBe(3);
    expect(code("app/(free)/log/quiz/page.tsx")).not.toContain("redirect(FREE_HOME)");
    // a brand-new account is sent to the questions by the route itself
    expect(code("app/api/elite/auth/join/route.ts")).toContain("next: freeLanding(false)");
  });
});

describe("the line about the coached program", () => {
  it("leads to the public page on the website and is not drawn inside the App Store app", () => {
    expect(programLink(false)).toBe("/demo");
    expect(programLink(true)).toBeNull();
  });
});

describe("an invite for an email that already has a free account", () => {
  it("says what is true instead of only 'try signing in'", () => {
    expect(FREE_ACCOUNT_EXISTS_MESSAGE).toContain("already has a free training log account");
    expect(FREE_ACCOUNT_EXISTS_MESSAGE).toContain("Tell your coach");
    expect(FREE_ACCOUNT_EXISTS_MESSAGE).not.toMatch(/—|!/);
    const route = code("app/api/elite/auth/redeem/route.ts");
    const check = route.indexOf("await emailHasFreeAccount(email)");
    expect(check).toBeGreaterThan(route.indexOf("auth.admin.createUser("));
    expect(check).toBeLessThan(route.indexOf("An account with that email already exists. Try signing in."));
    expect(route).toContain('{ error: FREE_ACCOUNT_EXISTS_MESSAGE, reason: "free_account" }');
    // only when the sign-in service said the email is taken, and never for a coach invite
    expect(route).toMatch(/if \(exists && role === "player" && \(await emailHasFreeAccount\(email\)\)\)/);
    // the lookup lives with the other free-account reads
    expect(code("lib/elite/tracker-server.ts")).toContain("export async function emailHasFreeAccount(");
  });
});

// ---- What the free log must never become ------------------------------

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const rel = (p: string) => p.slice(root.length + 1);

const FREE_FILES = [
  ...walk(join(root, "app/(free)")).map(rel),
  "app/(join)/join/page.tsx",
  "app/api/elite/auth/join/route.ts",
  "app/api/elite/tracker/card/route.tsx",
  "components/elite/FreeShell.tsx",
  "components/elite/PostComposer.tsx",
  "components/elite/FriendsFeed.tsx",
  "components/elite/FriendAsk.tsx",
  "components/elite/MyWeek.tsx",
  "components/elite/send-link.ts",
  "components/elite/TrackerQuiz.tsx",
  "components/elite/ShareWeek.tsx",
  "components/elite/FriendsBoard.tsx",
  "components/elite/DaysPicker.tsx",
  "components/elite/TrackerDays.tsx",
  "components/elite/TrackerSheet.tsx",
  "components/elite/JoinForm.tsx",
  "components/elite/ProfileScreen.tsx",
  "components/elite/ClubScreen.tsx",
  "components/elite/ActionSheet.tsx",
  "components/elite/FreeAvatar.tsx",
  "components/elite/FreeIcons.tsx",
  "components/elite/FreeTopBar.tsx",
  "components/elite/FreeSettings.tsx",
  "components/elite/ProfilePhotoPicker.tsx",
  "components/elite/JoinLanding.tsx",
  "components/elite/WheelPicker.tsx",
  "components/elite/UnderAge.tsx",
  "components/elite/BlockedList.tsx",
  "components/elite/ClubsSection.tsx",
  "components/elite/ClubAsk.tsx",
  "components/elite/StarMark.tsx",
  "components/elite/PlayingForField.tsx",
  "lib/elite/tracker.ts",
  "lib/elite/tracker-ranking.ts",
  "lib/elite/tracker-server.ts",
  "lib/elite/tracker-demo.ts",
  "lib/elite/tracker-actions.ts",
];

describe("the free log stays what it is", () => {
  it("no streaks, no scores, no prizes, no prices, nothing that sounds like a machine", () => {
    // Aura, a level, a club's rank and the coaches' star are allowed; the
    // points behind aura stay inside the rules and are never on a screen.
    const banned =
      /\b(streak|leaderboard|score|badge|medal|crown|trophy|podium|price|guarantee|AI|automated|algorithm)\b|\$\d|—/i;
    for (const f of FREE_FILES) {
      const src = code(f);
      const hit = src.match(banned);
      expect(hit, `${f}: ${hit?.[0]}`).toBeNull();
    }
    for (const f of FREE_FILES.filter((f) => !f.startsWith("lib/"))) {
      const hit = code(f).match(/\bpoints?\b/i);
      expect(hit, `${f}: ${hit?.[0]}`).toBeNull();
    }
  });

  it("nothing about a day missed, and nothing announces a change of place", () => {
    const words = /\bmissed\b|\bskipped\b|rest day|behind your|fell to|dropped to|moved up|overtook|passed you|you are (first|last)/i;
    for (const f of FREE_FILES) {
      const hit = code(f).match(words);
      expect(hit, `${f}: ${hit?.[0]}`).toBeNull();
    }
    // the friends list sends nothing: no texts, no pushes, no in-app notes
    // nothing is ever sent to a player: no texts, no pushes, no in-app notes
    for (const f of [
      "lib/elite/tracker-actions.ts",
      "lib/elite/tracker-server.ts",
      "components/elite/FriendsBoard.tsx",
      "components/elite/FriendsFeed.tsx",
    ]) {
      expect(code(f), f).not.toMatch(/sendSms|sendPush|elite_notifications|sendPlayerEmail/);
    }
    // the one text goes to the coaches, once, when a post is first reported
    expect(code("lib/elite/tracker-server.ts")).not.toContain("textCoaches");
    const acts = code("lib/elite/tracker-actions.ts");
    // (and once when a club's name, or a profile's line, is first reported)
    expect((acts.match(/textCoaches\(/g) ?? []).length).toBe(3);
    expect(acts).toMatch(/if \(!count\) await textCoaches\(clubReportText\(/);
    const report = acts.slice(acts.indexOf("export async function reportPost("), acts.indexOf("type Coach ="));
    expect(report).toMatch(/if \(!count\) \{[\s\S]*?await textCoaches\(reportText\(/);
  });

  it("two tabs and the plus: Friends, then My week; no timer and no milestone anywhere", () => {
    const shell = code("components/elite/FreeShell.tsx");
    expect(shell).toMatch(/<Tab href=\{FREE_HOME\} label="Friends"[\s\S]*aria-label="Post my training"[\s\S]*<Tab href=\{FREE_WEEK\} label="My week"/);
    for (const f of ["components/elite/MyWeek.tsx", "components/elite/FriendsFeed.tsx", "components/elite/PostComposer.tsx"]) {
      expect(code(f), f).not.toMatch(/timer|stopwatch|milestone/i);
    }
    const home = code("components/elite/MyWeek.tsx");
    // a day's entries open in a sheet
    expect(home).toContain("<TrackerSheet title={dayLabel(openDay)}");
    // top to bottom: ring, days, the line, friends, share, the one line
    const order = ["<svg viewBox", "strip.map(", "{guide && (", "<FriendsBoard", "<ShareWeek", "{programHref && ("].map(
      (mark) => home.indexOf(mark)
    );
    expect(order.every((n) => n > -1)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).not.toMatch(/timer_started_at|team_sessions|own_minutes_now/);
  });

  it("the line about the coached program is hidden inside the App Store app", () => {
    expect(code("app/(free)/log/week/page.tsx")).toContain("programHref={programLink(inNativeApp())}");
    expect(code("components/elite/MyWeek.tsx")).toMatch(/\{programHref && \(/);
    // free sign-up works inside the app too (nothing is bought); the app
    // draws it because a reviewed build describes it (app-review.ts)
    expect(code("app/(join)/join/page.tsx")).not.toContain("inNativeApp");
  });
});

describe("free accounts are invisible to everything a member query reads", () => {
  const ALLOWED = new Set([
    "lib/elite/tracker-server.ts",
    "lib/elite/tracker-coach.ts",
    "lib/elite/tracker-actions.ts",
    "app/api/elite/auth/join/route.ts",
    "lib/elite/tracker-ranking.ts", // the club ranking: club names and averages only
    // bring your squad (086): who a player brought, and their first names
    "lib/elite/squad-pass-server.ts",
    // send to a parent (086): the player's own code for the page a parent pays from
    "lib/elite/parent-link-server.ts",
    // clubs as teams (077): sessions, games, events and trained together
    "lib/elite/club-teams-server.ts",
    "lib/elite/club-teams-actions.ts",
    "lib/elite/club-teams-coach.ts",
    // my drills (078): the player's own drills and takes, owner only
    "lib/elite/my-drills-server.ts",
    "lib/elite/my-drills-actions.ts",
    // every share is an invite (078): a free player's code counts on the
    // waitlist while sign-up is closed
    "lib/elite/waitlist-server.ts",
    // the daily pull (078): who posted today, for a friend's notification
    "lib/elite/free-notices-server.ts",
    // the one profile photo of every account (081): it lives in the
    // tracker-posts bucket, and before 081 a free account's pointer is
    // still read from elite_trackers
    "lib/elite/account-profile-server.ts",
    // the quiz a free account takes in the iPhone app (082) and the week's
    // set-up after it: the account's own row, after the app API's gate
    "lib/elite/free-intake-server.ts",
    // the door (090): a new free account's typed code is looked up as a
    // teammate's, and who sent them is recorded on the account's own row
    "lib/elite/free-door-server.ts",
    // the weekly club matchup (083): which clubs can be matched, and the
    // training of a matchup's stored players; what leaves it is a club's
    // name and its time per player, never a player
    "lib/elite/club-matchups-server.ts",
    // a member's finished session, put on their own free-app week once
    // (one-app.ts): the signed-in member's own row, from the tick's action
    "lib/elite/session-log.ts",
    // the training clock (089): the signed-in account's own timed entry,
    // its two photos into its own folder, and its own running clock
    "lib/elite/training-clock-server.ts",
    // the launch numbers (coach's free page): every free account, club and
    // timed entry, read only; what leaves it is counts and club names
    "lib/elite/launch-numbers-server.ts",
  ]);
  // (the post route stores nothing itself: it hands a checked photo to
  // savePost in tracker-server.ts)

  it("only the tracker files touch the free tables", () => {
    const files = ["app", "lib", "components"]
      .flatMap((d) => walk(join(root, d)))
      .filter((f) => /\.(ts|tsx)$/.test(f));
    const touching = files
      .filter((f) =>
        /elite_trackers|elite_training_logs|elite_tracker_friends|elite_tracker_blocks|elite_log_props|elite_post_reports|elite_target_table|elite_settings|tracker-posts|elite_tracker_clubs|elite_tracker_club_members|elite_club_reports|elite_tracker_star_notes|elite_line_reports|elite_tracker_drills|elite_tracker_takes/.test(
          readFileSync(f, "utf8")
        )
      )
      .map(rel)
      .filter((f) => f !== "lib/elite/tracker.ts" && f !== "lib/elite/club-teams.ts"); // comments only
    for (const f of touching) expect(ALLOWED.has(f), f).toBe(true);
    expect(code("lib/elite/tracker.ts")).not.toMatch(/\.from\(/);
    expect(code("lib/elite/club-teams.ts")).not.toMatch(/\.from\(/);
  });

  it("joining never makes a player record", () => {
    const route = code("app/api/elite/auth/join/route.ts");
    expect(route).not.toContain("elite_players");
    expect(route).toContain('.from("elite_trackers").insert(');
  });

  it("the tables are read-only to the browser and leave with the account", () => {
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect((sql.match(/enable row level security/g) ?? []).length).toBe(13);
    expect(sql).toContain("references public.elite_profiles(id) on delete cascade");
    expect(sql).toContain("references public.elite_trackers(profile_id) on delete cascade");
    // owners read; only a coach writes, and only the target table and the switches
    expect(sql.replace(/--.*$/gm, "")).not.toMatch(/\bdrop\b/i);
    const ownerPolicies =
      sql.match(
        /create policy elite_(trackers|training_logs|tracker_friends|tracker_blocks|log_props|post_reports)_\w+ on[\s\S]*?;/g
      ) ?? [];
    expect(ownerPolicies.length).toBe(12);
    for (const p of ownerPolicies) expect(p).toContain("for select");
    expect(sql).toContain("values ('free_signup_open', 'false'::jsonb)");
  });
});

describe("planning the week", () => {
  // Wed Nov 18 2026; the week is Mon Nov 16 to Sun Nov 22
  const today = "2026-11-18";

  it("takes any days of the week, each once, in order, and at least one", () => {
    expect(cleanPlanDays([4, 0, 2, 0])).toEqual([0, 2, 4]);
    expect(cleanPlanDays(["1", 6])).toEqual([1, 6]);
    expect(cleanPlanDays([0, 1, 2, 3, 4, 5, 6])).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(cleanPlanDays([])).toBeNull();
    expect(cleanPlanDays([7])).toBeNull();
    expect(cleanPlanDays([-1])).toBeNull();
    expect(cleanPlanDays([1.5])).toBeNull();
    expect(cleanPlanDays("0,1")).toBeNull();
    expect(cleanPlanDays(undefined)).toBeNull();
  });

  it("the database holds the same seven days", () => {
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).toContain("plan_days      smallint[] not null default '{}' check (plan_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])");
  });

  it("spreads the target over the days, to the nearest five minutes", () => {
    expect(perDayMinutes(240, 4)).toBe(60);
    expect(perDayMinutes(240, 7)).toBe(35); // 34.3
    expect(perDayMinutes(240, 3)).toBe(80);
    expect(perDayMinutes(360, 5)).toBe(70); // 72
    expect(perDayMinutes(30, 7)).toBe(5); // never less than five
    expect(perDayMinutes(240, 0)).toBe(0);
    expect(splitLine(240, 4)).toBe("4 days. About 1h a day.");
    expect(splitLine(240, 1)).toBe("1 day. About 4h a day.");
    expect(splitLine(360, 5)).toBe("5 days. About 1h 10m a day.");
    expect(splitLine(240, 0)).toBeNull();
    expect(planDaysLabel([0, 2, 4])).toBe("Mon, Wed, Fri");
  });

  it("the strip: planned outlined, trained filled, today marked", () => {
    const logs = [
      log("2026-11-16", 45), // Monday, planned and trained
      log("2026-11-17", 30), // Tuesday, not planned but trained
      log("2026-11-18", 60, "gym"), // today: gym only is not training
      log("2026-11-09", 90), // last week
    ];
    const strip = weekStrip(logs, [0, 2, 4], today);
    expect(strip.map((d) => d.letter).join("")).toBe("MTWTFSS");
    expect(strip.map((d) => d.day)).toEqual([
      "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22",
    ]);
    expect(strip.map((d) => d.planned)).toEqual([true, false, true, false, true, false, false]);
    expect(strip.map((d) => d.trained)).toEqual([true, true, false, false, false, false, false]);
    expect(strip.map((d) => d.today)).toEqual([false, false, true, false, false, false, false]);
    expect(strip[0].minutes).toBe(45);
    expect(strip[2].minutes).toBe(0);
  });

  it("a planned day with nothing logged is only an outline, in words too", () => {
    const strip = weekStrip([log("2026-11-16", 45)], [0, 1], today);
    expect(stripDayLabel(strip[0])).toBe("Monday, Nov 16: 45m trained");
    // Tuesday was planned and is past, with nothing logged
    expect(stripDayLabel(strip[1])).toBe("Tuesday, Nov 17: a training day");
    expect(stripDayLabel(strip[2])).toBe("Wednesday, Nov 18, today: nothing planned");
    for (const d of strip) expect(stripDayLabel(d)).not.toMatch(/missed|skipped|late|behind/i);
  });

  it("the line under the days looks at today and forward, never back", () => {
    // a planned day, nothing logged yet
    expect(todayLine([], [0, 2, 4, 5], 240, today)).toEqual({ strong: "Today is a training day.", rest: "About 1h." });
    // trained today: the next planned day this week
    expect(todayLine([log(today, 45)], [0, 2, 4, 5], 240, today)).toEqual({
      strong: "Trained today.",
      rest: "Next up: Friday, about 1h.",
    });
    // trained today and nothing else planned this week
    expect(todayLine([log(today, 45)], [0, 2], 240, today)).toEqual({ strong: "Trained today.", rest: "" });
    // gym alone is not training
    expect(todayLine([log(today, 45, "gym")], [0, 4], 240, today)).toEqual({
      strong: "",
      rest: "Next up: Friday, about 2h.",
    });
    // not a planned day, nothing ahead this week, nothing logged: no line at all
    expect(todayLine([], [0, 1], 240, today)).toBeNull();
    expect(todayLine([], [], 240, today)).toBeNull();
    // Monday and Tuesday were planned and are past: the line never says so
    const line = todayLine([], [0, 1, 4], 240, today);
    expect(`${line?.strong} ${line?.rest}`).not.toMatch(/Monday|Tuesday|missed|skipped|behind/i);
    expect(longDayLabel(today)).toBe("Wednesday, Nov 18");
  });

  it("is asked at the end of the set-up and changed from Settings", () => {
    expect(FREE_DAYS).toBe("/log/days");
    const picker = code("components/elite/DaysPicker.tsx");
    expect(picker).toContain("Which days will you train?");
    expect(picker).toContain("disabled={saving || days.length === 0}");
    expect(code("components/elite/FreeSettings.tsx")).toContain('href="/log/days"');
    const actions = code("lib/elite/tracker-actions.ts");
    expect(actions).toContain("export async function setPlanDays(");
    // the set-up is not finished without at least one day
    expect(code("lib/elite/tracker-server.ts")).toContain("return setUpDone(tracker);");
    expect(code("lib/elite/tracker.ts")).toContain("(t.plan_days ?? []).length > 0");
  });

  it("logging stays today only", () => {
    const actions = code("lib/elite/tracker-actions.ts");
    expect(actions).toMatch(/export async function logTraining\(\s*minutesInput: number,\s*kindInput: string = "training"\s*\)/);
    expect(actions).toContain("const trained_on = nyToday();");
  });
});

describe("friends", () => {
  it("a pair is stored once, the smaller id first, and nobody is their own friend", () => {
    expect(friendPair("b", "a")).toEqual({ a: "a", b: "b" });
    expect(friendPair("a", "b")).toEqual({ a: "a", b: "b" });
    expect(friendPair("a", "a")).toBeNull();
    expect(friendPair("", "a")).toBeNull();
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).toContain("primary key (a, b)");
    expect(sql).toContain("check (a < b)");
    expect(sql).toContain("for select using (a = auth.uid() or b = auth.uid())");
  });

  it("a friend sees a first name and a last initial", () => {
    expect(shortName("Marcus Bell")).toBe("Marcus B.");
    expect(shortName("  marcus   de la cruz ")).toBe("marcus C.");
    expect(shortName("Marcus")).toBe("Marcus");
    expect(shortName("Marcus B.")).toBe("Marcus B.");
    expect(shortName("")).toBe("A teammate");
    expect(addFriendQuestion(shortName("Marcus Bell"))).toBe("Send Marcus B. a friend request?");
  });

  const entry = (id: string, name: string, minutes: number) => ({ id, name, minutes });

  it("orders by training time this week, you included and marked", () => {
    const rows = friendsBoard(
      [entry("me", "Anthony E.", 135), entry("f1", "Marcus B.", 190), entry("f2", "Sam O.", 60)],
      "me"
    );
    expect(rows.map((r) => [r.place, r.name, r.time, r.me])).toEqual([
      [1, "Marcus B.", "3h 10m", false],
      [2, "Anthony E.", "2h 15m", true],
      [3, "Sam O.", "1h", false],
    ]);
  });

  it("people on the same time each get their own place, in name order (one rule, so no list shows two 2s)", () => {
    const rows = friendsBoard(
      [entry("me", "Anthony E.", 135), entry("f1", "Diego R.", 135), entry("f2", "Marcus B.", 190), entry("f3", "Jalen T.", 0), entry("f4", "Sam O.", 0)],
      "me"
    );
    expect(rows.map((r) => [r.place, r.name])).toEqual([
      [1, "Marcus B."],
      [2, "Anthony E."],
      [3, "Diego R."],
      [4, "Jalen T."],
      [5, "Sam O."],
    ]);
    // every place on the list is different
    expect(new Set(rows.map((r) => r.place)).size).toBe(rows.length);
  });

  it("lists the top ten, and you are always on it with your real place", () => {
    const friends = Array.from({ length: 14 }, (_, i) => entry(`f${i}`, `Friend ${String(i).padStart(2, "0")}`, 600 - i * 10));
    const rows = friendsBoard([...friends, entry("me", "Anthony E.", 5)], "me");
    expect(BOARD_CAP).toBe(10);
    expect(rows).toHaveLength(11);
    expect(rows.slice(0, 10).every((r) => !r.me)).toBe(true);
    expect(rows[10]).toMatchObject({ me: true, place: 15 });
    // inside the top ten you are not listed twice
    const inTop = friendsBoard([...friends, entry("me", "Anthony E.", 595)], "me");
    expect(inTop).toHaveLength(10);
    expect(inTop.filter((r) => r.me)).toHaveLength(1);
    expect(inTop[1]).toMatchObject({ me: true, place: 2 });
  });

  it("alone, the list is one line and the link", () => {
    expect(friendsBoard([entry("me", "Anthony E.", 0)], "me")).toHaveLength(1);
    expect(BOARD_TITLE).toBe("This week with your friends");
    expect(BOARD_EMPTY_LINE).toBe("Send your link to a teammate and see who trains more this week.");
    const board = code("components/elite/FriendsBoard.tsx");
    expect(board).toMatch(/friends\.length === 0 \? \(\s*<p[^>]*>\{BOARD_EMPTY_LINE\}<\/p>/);
    expect(board).toContain('{copied ? "Link copied. Send it to a teammate." : "Add a friend"}');
  });

  it("gym never counts on it", () => {
    const server = code("lib/elite/tracker-server.ts");
    const fn = server.slice(server.indexOf("export async function friendsWeekFor("), server.indexOf("export async function friendAskFor("));
    expect(fn).toContain('.eq("kind", "training")');
    // and your own row is the ring's number: training only
    expect(code("components/elite/MyWeek.tsx")).toMatch(/<FriendsBoard\s+me=\{me\}\s+myMinutes=\{minutes\}/);
  });

  it("the list only ever reads the viewer's own friends: no function reads across all players", () => {
    const server = code("lib/elite/tracker-server.ts");
    // every read of entries, anywhere a player's screens read, is tied to given ids
    const reads = [...server.matchAll(/\.from\("elite_training_logs"\)\s*\.select\([\s\S]{0,160}/g)].map((m) => m[0]);
    expect(reads.length).toBeGreaterThanOrEqual(4);
    for (const r of reads) expect(r).toMatch(/\.(eq|in)\("profile_id",/);
    // and the two writes in that file name the account they belong to
    expect(server).toContain("profile_id: input.profileId,");
    // the ids of the friends list come from the viewer's own pairs
    const fn = server.slice(server.indexOf("export async function friendsWeekFor("), server.indexOf("export async function friendAskFor("));
    expect(fn).toContain("const ids = await friendIdsOf(admin, viewer.profile.id);");
    expect(fn).toContain('.in("profile_id", some)');
    const idsOf = server.slice(server.indexOf("async function friendIdsOf("), server.indexOf("export async function friendsWeekFor("));
    expect(idsOf).toContain('.select("b").eq("a", profileId)');
    expect(idsOf).toContain('.select("a").eq("b", profileId)');
    // every read of the pairs in that file is tied to one account too
    for (const m of server.matchAll(/\.from\("elite_tracker_friends"\)\.select\([^)]*\)([\s\S]{0,40})/g)) {
      expect(m[1]).toMatch(/^\.eq\("(a|b)", profileId\)/);
    }
    // no page of all accounts is read there (that is the coach's file)
    expect(server).not.toMatch(/\.range\(from, to\)|everyRow/);
    // the one file that reads every account is the coach's, used by the coach page alone
    const importers = ["app", "lib", "components"]
      .flatMap((d) => walk(join(root, d)))
      .filter((f) => /\.(ts|tsx)$/.test(f) && /tracker-coach["']/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(importers).toEqual(["app/(coach)/coach/free/page.tsx"]);
    // and nothing a member or a free player can reach draws a list of all players
    expect(code("app/(coach)/coach/free/page.tsx")).toContain('if (viewer.role === "player") redirect("/dashboard")');
  });

  it("friends are asked for by the link only, and made only when the link's owner accepts", () => {
    expect(friendAskPath("ABCDEFGH")).toBe("/log?friend=ABCDEFGH");
    const route = code("app/api/elite/auth/join/route.ts");
    expect(route).toContain("if (referredBy) await requestFriend(userId, referredBy)");
    expect(route).not.toContain("makeFriends");
    const join = code("app/(join)/join/page.tsx");
    expect(join).toContain("if (ref && (await trackerFor(viewer))) redirect(friendAskPath(ref));");
    const page = code("app/(free)/log/page.tsx");
    expect(page).toContain("friendAskFor(viewer, cleanReferralCode(searchParams?.friend))");
    expect(code("components/elite/FriendsFeed.tsx")).toContain("<FriendAsk ask={friendAsk} />");
    // nothing is sent without the tap on Send request
    const ask = code("components/elite/FriendAsk.tsx");
    expect(ask).toContain("addFriendQuestion(asking.name)");
    expect(ask).toMatch(/onClick=\{\(\) => answer\(true\)\}[\s\S]{0,260}Send request/);
    expect((ask.match(/confirmFriend\(/g) ?? []).length).toBe(1);
    // the owner answers on the Friends tab
    expect(code("components/elite/FriendsFeed.tsx")).toContain("<FriendRequests requests={requests} clubRequests={clubRequests} />");
    expect(code("components/elite/FriendRequests.tsx")).toContain("answerFriendRequest(row.id, accept)");
    // no search and no browsing of other players, anywhere in the free app
    for (const f of ["components/elite/FriendAsk.tsx", "components/elite/FriendsBoard.tsx", "components/elite/FriendsFeed.tsx", "components/elite/FriendRequests.tsx"]) {
      expect(code(f), f).not.toMatch(/<input|search/i);
    }
  });

  it("the server only pairs the signed-in player, and making friends is not callable from a browser", () => {
    const actions = code("lib/elite/tracker-actions.ts");
    expect(actions).toContain("requestFriend(o.profileId, otherId)");
    expect(actions).not.toContain("makeFriends(");
    expect(actions).toContain("friendPair(o.profileId, friendId)");
    // the only functions a browser can call
    const exported = [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]).sort();
    expect(exported).toEqual([
      "answerClubRequest",
      "answerClubRequestsAsCoach",
      "answerFriendRequest",
      "archiveClub",
      "blockPlayer",
      "checkJoinAge",
      "clearPlayingFor",
      "confirmClub",
      "confirmFriend",
      "createClub",
      "deleteLog",
      "dismissClubReports",
      "dismissLineReports",
      "dismissReports",
      "endMyClub",
      "leaveClub",
      "logTraining",
      "makeCaptain",
      "newClubLink",
      "removeClubMember",
      "removeFriend",
      "removePost",
      "removeProfilePhoto",
      "renameClub",
      "renameMyClub",
      "reportClub",
      "reportLine",
      "reportPost",
      "saveAppVersion",
      "saveQuiz",
      "saveTargetRow",
      "setClubCaptain",
      "setFreeSignupOpen",
      "setPlanDays",
      "setPlayingFor",
      "setStar",
      "startClub",
      "toggleProps",
      "unblockPlayer",
    ]);
    const server = read("lib/elite/tracker-server.ts");
    expect(server).not.toMatch(/^\s*["']use server["']/m);
    expect(server).toContain("export async function makeFriends(");
  });

  it("a friend can be taken off from their profile, quietly", () => {
    expect(code("components/elite/FriendsBoard.tsx")).toContain("onClick={() => profile(r.id)}");
    const screen = code("components/elite/ProfileScreen.tsx");
    expect(screen).toContain("Remove from my friends");
    expect(screen).toContain("act(() => removeFriend(profile.id), () => router.push(FREE_HOME))");
    expect(screen).toContain("act(() => blockPlayer(profile.id), () => router.push(FREE_HOME))");
    // your own profile offers Edit profile and your link instead
    expect(screen).toContain("Edit profile");
    expect(screen).toContain("Share my link");
  });

  it("members still have no list of other players", () => {
    for (const f of walk(join(root, "app/(player)")).map(rel)) {
      expect(code(f), f).not.toMatch(/FriendsBoard|friendsBoard|friendsWeekFor/);
    }
  });
});
