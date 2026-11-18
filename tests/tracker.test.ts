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
  cleanJoin,
  cleanKind,
  cleanReferralCode,
  cleanTarget,
  dayLabel,
  freeLanding,
  labelOf,
  programLink,
  gymThisWeekLine,
  homeFor,
  joinLink,
  joinedLine,
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
    const home = code("app/(free)/log/page.tsx");
    expect(home).toContain("gym={tracksGym(tracker.grade)}");
    expect(home).not.toContain("tracksGym(tracker.level)");
    expect(code("app/api/elite/tracker/card/route.tsx")).toContain("tracksGym(tracker.grade)");
    for (const f of ["lib/elite/tracker-actions.ts", "lib/elite/tracker-server.ts", "app/(free)/log/page.tsx"]) {
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
    expect(refuse).toBeLessThan(actions.indexOf('.from("elite_training_logs")\n    .insert('));
    // the grade comes from the player's own saved row, never from the browser
    expect(actions).toContain("grade: tracker.grade");
    expect(GYM_REFUSED_MESSAGE).toBe("Gym work is logged by players in high school or older.");
  });

  it("has no target and shows one quiet line, only when there is gym this week", () => {
    expect(gymThisWeekLine(0)).toBeNull();
    expect(gymThisWeekLine(90)).toBe("Gym this week: 1h 30m");
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).not.toMatch(/gym_target|gym_minutes/);
    const home = code("components/elite/TrackerHome.tsx");
    // the switch is drawn only for a player who tracks gym, and resets after a log
    expect(home).toMatch(/\{gym && \(\s*<div\s+role="radiogroup"/);
    expect(home).toContain('setKind("training");');
    expect(code("app/(free)/log/page.tsx")).toContain("gym={tracksGym(tracker.grade)}");
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

  it("points at /join on the real domain and says how many joined", () => {
    expect(joinLink("https://thestriveapp.com", "ABCDEFGH")).toBe("https://thestriveapp.com/join?ref=ABCDEFGH");
    expect(joinLink("https://thestriveapp.com/", "ABCDEFGH")).toBe("https://thestriveapp.com/join?ref=ABCDEFGH");
    expect(joinedLine(0)).toBe("No one has joined with your link yet.");
    expect(joinedLine(1)).toBe("1 teammate joined with your link.");
    expect(joinedLine(7)).toBe("7 teammates joined with your link.");
  });

  it("promises nothing for inviting", () => {
    const row = code("components/elite/InviteRow.tsx");
    expect(row).not.toMatch(/unlock|reward|earn|\bpro\b|free month/i);
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

  it("the agreement lines say what a free account stores and how to stop texts", () => {
    const all = FREE_AGREEMENT_POINTS.join(" ");
    expect(all).toContain("the training you log");
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

  it("a free account that has not answered the four questions opens on them, in one step", () => {
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
    expect(free).toContain('if (!tracker) redirect("/dashboard")');
    expect(free).toMatch(/!viewer\.demo && \(await consentDue/);
    // a member has a player record, so trackerFor answers null for them
    expect(code("lib/elite/tracker-server.ts")).toContain("if (viewer.playerId) return null;");
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
  "app/(auth)/join/page.tsx",
  "app/api/elite/auth/join/route.ts",
  "app/api/elite/tracker/card/route.tsx",
  "components/elite/TrackerHome.tsx",
  "components/elite/TrackerQuiz.tsx",
  "components/elite/ShareWeek.tsx",
  "components/elite/InviteRow.tsx",
  "components/elite/JoinForm.tsx",
  "lib/elite/tracker.ts",
  "lib/elite/tracker-server.ts",
  "lib/elite/tracker-actions.ts",
];

describe("the free log stays what it is", () => {
  it("no streaks, no boards, no scores, no prices, nothing that sounds like a machine", () => {
    const banned =
      /\b(streak|leaderboard|rank(ing|ed|s)?|points?|score|badge|price|guarantee|AI|automated|algorithm)\b|\$\d|—/i;
    for (const f of FREE_FILES) {
      const src = code(f);
      const hit = src.match(banned);
      expect(hit, `${f}: ${hit?.[0]}`).toBeNull();
    }
  });

  it("the home screen has no timer and no milestone", () => {
    const home = code("components/elite/TrackerHome.tsx");
    expect(home).not.toMatch(/timer|stopwatch|milestone/i);
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).not.toMatch(/timer_started_at|team_sessions|own_minutes_now/);
  });

  it("the line about the coached program is hidden inside the App Store app", () => {
    expect(code("app/(free)/log/page.tsx")).toContain("programHref={programLink(inNativeApp())}");
    expect(code("components/elite/TrackerHome.tsx")).toMatch(/\{programHref && \(/);
    expect(code("app/(auth)/join/page.tsx")).toContain('if (inNativeApp()) redirect("/login")');
  });
});

describe("free accounts are invisible to everything a member query reads", () => {
  const ALLOWED = new Set([
    "lib/elite/tracker-server.ts",
    "lib/elite/tracker-actions.ts",
    "app/api/elite/auth/join/route.ts",
  ]);

  it("only the tracker files touch the free tables", () => {
    const files = ["app", "lib", "components"]
      .flatMap((d) => walk(join(root, d)))
      .filter((f) => /\.(ts|tsx)$/.test(f));
    const touching = files
      .filter((f) => /elite_trackers|elite_training_logs|elite_target_table|elite_settings/.test(readFileSync(f, "utf8")))
      .map(rel)
      .filter((f) => f !== "lib/elite/tracker.ts"); // comments only
    for (const f of touching) expect(ALLOWED.has(f), f).toBe(true);
    expect(code("lib/elite/tracker.ts")).not.toMatch(/\.from\(/);
  });

  it("joining never makes a player record", () => {
    const route = code("app/api/elite/auth/join/route.ts");
    expect(route).not.toContain("elite_players");
    expect(route).toContain('.from("elite_trackers").insert(');
  });

  it("the tables are read-only to the browser and leave with the account", () => {
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect((sql.match(/enable row level security/g) ?? []).length).toBe(4);
    expect(sql).toContain("references public.elite_profiles(id) on delete cascade");
    expect(sql).toContain("references public.elite_trackers(profile_id) on delete cascade");
    // owners read; only a coach writes, and only the target table and the switches
    expect(sql.replace(/--.*$/gm, "")).not.toMatch(/\bdrop\b/i);
    const ownerPolicies = sql.match(/create policy elite_(trackers|training_logs)_\w+ on[\s\S]*?;/g) ?? [];
    expect(ownerPolicies.length).toBe(4);
    for (const p of ownerPolicies) expect(p).toContain("for select");
    expect(sql).toContain("values ('free_signup_open', 'false'::jsonb)");
  });
});
