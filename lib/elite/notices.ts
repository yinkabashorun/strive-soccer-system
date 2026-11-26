// THE CATALOGUE: every notification Strive Elite can send, in one place.
//
// One event, one set of words. A notice is built here by one function and
// the SAME object is used by every channel: the row in the bell (the
// website) and the Inbox (the iPhone app), the push on a locked phone, and
// the subject of the email. Before Nov 24 2026 the words of one event were
// written in five places and disagreed ("Week 8 is ready", "week 8 just
// dropped", "Week 8 is live").
//
// Pure, and shared with the phone ("@shared/notices"): no server, no
// database, nothing from Next. The one sender is lib/elite/notify.ts;
// tests/push-texts.test.ts is THE LIST, every notice word for word, and a
// source check there refuses a push or a bell row written anywhere else.
//
// The rule every notice is held to (pushTextProblems, at the bottom): it
// tells the person something that happened, once; it never gives an order,
// never sells, never shouts, never counts what was missed.
//
// HOW TO ADD ONE: add its kind to KIND_TOPIC and CHANNELS, write its
// builder here, add it to the list in tests/push-texts.test.ts, and send it
// with notifyPlayer / notifyProfile. Nothing else.
import { isQuietTime } from "./free-notices";
import { champsBeatLine } from "./club-matchup-words";

// The choice a notice belongs to (Account, Notifications), and the group it
// stacks under on an iPhone's lock screen.
export const NOTICE_TOPICS = ["week", "coach", "friends", "clubs"] as const;
export type NoticeTopic = (typeof NOTICE_TOPICS)[number];

export const NOTICE_KINDS = [
  "new_week",
  "coach_message",
  "checkin_feedback",
  "film_feedback",
  "film_room",
  "checkin_days",
  "coach_attending",
  "earned",
  "welcome",
  "reminder",
  "reminders_paused",
  "friend_post",
  "props",
  "squad_pass",
  "club_plan",
  "club_champs",
] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];
// A kind is a string in the database, and one this build does not know (a
// row written by a newer build) is shown as it was sent.
export type NoticeKindAll = NoticeKind | (string & {});

export const KIND_TOPIC: Record<NoticeKind, NoticeTopic> = {
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
  props: "friends",
  squad_pass: "friends",
  club_plan: "clubs",
  club_champs: "clubs",
};

// Which channels a kind uses. The bell row is the record; the push is the
// tap on the shoulder. A reminder is a tap on the shoulder and nothing
// else. A free account has no bell, so its four are push only.
//
// A film breakdown stays bell only (with the email it always had): it never
// pushed before, and a new push is more volume, which needs Coach Yinka's
// word first (docs/product-principles.md, "Protect the channel"). Turning
// it on is this one line.
const CHANNELS: Record<NoticeKind, { push: boolean; bell: boolean }> = {
  new_week: { push: true, bell: true },
  coach_message: { push: true, bell: true },
  checkin_feedback: { push: true, bell: true },
  film_feedback: { push: false, bell: true },
  film_room: { push: true, bell: true },
  checkin_days: { push: true, bell: true },
  coach_attending: { push: false, bell: true },
  earned: { push: false, bell: true },
  welcome: { push: false, bell: true },
  reminder: { push: true, bell: false },
  reminders_paused: { push: true, bell: false },
  friend_post: { push: true, bell: false },
  props: { push: true, bell: false },
  squad_pass: { push: true, bell: false },
  club_plan: { push: true, bell: false },
  club_champs: { push: true, bell: false },
};

// The kinds that always arrive quietly (in the list, no sound, no screen
// lighting up), whatever the hour.
const ALWAYS_QUIET: ReadonlySet<string> = new Set(["props"]);

export type Notice = {
  kind: NoticeKindAll;
  topic: NoticeTopic;
  // The SAME words in the bell, the push and the email subject.
  title: string;
  body: string;
  // Where it opens on the website: a path on our own site.
  path: string;
  // One bell row and one push per key per person, ever. Null only for a
  // coach's message or reply: each of those is its own event.
  key: string | null;
  push: boolean;
  bell: boolean;
  // A later notice with the same collapse id replaces the earlier one on
  // the lock screen, where that is right (yesterday's reminder, last
  // week's "week is here").
  collapse?: string;
};

