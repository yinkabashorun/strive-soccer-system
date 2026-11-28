import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  KIND_TOPIC,
  NOTICE_KINDS,
  NOTICE_PREVIEW,
  TOPIC_CHOICE,
  checkinFeedbackNotice,
  clubPlanNotice,
  clubChampsNotice,
  CAPITALS_ALLOWED,
  coachAttendingNotice,
  coachMessageNotice,
  coachNameFor,
  earnedNotice,
  filmFeedbackNotice,
  friendPassedNotice,
  friendPostNotice,
  interruptionFor,
  newWeekNotice,
  noticeProblems,
  propsNotice,
  pushTextProblems,
  reminderNotice,
  remindersPausedNotice,
  squadPassNotice,
  welcomeNotice,
  type Notice,
} from "../lib/elite/notices";
import { checkinAnnouncement, filmRoomAnnouncement } from "../lib/elite/film-room";
import { seedHash } from "../lib/elite/voice";
import { apnsBody, apnsCollapseId, apnsHeaders } from "../lib/elite/apns";
import { webPushBody } from "../lib/elite/push";
import { pushOf } from "../lib/elite/notify";
import { ACHIEVEMENT_RULES } from "../lib/elite/achievement-rules";
import { CLOCK_NUDGE, CLOCK_NUDGE_MINUTES } from "../lib/elite/training-clock";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// EVERY NOTICE THE APP SENDS, word for word: the bell row, the push, and
// the subject of the email that goes with it are the same words, built by
// one function in lib/elite/notices.ts and sent through one sender,
// lib/elite/notify.ts. Read against Apple's notification guidance and the
// house voice (App Store punch list A29): it informs, it never orders, it
// never sells, one per event.
//
// This file IS the list. A new notice has to be added here, and a push or
// a bell row written anywhere but the one sender fails the source check at
// the bottom.

const FOCUS = "First touch under pressure, both feet, every session.";
const ROOM = "11111111-1111-4111-8111-111111111111";
const DAY = "22222222-2222-4222-8222-222222222222";
const CLUB = "33333333-3333-4333-8333-333333333333";
const PLAN = "44444444-4444-4444-8444-444444444444";
const POST = "55555555-5555-4555-8555-555555555555";

const film = filmRoomAnnouncement({
  roomId: ROOM,
  parentName: "Jordan Lee",
  playerName: "Sam Lee",
  scheduledAt: "2026-11-22T00:00:00.000Z", // Sat Nov 21, 7:00 PM ET
  clipsDueAt: "2026-11-21T02:00:00.000Z", // Fri Nov 20, 9:00 PM ET
  appUrl: "https://thestriveapp.com",
});
const checkin = checkinAnnouncement({
  dayId: DAY,
  parentName: "Jordan Lee",
  playerName: "Sam Lee",
  startsAt: "2026-12-15T14:00:00.000Z",
  endsAt: "2026-12-15T17:00:00.000Z",
  minutes: 30,
  appUrl: "https://thestriveapp.com",
});

const facts = { session: 2, drills: 4, drillsLeft: 4, minutes: 22, lastOpen: false, nyDate: "2026-11-24" };

// A line that rotates (lib/elite/voice.ts) is pinned here line by line: the
// receiver whose seed picks the i-th of n lines on that day.
function toPicking(seedOf: (to: string) => string, n: number, i: number): string {
  for (let k = 0; k < 10_000; k++) if (seedHash(seedOf(`p${k}`)) % n === i) return `p${k}`;
  throw new Error("no seed");
}
const reminderTo = (n: number, i: number) => toPicking((to) => `reminder:${to}:2026-11-24`, n, i);
const postTo = (n: number, i: number) => toPicking((to) => `friend_post:${to}:2026-11-24`, n, i);
const passedTo = (i: number) => toPicking((to) => `friend_passed:${to}:2026-11-24`, 3, i);

