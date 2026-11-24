import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The notification system, apart from its words (tests/push-texts.test.ts
// is the list of those): the ONE sender and its claim, where a notice
// opens in the iPhone app, the choices a person has, the onboarding text's
// three days, and migration 088.

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const code = (p: string) => read(p).replace(/^\s*\/\/.*$/gm, "");

// ---- the sender, against a stand-in database -------------------------

type Row = Record<string, unknown>;
const db = {
  has088: true,
  failAll: false,
  off: [] as string[],
  keys: new Set<string>(),
  inserts: [] as Row[],
  throws: false,
};
const pushes: { to: string; kind: "player" | "profile"; payload: Record<string, unknown> }[] = [];

function fakeClient() {
  const one = (result: unknown) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) });
  return {
    from(table: string) {
      if (db.throws) throw new Error("down");
      if (table === "elite_notifications") {
        return {
          insert: async (row: Row) => {
            if (db.failAll) return { error: { code: "XX000" } };
            if ("dedupe_key" in row || "url" in row) {
              if (!db.has088) return { error: { code: "PGRST204", message: "Could not find the 'dedupe_key' column" } };
              const key = row.dedupe_key ? `${row.player_id}|${row.dedupe_key}` : null;
              if (key && db.keys.has(key)) return { error: { code: "23505" } };
              if (key) db.keys.add(key);
            }
            db.inserts.push(row);
            return { error: null };
          },
        };
      }
      if (table === "elite_players") return one({ data: { profile_id: "u1" }, error: null });
      if (table === "elite_profiles") {
        return one(db.has088 ? { data: { notify_off: db.off }, error: null } : { data: null, error: { code: "42703" } });
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

vi.mock("@/lib/elite/supabase/server", () => ({ createServiceClient: () => fakeClient() }));
vi.mock("@/lib/elite/push", () => ({
  sendPushToPlayer: async (to: string, payload: Record<string, unknown>) => (pushes.push({ to, kind: "player", payload }), { sent: 2 }),
  sendPushToProfile: async (to: string, payload: Record<string, unknown>) => (pushes.push({ to, kind: "profile", payload }), { sent: 1 }),
}));

import { notifyPlayer, notifyProfile } from "@/lib/elite/notify";
import {
  agoLabel,
  cleanNoticePath,
  cleanTopicsOff,
  coachMessageNotice,
  earnedNotice,
  friendPostNotice,
  newWeekNotice,
  reminderNotice,
  topicsFor,
} from "@/lib/elite/notices";
import { NATIVE_INBOX, inboxWebRow, nativeRouteFor } from "@/lib/elite/notice-routes";
import { buildNoticePrefs, withTopic } from "@/lib/elite/notice-prefs";
import { NUDGE_DAYS, NUDGE_LAST_DAY, onboardingNudgeDue } from "@/lib/elite/onboarding-nudge";

beforeEach(() => {
  db.has088 = true;
  db.failAll = false;
  db.off = [];
  db.keys = new Set();
  db.inserts = [];
  db.throws = false;
  pushes.length = 0;
});

const week8 = () => newWeekNotice({ first: "Sam", week: 8, focus: "First touch, both feet." });

describe("the one sender: a member", () => {
  it("writes the bell row with where it opens and its key, then sends the push", async () => {
    const res = await notifyPlayer("p1", week8());
    expect(res).toEqual({ bell: "written", pushed: 2, held: null });
    expect(db.inserts).toEqual([
      { player_id: "p1", kind: "new_week", title: "Week 8 is here, Sam", body: "First touch, both feet.", url: "/dashboard", dedupe_key: "new_week:8" },
    ]);
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({
      to: "p1",
      kind: "player",
      payload: { title: "Week 8 is here, Sam", body: "First touch, both feet.", url: "/dashboard", topic: "week", kind: "new_week", collapse: "new_week" },
    });
  });

  it("the same notice a second time is nothing at all: no row, no push", async () => {
    await notifyPlayer("p1", week8());
    for (let i = 0; i < 94; i++) {
      expect(await notifyPlayer("p1", week8())).toEqual({ bell: "already", pushed: 0, held: "already" });
    }
    expect(db.inserts).toHaveLength(1);
    expect(pushes).toHaveLength(1);
    // another player's week 8, and this player's week 9, are their own
    expect((await notifyPlayer("p2", week8())).bell).toBe("written");
    expect((await notifyPlayer("p1", newWeekNotice({ first: "Sam", week: 9 }))).bell).toBe("written");
  });

  it("a coach's message has no key: every one is its own note", async () => {
    const note = () => coachMessageNotice({ coach: "Coach Yinka", message: "Good work." });
    expect((await notifyPlayer("p1", note())).bell).toBe("written");
    expect((await notifyPlayer("p1", note())).bell).toBe("written");
    expect(db.inserts).toHaveLength(2);
    expect(db.inserts[0].dedupe_key).toBeNull();
    expect(pushes).toHaveLength(2);
  });

  it("a topic turned off stops the push; the bell row is still written", async () => {
    db.off = ["week"];
    expect(await notifyPlayer("p1", week8())).toEqual({ bell: "written", pushed: 0, held: "topic_off" });
    expect(db.inserts).toHaveLength(1);
    expect(pushes).toHaveLength(0);
    // the coach's topic is still on
    expect((await notifyPlayer("p1", coachMessageNotice({ coach: "Coach Gary", message: "Hi." }))).pushed).toBe(2);
  });

  it("a kind that is bell only never pushes; a reminder is push only and writes no row", async () => {
    expect(await notifyPlayer("p1", earnedNotice({ title: "10 Sessions", detail: "Ten full sessions in the bank" }))).toEqual({
      bell: "written",
      pushed: 0,
      held: "no_push",
    });
    expect(pushes).toHaveLength(0);
    const reminder = reminderNotice({ session: 2, drills: 4, drillsLeft: 4, minutes: 22, lastOpen: false, nyDate: "2026-11-24" });
    expect(await notifyPlayer("p1", reminder)).toEqual({ bell: "none", pushed: 2, held: null });
    expect(db.inserts).toHaveLength(1);
    // and it stays off with the week's switch
    db.off = ["week"];
    expect((await notifyPlayer("p1", reminder)).held).toBe("topic_off");
  });

  it("before migration 088: the row as it always was, nothing turned off, the push still goes", async () => {
    db.has088 = false;
    expect(await notifyPlayer("p1", week8())).toEqual({ bell: "legacy", pushed: 2, held: null });
    expect(db.inserts).toEqual([{ player_id: "p1", kind: "new_week", title: "Week 8 is here, Sam", body: "First touch, both feet." }]);
  });

  it("never throws, and a row that cannot be written does not stop the push", async () => {
    db.failAll = true;
    expect(await notifyPlayer("p1", week8())).toEqual({ bell: "failed", pushed: 2, held: null });
    db.throws = true;
    await expect(notifyPlayer("p1", week8())).resolves.toMatchObject({ pushed: expect.any(Number) });
    expect(await notifyPlayer("", week8())).toEqual({ bell: "none", pushed: 0, held: "no_push" });
  });
});

describe("the one sender: a free account", () => {
  it("has no bell: the notice is its push, under its own switch", async () => {
    const posted = friendPostNotice({ first: "Kai", nyDate: "2026-11-24" });
    expect(await notifyProfile("u9", posted)).toEqual({ bell: "none", pushed: 1, held: null });
    expect(db.inserts).toEqual([]);
    expect(pushes[0]).toMatchObject({ to: "u9", kind: "profile", payload: { url: "/log", topic: "friends", collapse: "friend_post" } });
    db.off = ["friends"];
    expect(await notifyProfile("u9", posted)).toEqual({ bell: "none", pushed: 0, held: "topic_off" });
    // a bell-only kind is nothing for a free account
    expect((await notifyProfile("u9", earnedNotice({ title: "x", detail: "y" }))).held).toBe("no_push");
  });
});

// ---- where a notice opens in the iPhone app --------------------------

describe("where a notice opens in the iPhone app: one map", () => {
  const CLUB = "33333333-3333-4333-8333-333333333333";

  it("a member: the screen the notice is about", () => {
    expect(nativeRouteFor("/dashboard", "member", "week")).toBe("/");
    expect(nativeRouteFor("/", "member", "week")).toBe("/");
    expect(nativeRouteFor("/homework", "member")).toBe("/week");
    expect(nativeRouteFor("/you", "member", "week")).toBe("/you");
    expect(nativeRouteFor("/progress", "member")).toBe("/you");
    expect(nativeRouteFor("/courses", "member")).toBe("/courses");
    expect(nativeRouteFor("/courses/keep-it-up", "member")).toBe("/course/keep-it-up");
  });

  it("anything from the coach opens the Inbox: the app has no Coach screens yet", () => {
    expect(nativeRouteFor("/messages", "member", "coach")).toBe(NATIVE_INBOX);
    expect(nativeRouteFor("/film", "member", "coach")).toBe(NATIVE_INBOX);
    expect(nativeRouteFor("/dashboard", "member", "coach")).toBe(NATIVE_INBOX);
    // by the page alone, when the topic did not come with it
    expect(nativeRouteFor("/messages", "member")).toBe(NATIVE_INBOX);
    expect(nativeRouteFor("/film/abc", "member", null)).toBe(NATIVE_INBOX);
  });

  it("a free account: Friends, Week, Clubs, or the club itself", () => {
    expect(nativeRouteFor("/log", "free", "friends")).toBe("/(free)/friends");
    expect(nativeRouteFor("/log/week", "free")).toBe("/(free)/my-week");
    expect(nativeRouteFor("/log/clubs", "free")).toBe("/(free)/clubs");
    expect(nativeRouteFor(`/log/club/${CLUB}`, "free", "clubs")).toBe(`/club/${CLUB}`);
    expect(nativeRouteFor("/courses/keep-it-up", "free")).toBe("/(free)/friends");
    // a member's page means nothing in the free app, and the other way round
    expect(nativeRouteFor("/dashboard", "free")).toBe("/(free)/friends");
    expect(nativeRouteFor(`/log/club/${CLUB}`, "member")).toBe("/");
  });

  it("anything that is not a page of ours opens where the person lives", () => {
    for (const bad of [undefined, null, 7, "", "https://example.com/x", "//example.com", "javascript:alert(1)", "/a\\b", "dashboard", `/log/club/not-an-id`]) {
      expect(nativeRouteFor(bad, "member"), String(bad)).toBe("/");
      expect(nativeRouteFor(bad, "free"), String(bad)).toBe("/(free)/friends");
    }
  });

  it("a note whose page is on the website gets one plain row that opens it in the sheet", () => {
    expect(inboxWebRow({ kind: "coach_message", path: "/messages" })).toEqual({ label: "Reply on thestriveapp.com", path: "/messages" });
    expect(inboxWebRow({ kind: "film_room", path: "/film" })).toEqual({ label: "Open on thestriveapp.com", path: "/film" });
    expect(inboxWebRow({ kind: "film_feedback", path: "/film" })?.path).toBe("/film");
    expect(inboxWebRow({ kind: "checkin_days", path: "/dashboard" })).toEqual({ label: "Open on thestriveapp.com", path: "/dashboard" });
    // read in the note itself, or the app has the screen
    expect(inboxWebRow({ kind: "checkin_feedback", path: "/dashboard" })).toBeNull();
    expect(inboxWebRow({ kind: "new_week", path: "/dashboard" })).toBeNull();
    expect(inboxWebRow({ kind: "earned", path: "/you" })).toBeNull();
    expect(inboxWebRow({ kind: "new_week", path: null })).toBeNull();
  });

  it("the tap on a notification and the tap on an Inbox row use the same map", () => {
    const nav = read("mobile/src/navigation.ts");
    expect(nav).toContain('import { nativeRouteFor } from "@shared/notice-routes";');
    expect(nav).toMatch(/return nativeRouteFor\(url, area === "app" \? "member" : train \? "social" : "free", t\);/);
    const inbox = read("mobile/app/inbox.tsx");
    expect(inbox).toContain('nativeRouteFor(note.path, "member", note.topic)');
    expect(inbox).toContain("inboxWebRow(note)");
    // the website page opens in the sheet over the app, never Safari
    expect(inbox).toContain("openSite(web.path)");
    expect(inbox).not.toMatch(/Linking\.openURL/);
  });

  it("a tapped notification is read from Apple's own payload, waits for the gate, and a cold start is not lost", () => {
    const layout = read("mobile/app/_layout.tsx");
    expect(read("mobile/src/navigation.ts")).toMatch(/trigger as \{ payload\?/);
    expect(layout).toContain("tappedNotice(res)");
    expect(layout).toContain("pushRoute(where.current, notice.url, notice.topic, withTrain.current)");
    // the notification that started the app
    expect(layout).toContain("Notifications.getLastNotificationResponse()");
    expect(layout).toContain("Notifications.clearLastNotificationResponse()");
    // never before the person is in the app or the free app
    expect(layout).toMatch(/const inside = \(area === "app" \|\| area === "free"\) && inArea\(area, segments, train\);/);
    expect(layout).toContain("else waiting.current = notice;");
    expect(layout).toMatch(/if \(!inside \|\| !waiting\.current\) return;/);
  });

  it("the Inbox is a screen of the member app, opened by a small bell with a quiet gold dot", () => {
    expect(read("mobile/src/navigation.ts")).toMatch(/APP_ROUTES = new Set\(\[[^\]]*"inbox"/);
    expect(read("mobile/app/_layout.tsx")).toContain('<Stack.Screen name="inbox" />');
    // Home is one screen, shown as the member app's Home tab and as the
    // Train tab Strive Pro adds to the free tabs (src/HomeScreen.tsx)
    expect(read("mobile/app/(tabs)/index.tsx")).toContain("<HomeScreen />");
    const home = read("mobile/src/HomeScreen.tsx");
    expect(home).toContain('router.push("/inbox")');
    expect(home).toContain("backgroundColor: color.gold");
    // never a number
    expect(home).not.toMatch(/\{me\.data\?\.unread\}|\{unread\}/);
    const inbox = read("mobile/app/inbox.tsx");
    expect(inbox).toContain("markInboxRead()");
    // its dot is gold, and nothing on it is a red count
    expect(inbox).toContain("backgroundColor: color.gold");
    expect(inbox).not.toMatch(/color\.danger|#ff[0-9a-f]{4}\b|unread/i);
    // in the example-data build, the simulator's pictures and a tapped flow
    expect(read("mobile/src/api/fixtures.ts")).toContain('path.startsWith("/api/app/notices")');
    expect(read("mobile/sim/shots.sh")).toContain("18b-inbox|ok|inbox|11");
    expect(read("mobile/sim/flows/11-inbox.yaml")).toContain('tapOn: "Inbox, something new"');
  });
});

// ---- the website's bell ----------------------------------------------

describe("the website's bell", () => {
  it("a note that says where it goes is a link to that page, in the same window", () => {
    const bell = read("components/elite/NotificationBell.tsx");
    expect(bell).toContain("const path = cleanNoticePath(n.url);");
    expect(bell).toMatch(/<Link key=\{n\.id\} href=\{path\} onClick=\{close\}/);
    // nothing opens a new window (which would leave the app for Safari)
    expect(bell).not.toMatch(/target=|window\.open/);
  });

  it("only a path on our own site can ever be a link", () => {
    expect(cleanNoticePath("/dashboard")).toBe("/dashboard");
    expect(cleanNoticePath("/log/club/33333333-3333-4333-8333-333333333333")).toBe("/log/club/33333333-3333-4333-8333-333333333333");
    for (const bad of ["https://example.com", "//example.com", "javascript:alert(1)", "/a//b", "/a\\b", "dashboard", "", " ", null, undefined, 5, "/" + "a".repeat(300)]) {
      expect(cleanNoticePath(bad), String(bad)).toBeNull();
    }
  });

  it("says how long ago, shortly", () => {
    const now = Date.parse("2026-11-24T20:00:00Z");
    expect(agoLabel("2026-11-24T19:59:40Z", now)).toBe("Just now");
    expect(agoLabel("2026-11-24T19:15:00Z", now)).toBe("45m ago");
    expect(agoLabel("2026-11-24T17:00:00Z", now)).toBe("3h ago");
    expect(agoLabel("2026-11-21T20:00:00Z", now)).toBe("3d ago");
    expect(agoLabel("2026-11-02T20:00:00Z", now)).toBe("Nov 2");
    expect(agoLabel("not a date", now)).toBe("");
  });
});

// ---- the choices -------------------------------------------------------

describe("the choices: what a person may be told about", () => {
  it("a member gets Your week, and Your coach when the membership has the coach's time", () => {
    expect(topicsFor({ member: true, free: false, coachTime: false })).toEqual(["week"]);
    expect(topicsFor({ member: true, free: false, coachTime: true })).toEqual(["week", "coach"]);
    expect(topicsFor({ member: false, free: true, coachTime: false })).toEqual(["friends", "clubs"]);
    expect(topicsFor({ member: false, free: false, coachTime: false })).toEqual([]);
  });

  it("the switches and the reminder time, as both screens draw them", () => {
    const pro = buildNoticePrefs({ member: true, free: false, coachTime: false, off: [], reminderHour: null });
    expect(pro.topics).toEqual([{ key: "week", label: "Your week", detail: "A new week, and one reminder at your usual time.", on: true }]);
    expect(pro.reminder).toEqual({
      question: "When do you usually train?",
      choices: [
        { key: "before_school", label: "Before school" },
        { key: "after_school", label: "After school" },
        { key: "evening", label: "Evening" },
        { key: "changes", label: "It changes" },
      ],
      chosen: "changes",
    });
    const elite = buildNoticePrefs({ member: true, free: false, coachTime: true, off: ["coach"], reminderHour: 16 });
    expect(elite.topics.map((t) => [t.label, t.on])).toEqual([
      ["Your week", true],
      ["Your coach", false],
    ]);
    expect(elite.reminder?.chosen).toBe("after_school");
    const free = buildNoticePrefs({ member: false, free: true, coachTime: false, off: ["clubs"], reminderHour: undefined });
    expect(free.topics.map((t) => [t.label, t.on])).toEqual([
      ["Friends", true],
      ["Clubs", false],
    ]);
    // a free account has no session reminder
    expect(free.reminder).toBeNull();
  });

  it("before migration 088 there is nothing to show, so nothing is offered", () => {
    expect(buildNoticePrefs({ member: true, free: false, coachTime: true, off: null, reminderHour: undefined })).toEqual({ topics: [], reminder: null });
  });

  it("what is stored is only topics we know, once each, in one order", () => {
    expect(withTopic([], "week", false)).toEqual(["week"]);
    expect(withTopic(["week"], "week", true)).toEqual([]);
    expect(withTopic(["clubs", "week"], "coach", false)).toEqual(["week", "coach", "clubs"]);
    expect(withTopic(["week", "week", "sales"], "friends", false)).toEqual(["week", "friends"]);
    expect(cleanTopicsOff(["coach", "sales", "week", "coach"])).toEqual(["week", "coach"]);
    expect(cleanTopicsOff("week")).toEqual([]);
  });

  it("a person only ever changes their own row, and only a topic they are offered", () => {
    const server = code("lib/elite/notice-prefs-server.ts");
    expect(server).toContain('.eq("id", viewer.profile.id)');
    expect(server).toContain('.eq("id", viewer.playerId)');
    expect(server).toContain("!offered.includes(topic as NoticeTopic)");
    expect(server).toContain('typeof on !== "boolean"');
    // the website's actions and the phone's route are the same two savers
    const actions = read("lib/elite/notice-actions.ts");
    expect(actions).toContain("if (!viewer || viewer.demo) return { ok: false, error: PREFS_NOT_SAVED };");
    const route = read("app/api/app/notices/prefs/route.ts");
    expect(route).toContain("saveNoticeTopic(viewer, body.topic, body.on)");
    expect(route).toContain("saveReminderChoice(viewer, body.reminder)");
  });

  it("they sit under the on/off for the phone: Account on the website, Settings in the app and the free app", () => {
    expect(read("app/account/page.tsx")).toContain("<NoticeChoices prefs={notices} />");
    expect(read("components/elite/FreeSettings.tsx")).toContain("<NoticeChoices prefs={notices} />");
    expect(read("mobile/app/settings.tsx")).toContain('<Section title="Notifications">{rows}</Section>');
    const phone = read("mobile/src/NoticeChoices.tsx");
    expect(phone).toContain("save.mutate({ topic: t.key, on })");
    expect(phone).toContain("save.mutate({ reminder: key })");
  });
});

// ---- the onboarding text ----------------------------------------------

describe("the text to a family that has not finished the profile", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const joined = "2026-11-01T15:00:00.000Z";
  const at = (days: number, hours = 1) => Date.parse(joined) + days * DAY + hours * 60 * 60 * 1000;
  const iso = (days: number) => new Date(at(days)).toISOString();

  it("goes on days 1, 4 and 7, and never after day 8", () => {
    expect(NUDGE_DAYS).toEqual([1, 4, 7]);
    expect(NUDGE_LAST_DAY).toBe(8);
    // nothing sent yet
    expect(onboardingNudgeDue({ joinedAt: joined, lastSentAt: null, now: at(0) })).toBe(false);
    expect(onboardingNudgeDue({ joinedAt: joined, lastSentAt: null, now: at(1) })).toBe(true);
    // the first went on day 1
    for (const d of [1, 2, 3]) expect(onboardingNudgeDue({ joinedAt: joined, lastSentAt: iso(1), now: at(d, 2) }), `day ${d}`).toBe(false);
    expect(onboardingNudgeDue({ joinedAt: joined, lastSentAt: iso(1), now: at(4) })).toBe(true);
    // the second went on day 4
    for (const d of [4, 5, 6]) expect(onboardingNudgeDue({ joinedAt: joined, lastSentAt: iso(4), now: at(d, 2) }), `day ${d}`).toBe(false);
    expect(onboardingNudgeDue({ joinedAt: joined, lastSentAt: iso(4), now: at(7) })).toBe(true);
    // the third went on day 7: that is all, for good
    for (const d of [7, 8, 9, 10, 30, 365]) expect(onboardingNudgeDue({ joinedAt: joined, lastSentAt: iso(7), now: at(d, 2) }), `day ${d}`).toBe(false);
  });

  it("at most three, whatever days the cron ran on", () => {
    let last: string | null = null;
    let sent = 0;
    for (let d = 0; d <= 400; d++) {
      if (onboardingNudgeDue({ joinedAt: joined, lastSentAt: last, now: at(d) })) {
        sent++;
        last = iso(d);
      }
    }
    expect(sent).toBe(3);
    // a cron that missed days does not make up for them twice
    last = null;
    sent = 0;
    for (const d of [5, 6, 7, 8, 9, 12]) {
      if (onboardingNudgeDue({ joinedAt: joined, lastSentAt: last, now: at(d) })) {
        sent++;
        last = iso(d);
      }
    }
    expect(sent).toBe(2);
  });

  it("a family that joined long ago and never finished is not texted again", () => {
    expect(onboardingNudgeDue({ joinedAt: "2026-09-01T00:00:00Z", lastSentAt: null, now: Date.parse("2026-11-24T00:00:00Z") })).toBe(false);
    expect(onboardingNudgeDue({ joinedAt: null, lastSentAt: null, now: at(1) })).toBe(false);
    expect(onboardingNudgeDue({ joinedAt: "nonsense", lastSentAt: null, now: at(1) })).toBe(false);
  });

  it("the cron uses the rule, with no new column, and its words are unchanged", () => {
    const route = read("app/api/elite/cron/onboarding-reminders/route.ts");
    expect(route).toContain("onboardingNudgeDue({");
    expect(route).toContain('.select("id, full_name, joined_at, onboarding_reminder_sent_at")');
    expect(route).not.toContain("threeDaysAgo");
    expect(route).toContain(
      "message: `Still need ${first || \"your player\"}'s Strive Elite profile finished so I can build their first training week. Takes two minutes: ${appUrl}/onboarding. Let's get ${first || \"them\"} started.`"
    );
  });
});

// ---- migration 088 ----------------------------------------------------

describe("migration 088", () => {
  const sql = read("supabase/migrations/088_notices.sql");
  const statements = sql.replace(/^\s*--.*$/gm, "");

  it("adds five columns and nothing else, each only if it is not there", () => {
    const added = [...statements.matchAll(/alter table public\.(\w+)\s+add column if not exists (\w+) ([\w\[\]]+)/g)].map((m) => `${m[1]}.${m[2]} ${m[3]}`);
    expect(added).toEqual([
      "elite_notifications.url text",
      "elite_notifications.dedupe_key text",
      "elite_profiles.notify_off text[]",
      "elite_players.reminder_hour smallint",
      "elite_players.reminders_paused_at timestamptz",
    ]);
    expect(statements).not.toMatch(/create table/i);
  });

  it("one bell row per player per key, old rows left as they are", () => {
    expect(statements).toMatch(
      /create unique index if not exists elite_notifications_player_key\s+on public\.elite_notifications \(player_id, dedupe_key\)\s+where dedupe_key is not null;/
    );
    // nothing is deleted or rewritten
    expect(statements).not.toMatch(/\bdelete\b|\bupdate\b|\btruncate\b/i);
  });

  it("an address is a path on our own site, by the same shape the code allows", () => {
    expect(statements).toContain("url ~ '^/[A-Za-z0-9._~/?#=&%+@-]*$'");
    expect(statements).toContain("position('//' in url) = 0");
  });

  it("the topics and the hour are checked by the database too", () => {
    expect(statements).toContain("check (notify_off <@ array['week', 'coach', 'friends', 'clubs']::text[])");
    expect(statements).toContain("check (reminder_hour is null or reminder_hour between 5 and 21)");
    expect(statements).toContain("notify_off text[] not null default '{}'");
  });

  it("can be run statement by statement, twice, and drops nothing", () => {
    expect(statements).toContain("set lock_timeout = '8s';");
    expect(statements).not.toMatch(/\bdrop\b/i);
    expect(statements).not.toMatch(/create policy|alter policy/i);
    // every constraint is added only when it is not there
    expect((statements.match(/add constraint/g) ?? []).length).toBe((statements.match(/if not exists \(\s*select 1 from pg_constraint/g) ?? []).length);
  });

  it("the code works before it is applied", () => {
    // the bell row falls back to its old shape, the roster to its old columns
    expect(read("lib/elite/notify.ts")).toContain('const legacy = await db.from("elite_notifications").insert(row);');
    const reminders = read("lib/elite/reminders-server.ts");
    expect(reminders).toContain("reminder_hour, reminders_paused_at");
    expect(reminders).toMatch(/id, profile_id, week1_monday, current_week"/);
  });
});

// Nov 24 2026, the copy pass: a line that promises something this player
// never gets is not copy, it is a mistake. Strive Pro has no coach chat and
// no Film Room; nobody is texted about a new week any more.
describe("the words around notifications only promise what arrives", () => {
  it("a Strive Pro player is never told about a coach or a Film Room", async () => {
    const { whyNotifications, whatNotifications } = await import("@/lib/elite/notices");
    for (const say of [whyNotifications, whatNotifications]) {
      const pro = say({ coachTime: false, friends: false });
      const proWithFriends = say({ coachTime: false, friends: true });
      for (const line of [pro, proWithFriends]) expect(line).not.toMatch(/coach|Film Room/i);
      expect(pro).toMatch(/new week/);
      expect(proWithFriends).toMatch(/friend/);
      expect(say({ coachTime: true, friends: false })).toMatch(/coach/);
      for (const line of [pro, proWithFriends, say({ coachTime: true, friends: false })]) expect(line).toMatch(/Nothing else\.$/);
    }
  });

  it("the phone and the website both say it from that one place", () => {
    expect(read("mobile/app/session/[n].tsx")).toContain("{whyNotifications(who)}");
    expect(read("mobile/app/settings.tsx")).toContain("whatNotifications({");
    expect(read("components/elite/PushOptIn.tsx")).toContain("whyNotifications({ coachTime, friends: false })");
    for (const f of ["mobile/app/session/[n].tsx", "mobile/app/settings.tsx", "components/elite/PushOptIn.tsx"]) {
      expect(read(f), f).not.toContain("a Film Room is announced");
    }
  });

  it("nobody is promised a text about a new week", () => {
    for (const f of ["lib/elite/experience.ts", "lib/elite/quiz.ts", "mobile/src/HomeScreen.tsx", "app/(player)/dashboard/page.tsx"]) {
      expect(read(f), f).not.toMatch(/we(?:'| wi)ll text you|We text them when your new week|you get a notification when it does/i);
    }
  });
});