function make(
  kind: NoticeKind,
  n: { title: string; body: string; path: string; key: string | null; collapse?: string }
): Notice {
  return { kind, topic: KIND_TOPIC[kind], ...CHANNELS[kind], ...n };
}

export function topicOfKind(kind: string | null | undefined): NoticeTopic | null {
  return (KIND_TOPIC as Record<string, NoticeTopic>)[kind ?? ""] ?? null;
}

// A path on our own site and nothing else: one leading slash, no "//", no
// scheme, no backslash, nothing a browser could read as another address.
// The same shape the database checks (migration 088, elite_notifications.url).
export const NOTICE_PATH = /^\/(?!\/)[A-Za-z0-9\-._~/?#=&%+@]*$/;
export const FRONT_DOOR = "/";

export function cleanNoticePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const p = raw.trim();
  if (!p || p.length > 300) return null;
  if (!NOTICE_PATH.test(p) || p.includes("//") || p.includes("\\")) return null;
  return p;
}

// How a push arrives. "active": the ordinary way. "passive": straight to
// the list, no sound, the screen stays dark. Between 9:30 PM and 7:00 AM
// New York time every notice is passive: nothing is dropped, nothing wakes
// anyone (a new week is announced from 4:00 PM, announce.ts). Never "time-sensitive":
// nothing Strive sends is worth breaking through a Focus.
export type Interruption = "active" | "passive";

export function interruptionFor(kind: string, clock: { hour: number; minute: number }): Interruption {
  if (ALWAYS_QUIET.has(kind)) return "passive";
  return isQuietTime(clock) ? "passive" : "active";
}

// ---------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------

// How much of a coach's own words rides on a notice.
export const NOTICE_PREVIEW = 140;
const preview = (s: string) => (s ?? "").trim().slice(0, NOTICE_PREVIEW);
const firstNameOf = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/)[0] ?? "";

// The coach's name as it is stored on their profile, short enough for a
// title, or "Your coach".
export function coachNameFor(stored: string | null | undefined): string {
  const name = (stored ?? "").replace(/\s+/g, " ").trim().slice(0, 30).trim();
  return name || "Your coach";
}

// A new week is live: published live at once, or held on Sunday and
// unlocked Monday morning. One builder for both senders, and the same
// words as the app's own "Your week is here." screen.
export function newWeekNotice(input: {
  first?: string | null;
  week: number;
  firstWeek?: boolean;
  focus?: string | null;
}): Notice {
  const first = firstNameOf(input.first);
  const what = input.firstWeek ? "Your first week is here" : `Week ${input.week} is here`;
  return make("new_week", {
    title: first ? `${what}, ${first}` : what,
    body: (input.focus ?? "").trim() || "Your new training week is ready.",
    path: "/dashboard",
    key: `new_week:${input.week}`,
    collapse: "new_week",
  });
}

// The coach wrote to the player. The title is who; the body is their words.
export function coachMessageNotice(input: { coach?: string | null; message: string }): Notice {
  return make("coach_message", {
    title: coachNameFor(input.coach),
    body: preview(input.message),
    path: "/messages",
    key: null,
  });
}

// The coach answered the weekly check-in. The reply is read here, in the
// note itself.
export function checkinFeedbackNotice(input: { coach?: string | null; feedback: string }): Notice {
  return make("checkin_feedback", {
    title: `${coachNameFor(input.coach)} replied to your check-in`,
    body: preview(input.feedback),
    path: "/dashboard",
    key: null,
  });
}

export function filmFeedbackNotice(input: { filmId: string; summary: string }): Notice {
  return make("film_feedback", {
    title: "Your film breakdown is in",
    body: preview(input.summary),
    path: "/film",
    key: `film_feedback:${input.filmId}`,
  });
}

// `when` and `due` come formatted from film-room.ts fmtWhen
// ("Sunday, Nov 29 at 7:00 PM ET").
export function filmRoomNotice(input: { roomId: string; when: string; due: string }): Notice {
  return make("film_room", {
    title: `Film Room is ${input.when}`,
    body: `Clips are open until ${input.due}.`,
    path: "/film",
    key: `film_room:${input.roomId}`,
    collapse: `film_room:${input.roomId}`,
  });
}

