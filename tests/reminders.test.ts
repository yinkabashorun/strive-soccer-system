import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nyDateOf, nyHourOf, reminderDecision, usualHour, type ReminderInput } from "../lib/elite/reminders";
import { goalLadder } from "../lib/elite/home";
import {
  ONE_MORE_LINE,
  afterSessionLine,
  groupSessions,
  oneMoreLine,
  planSessionCount,
  planSessionsLeft,
} from "../lib/elite/session-flow";
import type { Homework } from "../lib/elite/types";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// An instant at a New York hour on Nov 18 2026 (EST, UTC-5).
const nyAt = (hour: number, day = 18) => new Date(Date.UTC(2026, 10, day, hour + 5, 10)).toISOString();

describe("the usual time", () => {
  it("reads New York hours and dates", () => {
    expect(nyHourOf(nyAt(17))).toBe(17);
    expect(nyDateOf(nyAt(23))).toBe("2026-11-18");
    expect(nyHourOf("nonsense")).toBeNull();
  });

  it("is the median hour of the latest ten completed drills", () => {
    const at = [16, 17, 17, 17, 18, 19, 20].map((h, i) => nyAt(h, 10 + i));
    expect(usualHour(at)).toBe(17);
    // an even count takes the earlier middle hour
    expect(usualHour([nyAt(16, 1), nyAt(17, 2), nyAt(19, 3), nyAt(20, 4)])).toBe(17);
  });

  it("only the latest ten count", () => {
    const old = Array.from({ length: 10 }, (_, i) => nyAt(7, 1 + i)); // mornings, long ago
    const recent = Array.from({ length: 10 }, (_, i) => nyAt(18, 15 + i));
    expect(usualHour([...old, ...recent])).toBe(18);
  });

  it("fewer than three drills to go on: no usual time, so no reminder", () => {
    expect(usualHour([nyAt(17), nyAt(18, 19)])).toBeNull();
    expect(usualHour([null, undefined, "bad", nyAt(17)])).toBeNull();
    expect(usualHour([])).toBeNull();
  });
});

describe("whether to send", () => {
  const base: ReminderInput = {
    nyHour: 17,
    nyDay: 3,
    usualHour: 17,
    notificationsOn: true,
    onBreak: false,
    hasWeek: true,
    sessionsLeft: 2,
    trainedToday: false,
  };

  it("sends at their hour, Monday to Saturday", () => {
    expect(reminderDecision(base)).toEqual({ send: true });
    expect(reminderDecision({ ...base, nyDay: 1 }).send).toBe(true);
    expect(reminderDecision({ ...base, nyDay: 6 }).send).toBe(true);
  });

  it("never on a Sunday", () => {
    expect(reminderDecision({ ...base, nyDay: 7 })).toEqual({ send: false, why: "sunday" });
  });

  it("never at another hour, and never without a usual time", () => {
    expect(reminderDecision({ ...base, nyHour: 16 }).send).toBe(false);
    expect(reminderDecision({ ...base, usualHour: null })).toEqual({ send: false, why: "no usual time yet" });
  });

  it("never to a member who did not turn notifications on", () => {
    expect(reminderDecision({ ...base, notificationsOn: false }).send).toBe(false);
  });

  it("never on a break", () => {
    expect(reminderDecision({ ...base, onBreak: true })).toEqual({ send: false, why: "on a break" });
  });

  it("never once the week is complete, or before there is a week", () => {
    expect(reminderDecision({ ...base, sessionsLeft: 0 })).toEqual({ send: false, why: "week complete" });
    expect(reminderDecision({ ...base, hasWeek: false }).send).toBe(false);
  });

  it("never when they already trained today", () => {
    expect(reminderDecision({ ...base, trainedToday: true })).toEqual({ send: false, why: "trained today" });
  });
});