// name -> the notice
const EVERY_NOTICE: Record<string, Notice> = {
  "new week, with a name": newWeekNotice({ first: "Sam", week: 8, firstWeek: false, focus: FOCUS }),
  "new week, no name, no focus": newWeekNotice({ first: "", week: 8, firstWeek: false, focus: null }),
  "first week, with a name": newWeekNotice({ first: "Sam", week: 1, firstWeek: true, focus: FOCUS }),
  "first week, no name": newWeekNotice({ first: null, week: 1, firstWeek: true, focus: "" }),
  "coach message": coachMessageNotice({ coach: "Coach Yinka", message: "Good work this week. Keep the weak foot going." }),
  "coach message, no name on file": coachMessageNotice({ coach: "", message: "Good work this week." }),
  "check-in reply": checkinFeedbackNotice({ coach: "Coach Gary", feedback: "Your first touch is quicker. Keep it there." }),
  "film breakdown": filmFeedbackNotice({ filmId: ROOM, summary: "Two clips on scanning before the ball arrives." }),
  "Film Room announced": film.notice,
  "check-in days announced": checkin.notice,
  "coach attending, with a date": coachAttendingNotice({ gameId: DAY, gameDate: "Sat, Nov 28" }),
  "coach attending, no date": coachAttendingNotice({ gameId: DAY, gameDate: null }),
  earned: earnedNotice({ title: "10 Sessions", detail: "Ten full sessions in the bank" }),
  welcome: welcomeNotice(),
  "reminder, session ready": reminderNotice({ ...facts, area: "Weak foot", to: reminderTo(3, 0) }),
  "reminder, session ready, the minutes": reminderNotice({ ...facts, area: "Weak foot", to: reminderTo(3, 1) }),
  "reminder, session ready, the weakest area": reminderNotice({ ...facts, area: "Weak foot", to: reminderTo(3, 2) }),
  "reminder, session ready, 1v1 as the area": reminderNotice({ ...facts, area: "Dribbling and 1v1", to: reminderTo(3, 2) }),
  "reminder, session started": reminderNotice({ ...facts, drillsLeft: 2 }),
  "reminder, one drill to go": reminderNotice({ ...facts, drillsLeft: 1 }),
  "reminder, last session of the week": reminderNotice({ ...facts, session: 4, lastOpen: true }),
  "reminders paused": remindersPausedNotice({ nyDate: "2026-11-24" }),
  "friend posted": friendPostNotice({ first: "Kai", nyDate: "2026-11-24", kind: "training", minutes: 75, mine: 20, to: postTo(3, 0) }),
  "friend posted, on the come up": friendPostNotice({ first: "Kai", nyDate: "2026-11-24", kind: "training", minutes: 75, mine: 20, to: postTo(3, 1) }),
  "friend posted, outworking you": friendPostNotice({ first: "Kai", nyDate: "2026-11-24", kind: "training", minutes: 75, mine: 20, to: postTo(3, 2) }),
  "friend posted, gym": friendPostNotice({ first: "Kai", nyDate: "2026-11-24", kind: "gym", minutes: 45, to: postTo(1, 0) }),
  "friend posted, no length read": friendPostNotice({ first: "Kai", nyDate: "2026-11-24", kind: "training", minutes: 0, to: postTo(1, 0) }),
  "friend passed you": friendPassedNotice({ first: "Kai", minutes: 45, nyDate: "2026-11-24", to: passedTo(0) }),
  "friend passed you, letting it stand": friendPassedNotice({ first: "Kai", minutes: 45, nyDate: "2026-11-24", to: passedTo(1) }),
  "friend passed you, put in": friendPassedNotice({ first: "Kai", minutes: 45, nyDate: "2026-11-24", to: passedTo(2) }),
  "friend passed you, a long one": friendPassedNotice({ first: "Kai", minutes: 90, nyDate: "2026-11-24", to: passedTo(0) }),
  props: propsNotice({ first: "Kai", postId: POST }),
  "squad pass earned": squadPassNotice({ number: 1 }),
  "club session planned": clubPlanNotice({ planId: PLAN, club: "Sunday Pickup", clubId: CLUB, what: "Club training", when: "Thu, Nov 26 at 6:00 PM" }),
  "club game on": clubPlanNotice({ planId: PLAN, club: "Sunday Pickup", clubId: CLUB, what: "Game against Renegados FC", when: "Sat, Nov 28 at 10:00 AM" }),
  "champs of the week": clubChampsNotice({ club: "Renegados FC", clubId: CLUB, other: "Sunday Pickup", gap: 12, weekMonday: "2026-11-23" }),
  "champs of the week, a long club name": clubChampsNotice({ club: "Gainesville High School Varsity Boys Soccer", clubId: CLUB, other: "Sunday Pickup", gap: 1, weekMonday: "2026-11-23" }),
};

const words = (n: Notice) => ({ title: n.title, body: n.body, path: n.path, key: n.key });