// `window` comes formatted from film-room.ts fmtDayWindow
// ("Sunday, Nov 15, 9 AM to 12 PM ET").
export function checkinDaysNotice(input: { dayId: string; window: string }): Notice {
  return make("checkin_days", {
    title: "Check-in calls are open",
    body: `${input.window}. Times are on your Home screen.`,
    path: "/dashboard",
    key: `checkin_days:${input.dayId}`,
  });
}

export function coachAttendingNotice(input: { gameId: string; gameDate?: string | null }): Notice {
  return make("coach_attending", {
    title: "Coach is coming to your game",
    body: input.gameDate ? `See you out there on ${input.gameDate}. Play brave.` : "See you out there. Play brave.",
    path: "/dashboard",
    key: `coach_attending:${input.gameId}`,
  });
}

// A badge was earned: its own name and its own line (achievement-rules.ts).
// The finish screen already celebrates it, so the bell keeps the record
// and the phone stays quiet.
export function earnedNotice(input: { title: string; detail: string }): Notice {
  return make("earned", {
    title: input.title,
    body: input.detail,
    path: "/you",
    key: `earned:${input.title}`,
  });
}

export function welcomeNotice(): Notice {
  return make("welcome", {
    title: "You're in",
    body: "Your first week gets built around your answers.",
    path: FRONT_DOOR,
    key: "welcome",
  });
}

// The reminder at the player's own time (lib/elite/reminders.ts decides
// when, and works out these facts from the week). It says what is waiting,
// in the session card's own figures. Never a count of anything missed.
export type ReminderFacts = {
  // the next plan session with work left, as its card names it
  session: number;
  drills: number;
  drillsLeft: number;
  minutes: number;
  // it is the last plan session of the week with work left
  lastOpen: boolean;
};

const drillsWord = (n: number) => (n === 1 ? "1 drill" : `${n} drills`);
const minutesWord = (n: number) => (n === 1 ? "about 1 minute" : `about ${n} minutes`);

export function reminderNotice(f: ReminderFacts & { nyDate: string }): Notice {
  const at = { path: "/dashboard", key: `reminder:${f.nyDate}`, collapse: "reminder" };
  if (f.lastOpen) {
    return make("reminder", {
      title: "One more session completes your week",
      body: `Session ${f.session}, ${minutesWord(f.minutes)}.`,
      ...at,
    });
  }
  if (f.drillsLeft < f.drills) {
    return make("reminder", {
      title: `Session ${f.session} is where you left it`,
      body: `${drillsWord(f.drillsLeft)} to go.`,
      ...at,
    });
  }
  return make("reminder", {
    title: `Session ${f.session} is ready`,
    body: `${drillsWord(f.drills)}, ${minutesWord(f.minutes)}.`,
    ...at,
  });
}

// The last word after five reminders nobody answered: then silence, until
// the player trains again.
export function remindersPausedNotice(input: { nyDate: string }): Notice {
  return make("reminders_paused", {
    title: "Reminders are paused",
    body: "Your week is here whenever you are ready.",
    path: "/dashboard",
    key: `reminders_paused:${input.nyDate}`,
    collapse: "reminder",
  });
}

// The free app's three (free-notices.ts and squad-pass.ts decide when).
// `first` is the friend's first name.
export function friendPostNotice(input: { first: string; nyDate: string }): Notice {
  return make("friend_post", {
    title: `${input.first} just posted`,
    body: "Their post opens when you post yours today.",
    path: "/log",
    key: `friend_post:${input.nyDate}`,
    collapse: "friend_post",
  });
}

export function propsNotice(input: { first: string; postId: string }): Notice {
  return make("props", {
    title: `${input.first} gave you props`,
    body: "On your training post.",
    path: "/log",
    key: `props:${input.postId}`,
    collapse: `props:${input.postId}`,
  });
}

// Bring your squad: sent once, by the insert that made the month.
export function squadPassNotice(input: { number: number }): Notice {
  return make("squad_pass", {
    title: "You earned a month of Strive Pro",
    body: "Three teammates trained. Start it when you are ready.",
    path: "/log",
    key: `squad_pass:${input.number}`,
  });
}

