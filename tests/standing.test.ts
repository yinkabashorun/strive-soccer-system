import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SESSION_FALLBACK_MINUTES, passedBy, sessionMinutes, sessionsToBeat } from "../lib/elite/standing";
import { PASSED_REF, friendPassedReceivers, friendPostReceivers, noticeKey, passedKey } from "../lib/elite/free-notices";
import { friendPassedNotice, noticeProblems, passedBodies, passedBody, pushTextProblems } from "../lib/elite/notices";
import { perDayMinutes } from "../lib/elite/tracker";

// "<First> just passed you" (Coach Yinka's yes, Nov 27 2026): a friend's
// own timed training put them in front of you on the friends board. One
// rule for the phone's line and the server's notification
// (lib/elite/standing.ts), one a day at most per person.

const root = join(__dirname, "..");
const code = (p: string) =>
  readFileSync(join(root, p), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

describe("who a player just passed", () => {
  const friends = [
    { id: "nico", minutes: 60 },
    { id: "diego", minutes: 75 },
    { id: "kai", minutes: 0 },
    { id: "luis", minutes: 20 },
  ];
  it("a friend who was in front before and is behind now", () => {
    expect(passedBy({ before: 30, after: 70, friends }).map((f) => f.id)).toEqual(["nico"]);
    expect(passedBy({ before: 30, after: 90, friends }).map((f) => f.id)).toEqual(["nico", "diego"]);
  });
  it("a tie is not a pass, either side of it", () => {
    // level now: not passed
    expect(passedBy({ before: 30, after: 60, friends }).map((f) => f.id)).toEqual([]);
    // level before, in front now: that friend was not in front, so was not passed
    expect(passedBy({ before: 60, after: 70, friends }).map((f) => f.id)).toEqual([]);
  });
  it("a friend with nothing on the board is never told anything", () => {
    expect(passedBy({ before: 0, after: 45, friends }).map((f) => f.id)).toEqual(["luis"]);
    expect(passedBy({ before: 0, after: 45, friends: [{ id: "kai", minutes: 0 }] })).toEqual([]);
  });
  it("a friend already behind is not passed again", () => {
    expect(passedBy({ before: 30, after: 50, friends }).map((f) => f.id)).toEqual([]);
  });
  it("nothing is passed unless the player's own time went up", () => {
    expect(passedBy({ before: 90, after: 90, friends })).toEqual([]);
    expect(passedBy({ before: 90, after: 40, friends })).toEqual([]);
  });
});

describe("a session is the player's own, and beating means passing", () => {
  it("one training day of the plan they set, or an hour", () => {
    expect(sessionMinutes(perDayMinutes(240, 4))).toBe(60);
    expect(sessionMinutes(perDayMinutes(240, 0))).toBe(SESSION_FALLBACK_MINUTES);
    expect(sessionMinutes(null)).toBe(60);
    expect(sessionMinutes(45)).toBe(45);
  });
  it("level is not beating: exactly one session back takes two", () => {
    expect(sessionsToBeat(18, 60)).toBe(1);
    expect(sessionsToBeat(59, 60)).toBe(1);
    expect(sessionsToBeat(60, 60)).toBe(2);
    expect(sessionsToBeat(135, 45)).toBe(4);
    expect(sessionsToBeat(0, 60)).toBe(1);
    expect(sessionsToBeat(-5, 0)).toBe(1);
  });
  it("the phone reads the same rule: it is not written twice", () => {
    const phone = code("mobile/src/social-view.ts");
    expect(phone).toContain('import { SESSION_FALLBACK_MINUTES, landedLines, sessionMinutes, sessionsToBeat } from "@shared/standing";');
    expect(phone).not.toMatch(/export function landedLines/);
    expect(phone).not.toMatch(/export function sessions(ToBeat|Minutes)|export function sessionMinutes/);
  });
});

describe("the words", () => {
  it("say what happened in his words: the fact, then the teammate's jab", () => {
    const one = friendPassedNotice({ first: "Nico", minutes: 45, nyDate: "2026-11-27", to: "u9" });
    expect({ title: one.title, path: one.path, key: one.key }).toEqual({
      title: "Nico just passed you",
      path: "/log",
      key: "friend_passed:2026-11-27",
    });
    // a mix of three (the voice guide, moment 1), held still by who and the day
    expect(passedBodies(45)).toEqual([
      "Trained 45m just now. You good with that?",
      "45m just now. You letting that stand?",
      "Put in 45m just now. Let's go.",
    ]);
    expect(passedBodies(45)).toContain(one.body);
    expect(friendPassedNotice({ first: "Nico", minutes: 45, nyDate: "2026-11-27", to: "u9" }).body).toBe(one.body);
    expect(passedBodies(75)[0]).toBe("Trained 1h 15m just now. You good with that?");
    expect(passedBodies(0)[0]).toBe("Trained 1m just now. You good with that?");
    // the cold slogan is the version that makes him turn notifications off
    expect(passedBody(45)).not.toMatch(/your move/i);
  });
  it("no order, no sale, nothing missed, no shouting, and it names the friend", () => {
    for (const [minutes, to] of [1, 45, 150].flatMap((m) => ["a", "b", "c", "d", "e"].map((to) => [m, to] as const))) {
      const n = friendPassedNotice({ first: "Nico", minutes, nyDate: "2026-11-27", to });
      expect(noticeProblems(n)).toEqual([]);
      expect(pushTextProblems({ title: n.title, body: n.body })).toEqual([]);
      expect(`${n.title} ${n.body}`).not.toMatch(/\b(they|them|their)\b|behind|missed|streak|!|Strive Pro|upgrade/i);
      // a free account has no bell: the push is all of it, under Friends
      expect([n.push, n.bell, n.topic]).toEqual([true, false, "friends"]);
    }
  });
  it("opens Friends, the page a friend's post opens (so builds 10 and 11 open it too)", () => {
    const routes = code("lib/elite/notice-routes.ts");
    expect(friendPassedNotice({ first: "Nico", minutes: 45, nyDate: "2026-11-27" }).path).toBe("/log");
    expect(routes).toContain('if (path === "/log") return home;');
    expect(routes).toContain('if (path === "/log") return "/(free)/friends";');
  });
});

describe("once a day, to the right people", () => {
  it("one a day per person, whoever passes them", () => {
    expect(passedKey("2026-11-27")).toEqual({ kind: "friend_post", ny_date: "2026-11-27", ref: PASSED_REF });
    expect(passedKey("2026-11-27")).toEqual(passedKey("2026-11-27"));
    expect(passedKey("2026-11-28")).not.toEqual(passedKey("2026-11-27"));
  });
  it("its claim never meets a friend's-post claim, and fits the ledger as it is (no migration)", () => {
    expect(passedKey("2026-11-27")).not.toEqual(noticeKey("friend_post", { today: "2026-11-27" }));
    expect(PASSED_REF).toBe("passed");
    // the ledger's kind column is held to these two values (078)
    const ledger = readFileSync(join(root, "supabase/migrations/078_my_drills_and_reminders.sql"), "utf8");
    expect(ledger).toContain("check (kind in ('friend_post', 'props'))");
    expect(ledger).toContain("primary key (profile_id, kind, ny_date, ref)");
    expect(["friend_post", "props"]).toContain(passedKey("2026-11-27").kind);
  });
  it("never across a block either way, only to a device, never to the player", () => {
    const base = { posterId: "diego", passed: ["ana", "ben", "cam", "diego", "ana"], blocks: [], withDevice: new Set(["ana", "ben", "cam", "diego"]) };
    expect(friendPassedReceivers(base)).toEqual(["ana", "ben", "cam"]);
    expect(friendPassedReceivers({ ...base, withDevice: new Set(["ben"]) })).toEqual(["ben"]);
    expect(
      friendPassedReceivers({
        ...base,
        blocks: [
          { blocker: "diego", blocked: "ana" },
          { blocker: "ben", blocked: "diego" },
        ],
      })
    ).toEqual(["cam"]);
  });
  it("one training, one push: a friend told 'passed you' is not also told 'just posted'", () => {
    const base = { posterId: "diego", friends: ["ana", "ben"], blocks: [], withDevice: new Set(["ana", "ben"]), postedToday: new Set<string>() };
    expect(friendPostReceivers(base)).toEqual(["ana", "ben"]);
    expect(friendPostReceivers({ ...base, skip: ["ana"] })).toEqual(["ben"]);
  });
});

describe("the sender", () => {
  const src = code("lib/elite/free-notices-server.ts");
  const fn = src.slice(src.indexOf("export async function noticeFriendPassed"), src.indexOf("export async function noticeProps"));
  it("reads the friends board's own count: training, never typed, this week, friends only", () => {
    expect(fn).toContain("friendIdsOf(admin, input.posterId)");
    const board = src.slice(src.indexOf("async function boardEntries"), src.indexOf("export async function noticeFriendPassed"));
    expect(board).toContain('.eq("kind", "training")');
    expect(board).toContain('.neq("proof", TYPED)');
    expect(board).toContain('.gte("trained_on", monday)');
    expect(board).toContain('.lte("trained_on", sunday)');
    // the same rows the board on the Week tab adds up
    const week = code("lib/elite/tracker-server.ts");
    const boardOnWeek = week.slice(week.indexOf("export async function friendsWeekFor"));
    expect(boardOnWeek).toContain('.eq("kind", "training")');
    expect(boardOnWeek).toContain('.neq("proof", TYPED)');
  });
  it("the time before is the week without the entry just written; an entry not on the board passes nobody", () => {
    expect(fn).toContain("const entry = rows.find((r) => r.id === input.entryId && r.profile_id === input.posterId);");
    expect(fn).toContain("if (!entry) return [];");
    expect(fn).toContain("before: after - entry.minutes,");
  });
  it("never at night and never with no push set up (the friend notices' own gate), never across a block", () => {
    expect(fn).toContain("const admin = ready();");
    expect(src).toContain("if (isQuietTime(nyClock(new Date()))) return null;");
    expect(fn).toContain("blocksWith(admin, input.posterId, passed)");
    expect(fn).toContain("friendPassedReceivers({ posterId: input.posterId, passed, blocks, withDevice: devices })");
  });
  it("claims before it sends, through the one sender, with the training that did the passing", () => {
    const claimAt = fn.indexOf("claim(admin, id, key.kind, key, input.today)");
    const sendAt = fn.indexOf("notifyProfile(id, friendPassedNotice({ first, minutes: entry.minutes, nyDate: input.today, to: id }))");
    expect(claimAt).toBeGreaterThan(-1);
    expect(sendAt).toBeGreaterThan(claimAt);
    expect(fn).toContain("const key = passedKey(input.today);");
    // a notice that cannot go never fails the training that caused it
    expect(fn).toMatch(/\} catch \{\s*return \[\];\s*\}/);
  });
});

