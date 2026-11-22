import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  COACH_MESSAGE_PREVIEW,
  coachMessagePush,
  newWeekPush,
  pushTextProblems,
  trainingReminderPush,
  weekUnlockedPush,
} from "../lib/elite/push-texts";
import { checkinAnnouncement, filmRoomAnnouncement } from "../lib/elite/film-room";
import { apnsBody } from "../lib/elite/apns";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// Every push the app sends, read against Apple's notification guidance
// and the house voice (App Store punch list A29): it informs, it never
// orders, it never sells, one per event. This file IS the list: a new
// push has to be added here, and a push written anywhere else fails the
// source check at the bottom.

const FOCUS = "First touch under pressure, both feet, every session.";

const film = filmRoomAnnouncement({
  parentName: "Jordan Lee",
  playerName: "Sam Lee",
  scheduledAt: "2026-11-22T00:00:00.000Z", // Sat Nov 21, 7:00 PM ET
  clipsDueAt: "2026-11-21T02:00:00.000Z", // Fri Nov 20, 9:00 PM ET
  appUrl: "https://thestriveapp.com",
});
const checkin = checkinAnnouncement({
  parentName: "Jordan Lee",
  playerName: "Sam Lee",
  startsAt: "2026-12-15T14:00:00.000Z",
  endsAt: "2026-12-15T17:00:00.000Z",
  minutes: 30,
  appUrl: "https://thestriveapp.com",
});

// name -> the notification as a member's phone shows it
const EVERY_PUSH: Record<string, { title: string; body: string; url?: string }> = {
  "coach message": coachMessagePush("Good work this week. Keep the weak foot going."),
  "first week live, with a name": newWeekPush({ first: "Sam", week: 1, firstWeek: true, focus: FOCUS }),
  "first week live, no name": newWeekPush({ first: "", week: 1, firstWeek: true, focus: "" }),
  "week live at once, with a name": newWeekPush({ first: "Sam", week: 8, firstWeek: false, focus: FOCUS }),
  "week live at once, no name, no focus": newWeekPush({ first: "", week: 8, firstWeek: false, focus: null }),
  "week unlocked Monday, with a name": weekUnlockedPush({ first: "Sam", week: 8, focus: FOCUS }),
  "week unlocked Monday, no name, no focus": weekUnlockedPush({ first: "", week: 8, focus: null }),
  "Film Room announced": { title: film.pushTitle, body: film.pushBody, url: "/film" },
  "check-in days announced": { title: checkin.pushTitle, body: checkin.pushBody, url: "/dashboard" },
  "reminder at the usual time": trainingReminderPush({ sessionsLeft: 3 }),
  "reminder at the usual time, one session left": trainingReminderPush({ sessionsLeft: 1 }),
};

describe("the list: every push, word for word", () => {
  it("a message from the coach carries the coach's own words, cut to a preview", () => {
    expect(EVERY_PUSH["coach message"]).toEqual({
      title: "Message from your coach",
      body: "Good work this week. Keep the weak foot going.",
      url: "/messages",
    });
    expect(coachMessagePush("x".repeat(500)).body).toHaveLength(COACH_MESSAGE_PREVIEW);
  });

  it("a new week that is live at once", () => {
    expect(EVERY_PUSH["first week live, with a name"]).toEqual({
      title: "Sam, your first week is live",
      body: FOCUS,
      url: "/dashboard",
    });
    expect(EVERY_PUSH["first week live, no name"]).toEqual({
      title: "Your first week is live",
      body: "Your new training week is live.",
      url: "/dashboard",
    });
    expect(EVERY_PUSH["week live at once, with a name"].title).toBe("Sam, week 8 just dropped");
    expect(EVERY_PUSH["week live at once, no name, no focus"]).toEqual({
      title: "Week 8 just dropped",
      body: "Your new training week is live.",
      url: "/dashboard",
    });
  });

  it("a held week unlocking on Monday morning", () => {
    expect(EVERY_PUSH["week unlocked Monday, with a name"]).toEqual({
      title: "Week 8 is live, Sam",
      body: FOCUS,
      url: "/dashboard",
    });
    expect(EVERY_PUSH["week unlocked Monday, no name, no focus"]).toEqual({
      title: "Week 8 is live",
      body: "Your new training week just unlocked.",
      url: "/dashboard",
    });
  });

  it("the Film Room and the monthly check-in days", () => {
    expect(film.pushTitle).toBe("This week's Film Room");
    expect(film.pushBody).toMatch(/^\w+day, \w+ \d+ at \d+:\d\d [AP]M ET\. Upload 3 to 5 clips by .+ in the Film tab\.$/);
    expect(checkin.pushTitle).toBe("Monthly check-in calls are open");
    expect(checkin.pushBody).toMatch(/\. Pick your 30-minute time on your dashboard\.$/);
  });
});

describe("the reminder at the usual time", () => {
  it("says what is waiting, word for word", () => {
    expect(EVERY_PUSH["reminder at the usual time"]).toEqual({
      title: "Today's session is ready",
      body: "One tap and you're training.",
      url: "/dashboard",
    });
    expect(EVERY_PUSH["reminder at the usual time, one session left"]).toEqual({
      title: "One more session completes your week",
      body: "Today's is ready.",
      url: "/dashboard",
    });
  });

  it("is claimed for the day before it is sent", () => {
    const src = read("lib/elite/reminders-server.ts");
    const claim = src.indexOf("claimReminder(admin, p.id, today)");
    expect(claim).toBeGreaterThan(-1);
    expect(src.indexOf("sendPushToPlayer(p.id")).toBeGreaterThan(claim);
    expect(src).toContain("maySend(await claimReminder(");
  });
});