// The only notice about clubs: a club's training session is planned, or a
// game between two clubs is on. Once per plan for each member
// (free-notices.ts decides who; claimed in elite_plan_notices, 087). `what`
// is "Club training" (or the session's own title) or "Game against <the
// other club>"; `when` is "Tue, Nov 24 at 6:00 PM", New York time. The
// place is never on a lock screen: it is shown inside the app.
export function clubPlanNotice(input: { planId: string; club: string; clubId: string; what: string; when: string }): Notice {
  return make("club_plan", {
    title: input.club,
    body: `${input.what} ${input.when}.`,
    path: `/log/club/${input.clubId}`,
    key: `club_plan:${input.planId}`,
    collapse: `club_plan:${input.planId}`,
  });
}

// CHAMPS OF THE WEEK. Coach Yinka's own words for it, Nov 26 2026: "your
// club won the week need to be hype like. (CLUB NAME IS STRIVE CHAMPS OF
// THE WEEK)". Sent once to each player counted in a matchup their club
// WON (never for a draw or a loss), on Monday evening, claimed first in
// elite_champs_notices (090). The body is the true margin, in the matchup
// card's own words.
//
// It is the ONE notice whose title is in capitals (CAPITALS_ALLOWED,
// below): that is the hype he asked for, for a thing a club earned. A
// club name so long that the line would not fit a lock screen goes in the
// body instead, and the title is the mark alone.
export const CHAMPS_TITLE_TAIL = "IS STRIVE CHAMPS OF THE WEEK";
export const CHAMPS_TITLE_ALONE = "STRIVE CHAMPS OF THE WEEK";
const TITLE_MAX = 60;

export function clubChampsNotice(input: { club: string; clubId: string; other: string; gap: number; weekMonday: string }): Notice {
  const full = `${input.club.toUpperCase()} ${CHAMPS_TITLE_TAIL}`;
  const fits = full.length <= TITLE_MAX;
  return make("club_champs", {
    title: fits ? full : CHAMPS_TITLE_ALONE,
    body: champsBeatLine({ who: fits ? "You" : input.club, other: input.other, gap: input.gap }),
    path: `/log/club/${input.clubId}`,
    key: `club_champs:${input.clubId}:${input.weekMonday}`,
    collapse: `club_champs:${input.clubId}`,
  });
}

// ---------------------------------------------------------------------
// The choices (Account, Notifications)
// ---------------------------------------------------------------------

export const TOPIC_CHOICE: Record<NoticeTopic, { label: string; detail: string }> = {
  week: { label: "Your week", detail: "A new week, and one reminder at your usual time." },
  coach: { label: "Your coach", detail: "Messages, Film Room and check-in calls." },
  friends: { label: "Friends", detail: "A friend posted, props, your earned month." },
  clubs: { label: "Clubs", detail: "Your club's sessions and games, and a week your club wins." },
};

// The topics an account is offered a switch for. A member: the week, and
// the coach when the membership includes the coach's time (Strive Elite
// and Complete). A free account: friends, and clubs. A topic no notice
// uses yet is not offered: a switch for something that never arrives is
// noise.
export function topicsFor(who: { member: boolean; free: boolean; coachTime: boolean }): NoticeTopic[] {
  const used = new Set<NoticeTopic>(Object.values(KIND_TOPIC));
  const mine: NoticeTopic[] = [];
  if (who.member) {
    mine.push("week");
    if (who.coachTime) mine.push("coach");
  }
  if (who.free) mine.push("friends", "clubs");
  return mine.filter((t) => used.has(t));
}

// WHY we ask to send notifications (the finish screen's one ask) and WHAT
// arrives (the row in Settings): only what this person will really get.
// A Strive Pro player has no coach chat and no Film Room, so neither is
// named to them; a player with friends in the app is told about friends.
// One place, so the website and the iPhone app can never promise more.
export type NoticeWho = { coachTime: boolean; friends: boolean };

export function whyNotifications(who: NoticeWho): string {
  if (who.coachTime) return "So you know the moment your new week is here, your coach messages you, or a Film Room is announced. Nothing else.";
  if (who.friends) return "So you know when your new week is here, when a friend posts, and what your club plans. Nothing else.";
  return "So you know the moment your new week is here, and when today's session is ready. Nothing else.";
}

export function whatNotifications(who: NoticeWho): string {
  if (who.coachTime) return "Your new week, your coach, a Film Room. Nothing else.";
  if (who.friends) return "Your new week, a friend's post or props, and what your club plans. Nothing else.";
  return "Your new week, and one reminder on a day you have a session left. Nothing else.";
}