describe("the list: every notice, word for word", () => {
  it("a new week: the same words whether it goes live at once or unlocks on Monday", () => {
    expect(words(EVERY_NOTICE["new week, with a name"])).toEqual({
      title: "Week 8 is here, Sam",
      body: FOCUS,
      path: "/dashboard",
      key: "new_week:8",
    });
    expect(words(EVERY_NOTICE["new week, no name, no focus"])).toEqual({
      title: "Week 8 is here",
      body: "Your new training week is ready.",
      path: "/dashboard",
      key: "new_week:8",
    });
    expect(words(EVERY_NOTICE["first week, with a name"])).toEqual({
      title: "Your first week is here, Sam",
      body: FOCUS,
      path: "/dashboard",
      key: "new_week:1",
    });
    expect(EVERY_NOTICE["first week, no name"].title).toBe("Your first week is here");
    // first name only, whatever is on file
    expect(newWeekNotice({ first: "Sam Lee", week: 8 }).title).toBe("Week 8 is here, Sam");
  });

  it("a message from the coach: the coach's name, then the coach's own words, cut to a preview", () => {
    expect(words(EVERY_NOTICE["coach message"])).toEqual({
      title: "Coach Yinka",
      body: "Good work this week. Keep the weak foot going.",
      path: "/messages",
      key: null,
    });
    expect(EVERY_NOTICE["coach message, no name on file"].title).toBe("Your coach");
    expect(coachMessageNotice({ coach: "Coach Yinka", message: "x".repeat(500) }).body).toHaveLength(NOTICE_PREVIEW);
    expect(NOTICE_PREVIEW).toBe(140);
    expect(coachNameFor("  Coach   Gary  ")).toBe("Coach Gary");
    expect(coachNameFor(null)).toBe("Your coach");
  });

  it("the coach's reply to a check-in, and a film breakdown", () => {
    expect(words(EVERY_NOTICE["check-in reply"])).toEqual({
      title: "Coach Gary replied to your check-in",
      body: "Your first touch is quicker. Keep it there.",
      path: "/dashboard",
      key: null,
    });
    expect(words(EVERY_NOTICE["film breakdown"])).toEqual({
      title: "Your film breakdown is in",
      body: "Two clips on scanning before the ball arrives.",
      path: "/film",
      key: `film_feedback:${ROOM}`,
    });
  });

  it("the Film Room and the monthly check-in days", () => {
    expect(words(film.notice)).toEqual({
      title: "Film Room is Saturday, Nov 21 at 7:00 PM ET",
      body: "Clips are open until Friday, Nov 20 at 9:00 PM ET.",
      path: "/film",
      key: `film_room:${ROOM}`,
    });
    expect(checkin.notice.title).toBe("Check-in calls are open");
    expect(checkin.notice.body).toMatch(/^Tuesday, Dec 15, .+ ET\. Times are on your Home screen\.$/);
    expect(checkin.notice.path).toBe("/dashboard");
    expect(checkin.notice.key).toBe(`checkin_days:${DAY}`);
  });

  it("the texts that go with them are Coach Yinka's own words, unchanged", () => {
    expect(film.sms).toBe(
      "Hey Jordan, this week's Film Room is Saturday, Nov 21 at 7:00 PM ET on Zoom with Coach Yinka and Coach Gary. Please upload 3 to 5 clips of Sam from games or training by Friday, Nov 20 at 9:00 PM ET. Open the app, tap Film, and add them there: https://thestriveapp.com/film Let's make it a good one."
    );
    expect(film.playerSms).toMatch(/^Hey Sam, this week's Film Room is .+ Please upload 3 to 5 clips from your games or training by .+ Let's make it a good one\.$/);
    expect(checkin.sms).toMatch(/^Hey Jordan, monthly check-in calls with Coach Yinka and Coach Gary are open on .+\. Each call is 30 minutes\. Open the app and pick a time for Sam: https:\/\/thestriveapp\.com\/dashboard Let's get Sam on the calendar\.$/);
  });

  it("the coach is coming to a game, a badge, the welcome", () => {
    expect(words(EVERY_NOTICE["coach attending, with a date"])).toEqual({
      title: "Coach is coming to your game",
      body: "See you out there on Sat, Nov 28. Play brave.",
      path: "/dashboard",
      key: `coach_attending:${DAY}`,
    });
    expect(EVERY_NOTICE["coach attending, no date"].body).toBe("See you out there. Play brave.");
    expect(words(EVERY_NOTICE.earned)).toEqual({
      title: "10 Sessions",
      body: "Ten full sessions in the bank",
      path: "/you",
      key: "earned:10 Sessions",
    });
    expect(words(EVERY_NOTICE.welcome)).toEqual({
      title: "You're in",
      body: "Your first week gets built around your answers.",
      path: "/",
      key: "welcome",
    });
  });

  it("the reminder says what is waiting, in the session card's own figures", () => {
    expect(words(EVERY_NOTICE["reminder, session ready"])).toEqual({
      title: "Session 2 is ready",
      body: "4 drills, about 22 minutes.",
      path: "/dashboard",
      key: "reminder:2026-11-24",
    });
    expect(words(EVERY_NOTICE["reminder, session started"])).toEqual({
      title: "Session 2 is where you left it",
      body: "2 drills to go.",
      path: "/dashboard",
      key: "reminder:2026-11-24",
    });
    // the ordinary day rotates its title (voice guide, moment 9); the area
    // title only for a player whose weakest area is known
    expect(words(EVERY_NOTICE["reminder, session ready, the minutes"])).toEqual({
      title: "22 minutes today. That's it.",
      body: "Session 2 is ready. 22 minutes.",
      path: "/dashboard",
      key: "reminder:2026-11-24",
    });
    expect(words(EVERY_NOTICE["reminder, session ready, the weakest area"])).toEqual({
      title: "Your weak foot won't work on itself",
      body: "Session 2 is ready. 22 minutes.",
      path: "/dashboard",
      key: "reminder:2026-11-24",
    });
    expect(EVERY_NOTICE["reminder, session ready, 1v1 as the area"].title).toBe("Your 1v1 dribbling won't work on itself");
    for (const area of [null, undefined, "", "first touch under pressure"]) {
      for (let k = 0; k < 40; k++) {
        expect(reminderNotice({ ...facts, area, to: `p${k}` }).title, String(area)).not.toMatch(/work on itself/);
      }
    }
    expect(EVERY_NOTICE["reminder, one drill to go"].body).toBe("1 drill to go.");
    expect(words(EVERY_NOTICE["reminder, last session of the week"])).toEqual({
      title: "One more session completes your week",
      body: "Session 4, about 22 minutes.",
      path: "/dashboard",
      key: "reminder:2026-11-24",
    });
    expect(words(EVERY_NOTICE["reminders paused"])).toEqual({
      title: "Reminders are paused",
      body: "Your week is here whenever you're ready.",
      path: "/dashboard",
      key: "reminders_paused:2026-11-24",
    });
  });

  it("the free app: a friend posted, props, the earned month, a club's plan", () => {
    // the number is the hook (voice guide, moment 5)
    expect(words(EVERY_NOTICE["friend posted"])).toEqual({
      title: "Kai's getting work in",
      body: "1h 15m today. You training today?",
      path: "/log",
      key: "friend_post:2026-11-24",
    });
    expect(words(EVERY_NOTICE["friend posted, on the come up"])).toMatchObject({ title: "Kai is on the come up", body: "1h 15m today. Let's work." });
    expect(words(EVERY_NOTICE["friend posted, outworking you"])).toMatchObject({ title: "Kai is outworking you today", body: "1h 15m. Let's go." });
    expect(words(EVERY_NOTICE["friend posted, gym"])).toMatchObject({ title: "Kai's getting work in", body: "45m in the gym today. You training today?" });
    expect(words(EVERY_NOTICE["friend posted, no length read"])).toMatchObject({ title: "Kai's getting work in", body: "You training today?" });
    // "outworking you" only to a receiver who has done less today
    for (const mine of [75, 90, null, undefined]) {
      for (let k = 0; k < 60; k++) {
        expect(friendPostNotice({ first: "Kai", nyDate: "2026-11-24", kind: "training", minutes: 75, mine, to: `p${k}` }).title).not.toMatch(/outworking/);
      }
    }
    for (const n of Object.values(EVERY_NOTICE)) expect(n.body).not.toMatch(/opens when you post/);
    // a friend's own timed training put them in front on the friends board
    // (Coach Yinka's yes, Nov 27 2026), in the words he picked in the copy
    // quiz: the fact, then the teammate's jab
    expect(words(EVERY_NOTICE["friend passed you"])).toEqual({
      title: "Kai just passed you",
      body: "Trained 45m just now. You good with that?",
      path: "/log",
      key: "friend_passed:2026-11-24",
    });
    expect(EVERY_NOTICE["friend passed you, letting it stand"].body).toBe("45m just now. You letting that stand?");
    expect(EVERY_NOTICE["friend passed you, put in"].body).toBe("Put in 45m just now. Let's go.");
    expect(EVERY_NOTICE["friend passed you, a long one"].body).toBe("Trained 1h 30m just now. You good with that?");
    expect(words(EVERY_NOTICE.props)).toEqual({
      title: "Kai gave you props",
      body: "On your training post.",
      path: "/log",
      key: `props:${POST}`,
    });
    expect(words(EVERY_NOTICE["squad pass earned"])).toEqual({
      title: "You earned a month of Strive Pro",
      body: "Three teammates trained. Start it when you're ready.",
      path: "/log",
      key: "squad_pass:1",
    });
    expect(words(EVERY_NOTICE["club session planned"])).toEqual({
      title: "Sunday Pickup",
      body: "Club training Thu, Nov 26 at 6:00 PM.",
      path: `/log/club/${CLUB}`,
      key: `club_plan:${PLAN}`,
    });
    expect(EVERY_NOTICE["club game on"].body).toBe("Game against Renegados FC Sat, Nov 28 at 10:00 AM.");
  });

  // Coach Yinka, Nov 26 2026: "your club won the week need to be hype
  // like. (CLUB NAME IS STRIVE CHAMPS OF THE WEEK)"
  it("champs of the week: his words, the club's name in capitals, the true margin", () => {
    expect(words(EVERY_NOTICE["champs of the week"])).toEqual({
      title: "RENEGADOS FC IS STRIVE CHAMPS OF THE WEEK",
      body: "You beat Sunday Pickup by 12 minutes per player.",
      path: `/log/club/${CLUB}`,
      key: `club_champs:${CLUB}:2026-11-23`,
    });
    // a name too long for a lock screen goes in the body; the title is the mark alone
    const long = EVERY_NOTICE["champs of the week, a long club name"];
    expect(long.title).toBe("STRIVE CHAMPS OF THE WEEK");
    expect(long.body).toBe("Gainesville High School Varsity Boys Soccer beat Sunday Pickup by 1 minute per player.");
    for (const n of [EVERY_NOTICE["champs of the week"], long]) expect(n.title.length).toBeLessThanOrEqual(60);
    // one per club per week, replaced on the lock screen by next week's
    expect(EVERY_NOTICE["champs of the week"].collapse).toBe(`club_champs:${CLUB}`);
  });

  it("it is the ONE notice in capitals, in its title only, by his own word", () => {
    expect([...CAPITALS_ALLOWED]).toEqual(["club_champs"]);
    const champs = EVERY_NOTICE["champs of the week"];
    // without the named exception the rule still catches it
    expect(pushTextProblems(champs)).toEqual(["title is in capitals"]);
    expect(noticeProblems(champs)).toEqual([]);
    // the exception is the title's alone: a body in capitals is still refused
    expect(pushTextProblems({ title: champs.title, body: "YOU BEAT THEM ALL WEEK." }, { titleInCapitals: true })).toEqual(["body is in capitals"]);
    // and no other kind is let through by it
    const shouted = { ...EVERY_NOTICE["club session planned"], title: "SUNDAY PICKUP TRAINS TONIGHT" };
    expect(noticeProblems(shouted)).toContain("title is in capitals");
  });

  // The one notification the PHONE gives itself (lib/elite/training-clock.ts)
  it("the clock left running: once, at 1 hour 30 minutes, held to the same rule", () => {
    expect(CLOCK_NUDGE).toEqual({ title: "Your clock is still running", body: "1h 30m so far. Your finish photo stops it." });
    expect(CLOCK_NUDGE_MINUTES).toBe(90);
    expect(pushTextProblems(CLOCK_NUDGE)).toEqual([]);
  });
});

describe("which channel each kind uses, and the topic it belongs to", () => {
  const channel = (n: Notice) => `${n.bell ? "bell" : ""}${n.bell && n.push ? "+" : ""}${n.push ? "push" : ""}`;

  it("the bell is the record, the push is the tap on the shoulder", () => {
    const byKind = new Map(Object.values(EVERY_NOTICE).map((n) => [n.kind, channel(n)]));
    expect(Object.fromEntries(byKind)).toEqual({
      new_week: "bell+push",
      coach_message: "bell+push",
      checkin_feedback: "bell+push",
      film_feedback: "bell",
      film_room: "bell+push",
      checkin_days: "bell+push",
      coach_attending: "bell",
      earned: "bell",
      welcome: "bell",
      reminder: "push",
      reminders_paused: "push",
      friend_post: "push",
      friend_passed: "push",
      props: "push",
      squad_pass: "push",
      club_plan: "push",
      club_champs: "push",
    });
  });

  it("every kind in the catalogue is on this list", () => {
    const listed = new Set(Object.values(EVERY_NOTICE).map((n) => n.kind));
    expect([...NOTICE_KINDS].filter((k) => !listed.has(k))).toEqual([]);
  });

  it("each kind sits under one of the four topics a person can switch", () => {
    expect(KIND_TOPIC).toEqual({
      new_week: "week",
      reminder: "week",
      reminders_paused: "week",
      earned: "week",
      welcome: "week",
      coach_message: "coach",
      checkin_feedback: "coach",
      film_feedback: "coach",
      film_room: "coach",
      checkin_days: "coach",
      coach_attending: "coach",
      friend_post: "friends",
      friend_passed: "friends",
      props: "friends",
      squad_pass: "friends",
      club_plan: "clubs",
      club_champs: "clubs",
    });
    for (const n of Object.values(EVERY_NOTICE)) expect(n.topic).toBe(KIND_TOPIC[n.kind as keyof typeof KIND_TOPIC]);
  });

  it("only a coach's own message or reply has no key: each one is its own event", () => {
    const keyless = [...new Set(Object.values(EVERY_NOTICE).filter((n) => n.key === null).map((n) => n.kind))].sort();
    expect(keyless).toEqual(["checkin_feedback", "coach_message"]);
  });
});

describe("the rule: inform, never order, never sell, never shout", () => {
  it("every notice the app sends passes, words and shape", () => {
    for (const [name, n] of Object.entries(EVERY_NOTICE)) {
      expect(noticeProblems(n), name).toEqual([]);
    }
  });

  it("every badge a player can earn passes as a notice", () => {
    for (const rule of ACHIEVEMENT_RULES) {
      expect(noticeProblems(earnedNotice({ title: rule.title, detail: rule.detail })), rule.title).toEqual([]);
    }
  });

  it("the words of the choices pass too", () => {
    for (const [topic, c] of Object.entries(TOPIC_CHOICE)) {
      expect(pushTextProblems({ title: c.label, body: c.detail }), topic).toEqual([]);
    }
  });

  it("a tap on any of them opens a page of our own", () => {
    for (const [name, n] of Object.entries(EVERY_NOTICE)) {
      expect(n.path, name).toMatch(/^\/($|dashboard$|messages$|film$|you$|log$|log\/club\/[0-9a-f-]{36}$)/);
    }
  });

  it("the phone's own fallback words pass too", () => {
    const sw = read("public/sw.js");
    const m = sw.match(/let data = \{ title: "([^"]+)", body: "([^"]+)"/);
    expect(m).not.toBeNull();
    expect(pushTextProblems({ title: m![1], body: m![2] })).toEqual([]);
  });

  it("the rule catches an order, a sale, guilt and shouting", () => {
    const wrong: [string, { title: string; body: string }][] = [
      ["order", { title: "Don't forget your session", body: "It is waiting." }],
      ["order", { title: "Week 8 is live", body: "Go train now." }],
      ["order", { title: "Open the app", body: "Your week is live." }],
      ["order", { title: "Check your week", body: "It is live." }],
      ["order", { title: "Kai just posted", body: "Post yours to see it." }],
      ["order", { title: "Film Room is Sunday", body: "Upload 3 to 5 clips by Saturday." }],
      ["order", { title: "Check-in calls are open", body: "Pick your time on your dashboard." }],
      ["order", { title: "Your coach", body: "Send a clip this week." }],
      ["order", { title: "Sunday Pickup", body: "Add your name for Thursday." }],
      ["sells", { title: "Strive Elite", body: "Upgrade for $29 a month." }],
      ["sells", { title: "Strive Pro", body: "It is 29 a month." }],
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

  it("an earned month is not read as a price", () => {
    expect(pushTextProblems({ title: "You earned a month of Strive Pro", body: "Three teammates trained. Start it when you're ready." })).toEqual([]);
  });

  it("a notice with a bad address, an unknown topic or no channel is refused", () => {
    const good = EVERY_NOTICE.welcome;
    expect(noticeProblems({ ...good, path: "https://example.com/x" }).length).toBeGreaterThan(0);
    expect(noticeProblems({ ...good, path: "//example.com" }).length).toBeGreaterThan(0);
    expect(noticeProblems({ ...good, topic: "sales" as Notice["topic"] }).length).toBeGreaterThan(0);
    expect(noticeProblems({ ...good, push: false, bell: false }).length).toBeGreaterThan(0);
    expect(noticeProblems({ ...good, key: "k".repeat(121) }).length).toBeGreaterThan(0);
    expect(noticeProblems({ ...good, collapse: "c".repeat(65) }).length).toBeGreaterThan(0);
  });
});

describe("how a push arrives", () => {
  const DAYTIME = new Date("2026-11-24T20:00:00.000Z"); // 3:00 PM New York
  const NIGHT = new Date("2026-11-25T03:00:00.000Z"); // 10:00 PM New York
  const EARLY = new Date("2026-11-23T11:00:00.000Z"); // Monday 6:00 AM New York: the week unlocks
  const web = (p: Parameters<typeof webPushBody>[0]) => JSON.parse(webPushBody(p)) as Record<string, unknown>;

  it("the iPhone gets the same words, its topic as the thread, and where the tap opens", () => {
    const n = EVERY_NOTICE["new week, with a name"];
    const sent = JSON.parse(apnsBody(pushOf(n, DAYTIME))) as Record<string, unknown> & { aps: Record<string, unknown> };
    expect(sent.aps.alert).toEqual({ title: n.title, body: n.body });
    expect(sent.aps["thread-id"]).toBe("week");
    expect(sent.aps["interruption-level"]).toBe("active");
    expect(sent.aps.sound).toBe("default");
    expect(sent.url).toBe("/dashboard");
    expect(sent.topic).toBe("week");
    expect(sent.kind).toBe("new_week");
  });

  it("no number is ever put on the app's icon", () => {
    for (const n of Object.values(EVERY_NOTICE)) {
      const sent = JSON.parse(apnsBody(pushOf(n, DAYTIME))) as { aps: Record<string, unknown> };
      expect("badge" in sent.aps, n.kind).toBe(false);
    }
    expect(read("lib/elite/apns.ts")).not.toMatch(/badge\s*:/);
    // the app itself sets none, and clears whatever an earlier build left
    const phone = read("mobile/src/push.ts");
    expect(phone).toContain("shouldSetBadge: false");
    expect(phone).toContain("setBadgeCountAsync(0)");
    expect(read("mobile/app/_layout.tsx")).toContain("clearBadge()");
  });

  it("between 9:30 PM and 7:00 AM New York everything arrives quietly: no sound, the screen stays dark", () => {
    for (const at of [NIGHT, EARLY]) {
      for (const n of Object.values(EVERY_NOTICE)) {
        const payload = pushOf(n, at);
        const sent = JSON.parse(apnsBody(payload)) as { aps: Record<string, unknown> };
        expect(sent.aps["interruption-level"], n.kind).toBe("passive");
        expect("sound" in sent.aps, n.kind).toBe(false);
        expect(web(payload).silent, n.kind).toBe(true);
      }
    }
  });

  it("props never light the screen, whatever the hour", () => {
    expect(pushOf(EVERY_NOTICE.props, DAYTIME).quiet).toBe(true);
    expect(interruptionFor("props", { hour: 15, minute: 0 })).toBe("passive");
    expect(interruptionFor("new_week", { hour: 15, minute: 0 })).toBe("active");
    expect(interruptionFor("new_week", { hour: 21, minute: 30 })).toBe("passive");
    expect(interruptionFor("new_week", { hour: 6, minute: 59 })).toBe("passive");
    expect(interruptionFor("new_week", { hour: 7, minute: 0 })).toBe("active");
  });

  it("nothing is ever sent time-sensitive or critical", () => {
    for (const at of [DAYTIME, NIGHT]) {
      for (const n of Object.values(EVERY_NOTICE)) {
        expect(apnsBody(pushOf(n, at)), n.kind).not.toMatch(/time-sensitive|critical/);
      }
    }
    // in the code that builds the payload, the level is one of two words
    const code = read("lib/elite/apns.ts").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/time-sensitive|critical/);
    expect(code).toContain('payload.quiet ? "passive" : "active"');
  });

  it("a later reminder replaces the earlier one on the lock screen, and so does a new week", () => {
    const head = (n: Notice, at: Date) => apnsHeaders({ token: "t", jwt: "j", bundleId: "b", payload: pushOf(n, at) });
    expect(head(EVERY_NOTICE["reminder, session ready"], DAYTIME)["apns-collapse-id"]).toBe("reminder");
    expect(head(EVERY_NOTICE["reminders paused"], DAYTIME)["apns-collapse-id"]).toBe("reminder");
    expect(head(EVERY_NOTICE["new week, with a name"], DAYTIME)["apns-collapse-id"]).toBe("new_week");
    expect(head(EVERY_NOTICE["Film Room announced"], DAYTIME)["apns-collapse-id"]).toBe(`film_room:${ROOM}`);
    // a coach's message never replaces another
    expect("apns-collapse-id" in head(EVERY_NOTICE["coach message"], DAYTIME)).toBe(false);
    // a quiet push goes at the lower priority Apple asks for
    expect(head(EVERY_NOTICE["coach message"], DAYTIME)["apns-priority"]).toBe("10");
    expect(head(EVERY_NOTICE["coach message"], NIGHT)["apns-priority"]).toBe("5");
    // Apple refuses a collapse id over 64 bytes: it is left off instead
    expect(apnsCollapseId("c".repeat(64))).toBe("c".repeat(64));
    expect(apnsCollapseId("c".repeat(65))).toBeNull();
    for (const n of Object.values(EVERY_NOTICE)) {
      if (n.collapse) expect(apnsCollapseId(n.collapse), n.kind).toBe(n.collapse);
    }
  });

  it("the browser gets the same: a tag to replace, silent when quiet, an address that is always ours", () => {
    const week = web(pushOf(EVERY_NOTICE["new week, with a name"], DAYTIME));
    expect(week).toMatchObject({ title: "Week 8 is here, Sam", body: FOCUS, url: "/dashboard", tag: "new_week", topic: "week" });
    expect(week.silent).toBeUndefined();
    expect(web({ title: "x", body: "y" }).url).toBe("/");
    const sw = read("public/sw.js");
    expect(sw).toContain('url: "/"');
    expect(sw).not.toContain('"/dashboard"');
    expect(sw).toMatch(/silent/);
    expect(sw).toMatch(/tag/);
  });
});

// The source check. The words of a notice live in notices.ts; the one
// place that writes a bell row or sends a push is notify.ts. A notice
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

describe("no notice is written anywhere but the one sender", () => {
  const files = ["app", "components", "lib"].flatMap((d) => walk(join(root, d)));
  const rel = (f: string) => f.replace(root + "/", "");
  const src = (f: string) => readFileSync(f, "utf8");

  it("only notify.ts sends a push", () => {
    const senders = files
      .filter((f) => !f.endsWith("lib/elite/push.ts"))
      .filter((f) => /sendPushTo(Player|Profile)\(/.test(src(f)))
      .map(rel);
    expect(senders).toEqual(["lib/elite/notify.ts"]);
  });

  it("only notify.ts writes a bell row", () => {
    const writers = files
      .filter((f) => /from\("elite_notifications"\)\s*\.insert\(/.test(src(f)))
      .map(rel);
    expect(writers).toEqual(["lib/elite/notify.ts"]);
    // and nothing anywhere deletes one: a repeat is hidden, never removed
    const deleters = files.filter((f) => /from\("elite_notifications"\)\s*\.delete\(/.test(src(f))).map(rel);
    expect(deleters).toEqual([]);
  });

  it("every call of the sender takes its notice from the catalogue", () => {
    // notifyPlayer(<id>, <something>Notice(...)) or a notice built just
    // above from a builder; never an object written in place
    const callers = files.filter((f) => !f.endsWith("lib/elite/notify.ts")).filter((f) => /notify(Player|Profile)\(/.test(src(f)));
    expect(callers.map(rel).sort()).toEqual([
      "app/api/elite/auth/redeem/route.ts",
      "lib/elite/achievements.ts",
      "lib/elite/coach-actions.ts",
      "lib/elite/film-room-actions.ts",
      "lib/elite/free-notices-server.ts",
      "lib/elite/reminders-server.ts",
      "lib/elite/squad-pass-server.ts",
      "lib/elite/unlock.ts",
    ]);
    for (const f of callers) {
      const text = src(f);
      expect(text, rel(f)).toMatch(/from "(@\/lib\/elite|\.)\/(notices|film-room)"/);
      // the second argument of every call: a builder, or a notice a builder made
      const calls = [...text.matchAll(/notify(?:Player|Profile)\(\s*[^,()]+(?:\([^()]*\))?[^,()]*,\s*([^\n]{0,40})/g)];
      expect(calls.length, rel(f)).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call[1], rel(f)).toMatch(/^(\w+Notice\(|notice\b|m\.notice\b)/);
      }
    }
  });

  it("the old file of push words is gone, and nothing imports it", () => {
    expect(files.map(rel)).not.toContain("lib/elite/push-texts.ts");
    for (const f of files) expect(src(f), rel(f)).not.toMatch(/from ["'][^"']*push-texts["']/);
  });

  it("a new week is announced once, from the one place that announces a week", () => {
    // one notice per event: the announcer (unlock.ts) takes the database
    // claim (announce.ts) before the notice, and the bell row's own key
    // (new_week:<week>) refuses a second one after it. The publish step
    // announces nothing itself: it hands over to the announcer.
    const unlock = read("lib/elite/unlock.ts");
    const claim = unlock.indexOf("claimWeekAnnouncement(");
    expect(claim).toBeGreaterThan(-1);
    expect(unlock.indexOf("newWeekNotice({")).toBeGreaterThan(claim);
    const publish = read("lib/elite/coach-actions.ts");
    expect(publish).not.toContain("newWeekNotice(");
    expect(publish).toContain("unlockDueWeeks({ force: true })");
  });

  it("the reminder is claimed for the day before it is sent", () => {
    const text = read("lib/elite/reminders-server.ts");
    const claim = text.indexOf("claimReminder(admin, p.id, today)");
    expect(claim).toBeGreaterThan(-1);
    expect(text.indexOf("notifyPlayer(p.id, reminderNotice(")).toBeGreaterThan(claim);
    expect(text.indexOf("notifyPlayer(p.id, remindersPausedNotice(")).toBeGreaterThan(claim);
    expect(text).toContain("maySend(await claimReminder(");
  });

  it("the email that goes with a notice carries the notice's own title as its subject", () => {
    for (const file of ["lib/elite/coach-actions.ts", "lib/elite/unlock.ts", "lib/elite/film-room-actions.ts"]) {
      expect(read(file), file).toMatch(/subject: (notice|m\.notice)\.title/);
    }
  });
});