describe("what sets it off: timed training going on the board, once", () => {
  it("a finished clock: only the write that made the entry, training only, before 'just posted'", () => {
    const route = code("app/api/app/free/clock/finish/route.ts");
    const fresh = route.slice(route.indexOf("if (saved.fresh) {"));
    expect(fresh).toContain('kind === "training" ? await noticeFriendPassed({ posterId: viewer.profile.id, entryId: saved.id, today }).catch(() => []) : [];');
    expect(fresh.indexOf("noticeFriendPassed(")).toBeLessThan(fresh.indexOf("noticeFriendPost(viewer.profile.id, today, passed, { kind, minutes: saved.minutes, timed: true })"));
    expect(route.indexOf("saveClockPost(")).toBeLessThan(route.indexOf("noticeFriendPassed("));
    // nowhere else in the route
    expect((route.match(/noticeFriendPassed\(/g) ?? []).length).toBe(1);
  });
  it("a finished Strive Pro session: after the insert that put it on the week, never for a second write", () => {
    const log = code("lib/elite/session-log.ts");
    const settle = log.slice(log.indexOf("export async function settleSessionLog("), log.indexOf("export async function settleSessionLogForDrill"));
    const insertAt = settle.indexOf('.from("elite_training_logs").insert({');
    const againAt = settle.indexOf('if (error) return String(error.code ?? "") === "23505";');
    const tellAt = settle.indexOf("await noticeFriendPassed({ posterId: i.profileId, entryId: id, today: nyToday() }).catch(() => []);");
    expect(insertAt).toBeGreaterThan(-1);
    expect(againAt).toBeGreaterThan(insertAt);
    expect(tellAt).toBeGreaterThan(againAt);
  });
  it("a typed length never sets it off: no other writer of an entry calls it", () => {
    const callers = ["app/api/elite/tracker/post/route.ts", "lib/elite/tracker-server.ts", "lib/elite/tracker-actions.ts", "lib/elite/club-teams-actions.ts", "lib/elite/training-clock-server.ts"];
    for (const f of callers) expect(code(f), f).not.toContain("noticeFriendPassed");
  });
});

describe("the Friends switch says what it turns off", () => {
  it("names a friend passing you beside a friend's post", async () => {
    const { TOPIC_CHOICE } = await import("../lib/elite/notices");
    expect(TOPIC_CHOICE.friends.detail).toBe("A friend posted or passed you, props, your earned month.");
    expect(pushTextProblems({ title: TOPIC_CHOICE.friends.label, body: TOPIC_CHOICE.friends.detail })).toEqual([]);
  });
});