// What is stored (elite_profiles.notify_off): only topics we know, once
// each. Anything else in the request is dropped.
export function cleanTopicsOff(raw: unknown): NoticeTopic[] {
  if (!Array.isArray(raw)) return [];
  return NOTICE_TOPICS.filter((t) => raw.includes(t));
}

export function topicIsOff(off: readonly string[] | null | undefined, topic: NoticeTopic): boolean {
  return Array.isArray(off) && off.includes(topic);
}

// "2h ago", for a row in the Inbox. `now` is passed in so it can be tested.
export function agoLabel(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const m = Math.max(0, Math.floor((now - t) / 60_000));
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
}

// ---------------------------------------------------------------------
// The rule, as a check a test (or anything else) can run on a notice's
// words. Returns what is wrong, or an empty list.
// ---------------------------------------------------------------------
// ("Check-in calls are open" names a thing; "Check your week" is an order.)
const ORDERS =
  /^(go|do|don'?t|hurry|open|tap|click|check(?!-in\b)|buy|join|upgrade|get|grab|train|start|finish|log|come|act|claim|unlock|renew|pay|subscribe|sign|download|watch|remember|post|upload|pick|send|add|make sure|you need|you must|you should|time to|last chance|only \d|still haven'?t|you (have )?missed)\b/i;
// A price, however it is written ("$29", "29 a month"), or the words of a
// sale. "You earned a month of Strive Pro" is not a price: a length of
// time with no amount in front of it is left alone.
const SELLING =
  /\$\s?\d|\b\d+\s?% off\b|\b\d[\d.,]*\s*(dollars?\s+)?(a|per|each|every)\s+(month|week|year)\b|\b(price|pricing|discount|sale|offer|deal|upgrade|membership fee|per month|\/mo|free trial|limited time|spots? left|renew|subscribe|buy)\b/i;
const GUILT = /\b(streak|missed|behind|falling behind|slacking|lazy|disappoint\w*|last chance|don'?t lose)\b/i;

// The kinds whose TITLE may be in capitals. One, by Coach Yinka's own
// word (see clubChampsNotice). The body is still held to the rule, and
// tests/push-texts.test.ts holds this set to exactly that one kind.
export const CAPITALS_ALLOWED: ReadonlySet<string> = new Set(["club_champs"]);

export function pushTextProblems(text: { title: string; body: string }, opts: { titleInCapitals?: boolean } = {}): string[] {
  const problems: string[] = [];
  const title = text.title.trim();
  const body = text.body.trim();
  if (!title) problems.push("no title");
  if (!body) problems.push("no body");
  if (title.length > 60) problems.push("title over 60 characters");
  for (const [name, value] of [
    ["title", title],
    ["body", body],
  ] as const) {
    if (ORDERS.test(value)) problems.push(`${name} opens with an order`);
    if (SELLING.test(value)) problems.push(`${name} sells`);
    if (GUILT.test(value)) problems.push(`${name} counts what was missed`);
    if (/!/.test(value)) problems.push(`${name} shouts (exclamation mark)`);
    if (/[—–]/.test(value)) problems.push(`${name} has a long dash`);
    if (/\p{Extended_Pictographic}/u.test(value)) problems.push(`${name} has an emoji`);
    if (/\b(AI|automated|algorithm)\b/.test(value)) problems.push(`${name} names the machinery`);
    if (!(name === "title" && opts.titleInCapitals) && /\b[A-Z]{4,}\b/.test(value.replace(/\b(ET|PM|AM|ECNL|MLS|NEXT)\b/g, ""))) {
      problems.push(`${name} is in capitals`);
    }
  }
  return problems;
}

// A notice as a whole: its words, where it opens, and what it is filed
// under. Used by the list test and by the sender (a notice that fails is
// never sent with a bad address).
export function noticeProblems(n: Notice): string[] {
  const problems = pushTextProblems(n, { titleInCapitals: CAPITALS_ALLOWED.has(n.kind) });
  if (!cleanNoticePath(n.path)) problems.push("path is not a page of ours");
  if (!NOTICE_TOPICS.includes(n.topic)) problems.push("unknown topic");
  if (n.key !== null && (!n.key || n.key.length > 120)) problems.push("bad key");
  if (n.collapse !== undefined && (!n.collapse || n.collapse.length > 64)) problems.push("collapse id over 64 bytes");
  if (!n.push && !n.bell) problems.push("uses no channel");
  return problems;
}
