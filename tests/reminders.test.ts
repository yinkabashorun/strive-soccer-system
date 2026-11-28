import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NO_HISTORY_HOUR_SATURDAY,
  NO_HISTORY_HOUR_WEEKDAY,
  REMINDERS_BEFORE_PAUSE,
  REMINDER_CHOICES,
  REMINDER_QUESTION,
  choiceForHour,
  cleanReminderHour,
  nyDateOf,
  nyHourOf,
  reminderChoice,
  reminderDecision,
  reminderFacts,
  reminderHourFor,
  reminderStage,
  remindersSinceTick,
  usualHour,
  type ReminderInput,
} from "../lib/elite/reminders";
import { reminderNotice } from "../lib/elite/notices";
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
    hour: 17,
    fromDefault: false,
    wentLiveToday: false,
    notificationsOn: true,
    topicOff: false,
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

  it("never at another hour", () => {
    expect(reminderDecision({ ...base, nyHour: 16 })).toEqual({ send: false, why: "not their hour" });
  });

  it("never to a member who turned Your week off", () => {
    expect(reminderDecision({ ...base, topicOff: true })).toEqual({ send: false, why: "turned off" });
  });

  it("never on the day their week is announced, whatever their hour", () => {
    // the 4:00 PM announcement is the one thing they hear from us that day
    for (const fromDefault of [true, false]) {
      expect(reminderDecision({ ...base, fromDefault, wentLiveToday: true })).toEqual({
        send: false,
        why: "the week went live today",
      });
      expect(reminderDecision({ ...base, fromDefault, wentLiveToday: false }).send).toBe(true);
    }
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

describe("whose hour it is: their own choice first", () => {
  it("their choice, else the hour they train at, else the default for the day", () => {
    expect(reminderHourFor({ chosen: 7, learned: 17, nyDay: 3 })).toEqual({ hour: 7, fromDefault: false });
    expect(reminderHourFor({ chosen: null, learned: 17, nyDay: 3 })).toEqual({ hour: 17, fromDefault: false });
    expect(reminderHourFor({ chosen: undefined, learned: null, nyDay: 3 })).toEqual({ hour: NO_HISTORY_HOUR_WEEKDAY, fromDefault: true });
    expect(reminderHourFor({ chosen: null, learned: null, nyDay: 6 })).toEqual({ hour: NO_HISTORY_HOUR_SATURDAY, fromDefault: true });
    // a stored hour outside the day is not used
    expect(reminderHourFor({ chosen: 3, learned: null, nyDay: 2 }).fromDefault).toBe(true);
  });

  it("with no history: 4 PM on a weekday, 10 AM on a Saturday, one number each", () => {
    expect(NO_HISTORY_HOUR_WEEKDAY).toBe(16);
    expect(NO_HISTORY_HOUR_SATURDAY).toBe(10);
  });

  it("the question and its four answers, one tap each", () => {
    expect(REMINDER_QUESTION).toBe("When do you usually train?");
    expect(REMINDER_CHOICES.map((c) => [c.label, c.hour])).toEqual([
      ["Before school", 7],
      ["After school", 16],
      ["Evening", 19],
      ["It changes", null],
    ]);
    expect(reminderChoice("after_school")?.hour).toBe(16);
    // "It changes" stores nothing: the hour they are learned to train at is used
    expect(reminderChoice("changes")?.hour).toBeNull();
    expect(reminderChoice("midnight")).toBeNull();
    expect(reminderChoice(16)).toBeNull();
    expect(choiceForHour(19)).toBe("evening");
    expect(choiceForHour(null)).toBe("changes");
    expect(choiceForHour(13)).toBeNull();
    for (const c of REMINDER_CHOICES) if (c.hour !== null) expect(cleanReminderHour(c.hour)).toBe(c.hour);
    expect(cleanReminderHour(4)).toBeNull();
    expect(cleanReminderHour(22)).toBeNull();
    expect(cleanReminderHour(16.5)).toBeNull();
  });

  it("is asked once, right after a yes to notifications, never at sign-up or at launch", () => {
    // the website: the ask screen after the first finished session
    const web = read("components/elite/PushOptIn.tsx");
    expect(web).toContain("REMINDER_QUESTION");
    expect(web).toMatch(/const open = on && variant === "member" \? await reminderTimeOpen\(\)/);
    // the iPhone app: the finish screen, the same step as the ask
    const phone = read("mobile/app/session/[n].tsx");
    expect(phone).toContain('setPush(on && reminder ? "time" : "done")');
    expect(phone).toContain("saveNoticePrefs.mutate({ reminder: key })");
    for (const f of ["mobile/app/sign-in.tsx", "mobile/app/_layout.tsx", "components/elite/SignupForm.tsx"]) {
      expect(read(f), f).not.toMatch(/REMINDER_QUESTION|ReminderChips|ReminderChoices/);
    }
  });
});

describe("what the reminder says", () => {
  const drill = (session: number, completed: boolean, minutes: number, extra = false): Homework => ({
    ...hw(session, completed, extra),
    duration_min: minutes,
  });

  it("the next session with work left, as its card shows it", () => {
    const week = groupSessions([
      drill(1, true, 6),
      drill(1, true, 5),
      drill(2, false, 6),
      drill(2, false, 5),
      drill(2, false, 6),
      drill(2, false, 5),
      drill(3, false, 6),
    ]);
    const facts = reminderFacts(week);
    expect(facts).toEqual({ session: 2, drills: 4, drillsLeft: 4, minutes: 22, lastOpen: false });
    // the ordinary day rotates its title among the true ones (voice guide,
    // moment 9), held still by who and the day
    const n = reminderNotice({ ...facts!, nyDate: "2026-11-24" });
    expect([
      ["Session 2 is ready", "4 drills, about 22 minutes."],
      ["22 minutes today. That's it.", "Session 2 is ready. 22 minutes."],
    ]).toContainEqual([n.title, n.body]);
    expect(reminderNotice({ ...facts!, nyDate: "2026-11-24" })).toEqual(n);
  });

  it("a session already started says how many drills are to go", () => {
    const week = groupSessions([drill(1, true, 6), drill(1, false, 5), drill(1, false, 6), drill(2, false, 6)]);
    const facts = reminderFacts(week);
    expect(facts).toMatchObject({ session: 1, drills: 3, drillsLeft: 2, lastOpen: false });
    const n = reminderNotice({ ...facts!, nyDate: "2026-11-24" });
    expect([n.title, n.body]).toEqual(["Session 1 is where you left it", "2 drills to go."]);
  });

  it("the last plan session left says it completes the week; Extra work never counts", () => {
    const week = groupSessions([drill(1, true, 6), drill(2, false, 11), drill(2, false, 11), drill(3, false, 6, true)]);
    const facts = reminderFacts(week);
    expect(facts).toEqual({ session: 2, drills: 2, drillsLeft: 2, minutes: 22, lastOpen: true });
    const n = reminderNotice({ ...facts!, nyDate: "2026-11-24" });
    expect([n.title, n.body]).toEqual(["One more session completes your week", "Session 2, about 22 minutes."]);
  });

  it("nothing left says nothing", () => {
    expect(reminderFacts(groupSessions([drill(1, true, 6)]))).toBeNull();
    expect(reminderFacts([])).toBeNull();
  });

  it("the server reads the planned minutes and builds the words from the week", () => {
    const server = read("lib/elite/reminders-server.ts");
    expect(server).toContain("duration_min");
    expect(server).toContain("reminderFacts(");
    expect(server).toContain("reminderNotice({ ...facts, area: p.weaknesses?.[0] ?? null, nyDate: today, to: p.id })");
    // the weakest area rides in the roster's own read, no second query
    expect(server).toContain("reminder_hour, reminders_paused_at, weaknesses");
  });
});

describe("it stops on its own", () => {
  it("counts the reminders sent since the player last ticked a drill", () => {
    const days = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"];
    expect(remindersSinceTick(days, null)).toBe(4);
    expect(remindersSinceTick(days, "2026-11-17")).toBe(2);
    expect(remindersSinceTick(days, "2026-11-19")).toBe(0);
    expect(remindersSinceTick([], null)).toBe(0);
  });

  it("five unanswered in a row, then one last word, then nothing", () => {
    expect(REMINDERS_BEFORE_PAUSE).toBe(5);
    const stage = (sinceTick: number) => reminderStage({ sinceTick, pausedAt: null, lastTickAt: null });
    for (const n of [0, 1, 2, 3, 4]) expect(stage(n), String(n)).toBe("remind");
    expect(stage(5)).toBe("pause_notice");
    for (const n of [6, 7, 30]) expect(stage(n), String(n)).toBe("silent");
  });

  it("stays silent after the pause, even once the ledger of days has been cleaned", () => {
    expect(reminderStage({ sinceTick: 0, pausedAt: "2026-11-20T21:00:00Z", lastTickAt: "2026-11-10T21:00:00Z" })).toBe("silent");
    expect(reminderStage({ sinceTick: 0, pausedAt: "2026-11-20T21:00:00Z", lastTickAt: null })).toBe("silent");
  });

  it("one drill ticked starts them again", () => {
    expect(reminderStage({ sinceTick: 0, pausedAt: "2026-11-20T21:00:00Z", lastTickAt: "2026-11-22T21:00:00Z" })).toBe("remind");
  });

  it("the server marks the pause, sends the last word once, and counts it", () => {
    const server = read("lib/elite/reminders-server.ts");
    expect(server).toContain("reminderStage(");
    expect(server).toContain("reminders_paused_at");
    expect(server).toContain("remindersPausedNotice({ nyDate: today })");
    expect(server).toContain("run.paused++");
    // the pause notice takes the day's one claim like any reminder
    const claim = server.indexOf("claimReminder(admin, p.id, today)");
    expect(server.indexOf("remindersPausedNotice({ nyDate: today })")).toBeGreaterThan(claim);
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
