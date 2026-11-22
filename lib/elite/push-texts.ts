// Every push notification the app sends, in one place.
//
// A push lands on a locked phone, so it is held to a tighter rule than
// anything inside the app (Apple's notification guidance, and the house
// voice): it tells the member something that happened, once per event; it
// never gives an order, never sells, never shouts. Keeping the words here,
// pure, lets tests/push-texts.test.ts read every one of them against that
// rule, and a source check there refuses a push whose words are written
// anywhere else.
//
// The senders (sendPushToPlayer in push.ts) are:
//   - coach-actions.ts sendCoachMessage: coachMessagePush
//   - coach-actions.ts applyGeneratedPlanCore, a week that goes live at
//     once: newWeekPush
//   - unlock.ts unlockDueWeeks, a held week unlocking Monday 6am ET:
//     weekUnlockedPush
//   - film-room-actions.ts notifyMembers: the pushTitle and pushBody of
//     filmRoomAnnouncement and checkinAnnouncement (film-room.ts)
//   - free-notices-server.ts (sendPushToProfile, the free app): friendPostPush
//     and propsPush, each claimed first in elite_free_notices (078)
//   - reminders-server.ts sendTrainingReminders, the hourly cron at the
//     member's usual time: trainingReminderPush (at most one a day,
//     claimed first in elite_training_reminders, 078)
// One announcement a week is enforced by the database (announce.ts), so
// the two new-week pushes can never both go out for the same week.

export type PushText = { title: string; body: string; url: string };

// How much of a coach's message rides on the notification.
export const COACH_MESSAGE_PREVIEW = 140;

// The coach wrote to the player. The body is the coach's own words.
export function coachMessagePush(message: string): PushText {
  return {
    title: "Message from your coach",
    body: message.slice(0, COACH_MESSAGE_PREVIEW),
    url: "/messages",
  };
}

// A new week that is live the moment it is published (a first week, or a
// catch-up during the week). `focus` is the week's focus sentence.
export function newWeekPush(input: {
  first: string;
  week: number;
  firstWeek: boolean;
  focus?: string | null;
}): PushText {
  const { first, week, firstWeek } = input;
  return {
    title: firstWeek
      ? first
        ? `${first}, your first week is live`
        : "Your first week is live"
      : first
        ? `${first}, week ${week} just dropped`
        : `Week ${week} just dropped`,
    body: input.focus || "Your new training week is live.",
    url: "/dashboard",
  };
}

// A week built on Sunday and held until Monday morning, now unlocked.
export function weekUnlockedPush(input: { first: string; week: number; focus?: string | null }): PushText {
  const { first, week } = input;
  return {
    title: first ? `Week ${week} is live, ${first}` : `Week ${week} is live`,
    body: input.focus || "Your new training week just unlocked.",
    url: "/dashboard",
  };
}

// The reminder at the member's usual training time (lib/elite/reminders.ts
// decides when). It says what is waiting; when one plan session is left it
// says that one completes the week. Never a count of anything missed.
export function trainingReminderPush(input: { sessionsLeft: number }): PushText {
  return input.sessionsLeft === 1
    ? { title: "One more session completes your week", body: "Today's is ready.", url: "/dashboard" }
    : { title: "Today's session is ready", body: "One tap and you're training.", url: "/dashboard" };
}

// The free app's two (free-notices.ts decides when): a friend posted and
// this player has not yet today, and a friend gave props. `first` is the
// friend's first name.
export function friendPostPush(first: string): PushText {
  return { title: `${first} just posted`, body: "Post yours to see it.", url: "/log" };
}

export function propsPush(first: string): PushText {
  return { title: `${first} gave you props`, body: "On your training post.", url: "/log" };
}

// The rule itself, as a check a test (or anything else) can run on a
// notification's words. Returns what is wrong, or an empty list.
const ORDERS =
  /^(go|do|don'?t|hurry|open|tap|click|check|buy|join|upgrade|get|grab|train|start|finish|log|come|act|claim|unlock|renew|pay|subscribe|sign|download|watch|remember|make sure|you need|you must|you should|time to|last chance|only \d|still haven'?t|you (have )?missed)\b/i;
const SELLING =
  /\$\s?\d|\b\d+\s?% off\b|\b(price|pricing|discount|sale|offer|deal|upgrade|membership fee|per month|a month|\/mo|free trial|limited time|spots? left|renew|subscribe|buy)\b/i;
const GUILT = /\b(streak|missed|behind|falling behind|slacking|lazy|disappoint\w*|last chance|don'?t lose)\b/i;

export function pushTextProblems(text: { title: string; body: string }): string[] {
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
    if (/\b[A-Z]{4,}\b/.test(value.replace(/\b(ET|PM|AM|ECNL|MLS|NEXT)\b/g, ""))) {
      problems.push(`${name} is in capitals`);
    }
  }
  return problems;
}