describe("the rule: inform, never order, never sell, never shout", () => {
  it("every push the app sends passes", () => {
    for (const [name, text] of Object.entries(EVERY_PUSH)) {
      expect(pushTextProblems(text), name).toEqual([]);
    }
  });

  it("a tap on any of them opens a screen of our own", () => {
    for (const [name, text] of Object.entries(EVERY_PUSH)) {
      expect(text.url, name).toMatch(/^\/(messages|dashboard|film)$/);
    }
  });

  it("the phone's own fallback words pass too", () => {
    const sw = read("public/sw.js");
    const m = sw.match(/let data = \{ title: "([^"]+)", body: "([^"]+)"/);
    expect(m).not.toBeNull();
    expect(pushTextProblems({ title: m![1], body: m![2] })).toEqual([]);
  });

  it("the iPhone app gets the same words as the browser, unchanged", () => {
    const text = EVERY_PUSH["week unlocked Monday, with a name"];
    const sent = JSON.parse(apnsBody(text)) as { aps: { alert: { title: string; body: string } }; url: string };
    expect(sent.aps.alert).toEqual({ title: text.title, body: text.body });
    expect(sent.url).toBe("/dashboard");
  });

  it("the rule catches an order, a sale, guilt and shouting", () => {
    const wrong: [string, { title: string; body: string }][] = [
      ["order", { title: "Don't forget your session", body: "It is waiting." }],
      ["order", { title: "Week 8 is live", body: "Go train now." }],
      ["order", { title: "Open the app", body: "Your week is live." }],
      ["sells", { title: "Strive Elite", body: "Upgrade for $29 a month." }],
      ["sells", { title: "A new course is here", body: "Limited time offer for members." }],
      ["missed", { title: "You are falling behind", body: "Two sessions left this week." }],
      ["missed", { title: "Your streak is at risk", body: "One session today keeps it." }],
      ["shouts", { title: "Week 8 is live!", body: "Your new training week is live." }],
      ["capitals", { title: "WEEK EIGHT IS LIVE", body: "Your new training week is live." }],
      ["emoji", { title: "Week 8 is live \u{1F525}", body: "Your new training week is live." }],
      ["long dash", { title: "Week 8 is live", body: "First touch — both feet." }],
      ["machinery", { title: "Week 8 is live", body: "Your automated plan is ready." }],
      ["no body", { title: "Week 8 is live", body: "  " }],
    ];
    for (const [why, text] of wrong) {
      expect(pushTextProblems(text).length, `${why}: ${text.title} / ${text.body}`).toBeGreaterThan(0);
    }
  });
});

// The source check: the words of a push live in push-texts.ts (or, for
// the two announcements, in film-room.ts beside their texts). A push
// written inline in a sender would never be read by the tests above.
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("no push is written anywhere else", () => {
  const files = ["app", "components", "lib"].flatMap((d) => walk(join(root, d)));
  const senders = files
    .filter((f) => !f.endsWith("lib/elite/push.ts"))
    .filter((f) => /sendPushToPlayer\(/.test(readFileSync(f, "utf8")))
    .map((f) => f.replace(root + "/", ""))
    .sort();

  it("the senders are the three files this list knows", () => {
    expect(senders).toEqual([
      "lib/elite/coach-actions.ts",
      "lib/elite/film-room-actions.ts",
      "lib/elite/reminders-server.ts",
      "lib/elite/unlock.ts",
    ]);
  });

  it("every send takes its words from the list", () => {
    const approved = [
      /sendPushToPlayer\(playerId, coachMessagePush\(body\)\)/,
      /sendPushToPlayer\(\s*playerId,\s*newWeekPush\(\{ first, week, firstWeek, focus: plan\.weekly_focus \}\)\s*\)/,
      /sendPushToPlayer\(\s*plan\.player_id,\s*weekUnlockedPush\(\{ first, week: plan\.week, focus: plan\.focus \}\)\s*\)/,
      /sendPushToPlayer\(p\.id, \{ title: m\.pushTitle, body: m\.pushBody, url \}\)/,
      /sendPushToPlayer\(p\.id, trainingReminderPush\(\{ sessionsLeft: left \}\)\)/,
    ];
    let calls = 0;
    let matched = 0;
    for (const file of senders) {
      const src = read(file);
      calls += (src.match(/sendPushToPlayer\(/g) ?? []).length;
      for (const pattern of approved) if (pattern.test(src)) matched++;
    }
    expect(calls).toBe(approved.length);
    expect(matched).toBe(approved.length);
  });

  it("a new week is announced once, whichever of its two senders gets there first", () => {
    // one push per event: both new-week senders sit behind the same
    // database claim (announce.ts), which only one caller can win
    for (const file of ["lib/elite/coach-actions.ts", "lib/elite/unlock.ts"]) {
      const src = read(file);
      const claim = src.indexOf("claimWeekAnnouncement(");
      const push = src.search(/(newWeekPush|weekUnlockedPush)\(\{/);
      expect(claim, file).toBeGreaterThan(-1);
      expect(push, file).toBeGreaterThan(claim);
    }
  });
});