describe("at most one a day", () => {
  it("is held by the database: one row per member per New York date, claimed before sending", () => {
    const sql = read("supabase/migrations/078_my_drills_and_reminders.sql");
    expect(sql).toMatch(/create table if not exists public\.elite_training_reminders[\s\S]*primary key \(player_id, ny_date\)/);
    expect(sql).toContain("elite_training_reminders enable row level security");
    const server = read("lib/elite/reminders-server.ts");
    expect(server).toContain('from("elite_training_reminders").insert({ player_id: playerId, ny_date: nyDate })');
    expect(server).toContain("if (day === 7) return run;");
  });

  it("is sent by the hourly cron, which still reads the database fresh", () => {
    const route = read("app/api/elite/cron/weekly-plans/route.ts");
    expect(route).toContain("await sendTrainingReminders()");
    expect(route).toContain('export const dynamic = "force-dynamic"');
    expect(route).toContain('export const fetchCache = "force-no-store"');
    expect(route).toContain('.from("elite_training_reminders")');
  });
});

// ---- "One more session completes your week" and the goal ladder --------

const hw = (session: number, completed: boolean, extra = false): Homework => ({
  id: `${session}-${Math.random()}`,
  player_id: "p",
  week: 3,
  session,
  is_extra: extra,
  title: "Drill",
  exercise: "",
  reps: "",
  video_url: null,
  notes: null,
  completed,
  completed_at: null,
  sort: 0,
});

describe("one more session completes your week", () => {
  it("counts plan sessions with work left; Extra work never counts", () => {
    const sessions = groupSessions([hw(1, true), hw(2, true), hw(3, false), hw(4, true), hw(5, false, true)]);
    expect(planSessionCount(sessions)).toBe(4);
    expect(planSessionsLeft(sessions, {})).toBe(1);
    expect(planSessionsLeft(sessions, {}, 3)).toBe(0); // finishing session 3 completes the week
  });

  it("is said when exactly one is left, and never otherwise", () => {
    expect(oneMoreLine(1)).toBe("One more session completes your week.");
    expect(oneMoreLine(0)).toBeNull();
    expect(oneMoreLine(2)).toBeNull();
    expect(afterSessionLine(1)).toBe(ONE_MORE_LINE);
  });

  it("shows on Home and on the finish screen", () => {
    const card = read("components/elite/TodaySession.tsx");
    expect(card).toContain("oneMoreLine(left)");
    expect(card).toContain("planSessionsLeft(sessions, done, open.group.n)");
    expect(read("components/elite/SessionPlayer.tsx")).toContain("afterSessionLine(sessionsLeftAfter)");
  });
});

describe("the goal ladder", () => {
  it("goal, this block's focus, this week, top to bottom", () => {
    expect(
      goalLadder({ programGoal: "Make the squad", onboardingGoal: "Two-footed", focusName: "Weak foot", sessionsDone: 2, sessionsTotal: 4 })
    ).toEqual([
      { key: "goal", label: "Goal", value: "Make the squad" },
      { key: "focus", label: "This block", value: "Weak foot" },
      { key: "week", label: "This week", value: "2 of 4" },
    ]);
  });

  it("falls back to the onboarding goal, and leaves out what is not there", () => {
    expect(goalLadder({ programGoal: "  ", onboardingGoal: "Two-footed", sessionsDone: 0, sessionsTotal: 4 }).map((r) => r.value)).toEqual([
      "Two-footed",
      "0 of 4",
    ]);
    expect(goalLadder({ sessionsDone: 1, sessionsTotal: 6 }).map((r) => r.key)).toEqual(["week"]);
    expect(goalLadder({ sessionsDone: 0, sessionsTotal: 0 })).toEqual([]);
  });

  it("never counts past the week", () => {
    expect(goalLadder({ sessionsDone: 9, sessionsTotal: 4 })[0].value).toBe("4 of 4");
  });

  it("Home feeds it the program's goal and focus for the week being trained", () => {
    const page = read("app/(player)/dashboard/page.tsx");
    expect(page).toContain("goal={{ program: program?.quiz.goal ?? null, onboarding: player.goals[0] ?? null }}");
    expect(page).toContain("focus={programWeekFor(program, contentWeek)?.focusName ?? null}");
    expect(read("components/elite/TodaySession.tsx")).toContain("goalLadder({");
  });
});
