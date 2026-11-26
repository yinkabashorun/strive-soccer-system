// "Notifications" in Account (the website) and Settings (the iPhone app),
// as one pure shape both draw. Under the on/off for this phone:
//   - one switch per topic that applies to the account ("Your week", "Your
//     coach" for a membership with the coach's time, "Friends" and "Clubs"
//     for a free account). Turning a topic off stops its pushes; the bell
//     row is still written, it is the record.
//   - for a member, "Reminder time": when they usually train, one tap
//     (lib/elite/reminders.ts REMINDER_CHOICES).
// Shared with the phone ("@shared/notice-prefs"). The reads and writes are
// in notice-prefs-server.ts.
import { TOPIC_CHOICE, topicIsOff, topicsFor, type NoticeTopic } from "./notices";
import { REMINDER_CHOICES, REMINDER_QUESTION, choiceForHour, type ReminderChoiceKey } from "./reminders";
import { CLUBS_TOPIC_DETAIL_NO_GAMES, CLUB_GAMES_IN_APP } from "./club-games";

export type NoticePrefs = {
  // The switches this account is offered, in order. Empty when the choices
  // cannot be stored yet (migration 088 not applied): nothing is shown.
  topics: { key: NoticeTopic; label: string; detail: string; on: boolean }[];
  // The reminder time, for a member only. Null for everyone else, and
  // while it cannot be stored.
  reminder: null | {
    question: string;
    choices: { key: ReminderChoiceKey; label: string }[];
    chosen: ReminderChoiceKey | null;
  };
};

export const NO_NOTICE_PREFS: NoticePrefs = { topics: [], reminder: null };

export const REMINDER_ROW_LABEL = "Reminder time";

export function buildNoticePrefs(i: {
  member: boolean;
  free: boolean;
  // the membership includes the coach's own time (Strive Elite, Complete)
  coachTime: boolean;
  // elite_profiles.notify_off, or null when it could not be read
  off: readonly string[] | null;
  // elite_players.reminder_hour, or undefined when it could not be read
  reminderHour: number | null | undefined;
}): NoticePrefs {
  const topics =
    i.off === null
      ? []
      : topicsFor(i).map((key) => ({ key, ...TOPIC_CHOICE[key], on: !topicIsOff(i.off, key) }));
  const reminder =
    i.member && i.reminderHour !== undefined
      ? {
          question: REMINDER_QUESTION,
          choices: REMINDER_CHOICES.map((c) => ({ key: c.key, label: c.label })),
          chosen: choiceForHour(i.reminderHour),
        }
      : null;
  return { topics, reminder };
}

// The same choices as the iPhone app shows them: while games between
// clubs are out of the app (lib/elite/club-games.ts) the Clubs switch
// names no games.
export function prefsForApp(prefs: NoticePrefs, games: boolean = CLUB_GAMES_IN_APP): NoticePrefs {
  if (games) return prefs;
  return { ...prefs, topics: prefs.topics.map((t) => (t.key === "clubs" ? { ...t, detail: CLUBS_TOPIC_DETAIL_NO_GAMES } : t)) };
}

// The stored list after one switch is flipped.
export function withTopic(off: readonly string[], topic: NoticeTopic, on: boolean): NoticeTopic[] {
  const next = new Set(off.filter((t) => t !== topic));
  if (!on) next.add(topic);
  return (["week", "coach", "friends", "clubs"] as const).filter((t) => next.has(t));
}
