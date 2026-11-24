// The notification choices, read and written (the shape is pure in
// notice-prefs.ts). Everything is the signed-in person's OWN row and
// nothing else: the topics they turned off (elite_profiles.notify_off) and,
// for a member, their reminder hour (elite_players.reminder_hour), both
// from migration 088. Written with the service client after the viewer is
// known, the way every member's own write is made (a browser has no write
// policy on either table).
//
// Before 088 is applied the columns are not there: the read answers "no
// choices to show" and a save answers that it could not be stored. Nothing
// else in the app depends on either.
import { createServiceClient } from "./supabase/server";
import { freeAccountFor, trackerFor } from "./tracker-server";
import { memberTier } from "./pro-server";
import { featureOn } from "./tiers";
import { NOTICE_TOPICS, topicsFor, type NoticeTopic } from "./notices";
import { reminderChoice } from "./reminders";
import { NO_NOTICE_PREFS, buildNoticePrefs, withTopic, type NoticePrefs } from "./notice-prefs";
import type { Viewer } from "./session";

export const PREFS_NOT_SAVED = "That could not be saved. Try again in a minute.";

type Who = { member: boolean; free: boolean; coachTime: boolean };

// Whose notifications these are: a member (with or without the coach's
// time), a free account, or neither (a coach, the example player).
async function whoIs(viewer: Viewer): Promise<Who> {
  if (viewer.role !== "player" || viewer.demo) return { member: false, free: false, coachTime: false };
  // A Strive Pro member who came through the free app is both: their week
  // AND their friends and clubs (lib/elite/one-app.ts).
  const [has, lives] = await Promise.all([
    trackerFor(viewer).catch(() => null),
    freeAccountFor(viewer).catch(() => null),
  ]);
  const free = has !== null;
  const member = Boolean(viewer.playerId) && lives === null;
  if (!member || !viewer.playerId) return { member: false, free, coachTime: false };
  const tier = await memberTier(viewer.playerId);
  const coachTime = featureOn(tier, "coachChat") || featureOn(tier, "filmRoom") || featureOn(tier, "monthlyCheckin");
  return { member, free, coachTime };
}

async function readOff(profileId: string): Promise<string[] | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  try {
    const { data, error } = await admin.from("elite_profiles").select("notify_off").eq("id", profileId).maybeSingle();
    const off = (data as { notify_off?: unknown } | null)?.notify_off;
    return !error && Array.isArray(off) ? (off as string[]) : null;
  } catch {
    return null;
  }
}

async function readHour(playerId: string): Promise<number | null | undefined> {
  const admin = createServiceClient();
  if (!admin) return undefined;
  try {
    const { data, error } = await admin.from("elite_players").select("reminder_hour").eq("id", playerId).maybeSingle();
    if (error || !data) return undefined;
    return (data as { reminder_hour: number | null }).reminder_hour ?? null;
  } catch {
    return undefined;
  }
}

export async function loadNoticePrefs(viewer: Viewer): Promise<NoticePrefs> {
  const who = await whoIs(viewer);
  if (!who.member && !who.free) return NO_NOTICE_PREFS;
  const [off, hour] = await Promise.all([
    readOff(viewer.profile.id),
    who.member && viewer.playerId ? readHour(viewer.playerId) : Promise.resolve(undefined),
  ]);
  return buildNoticePrefs({ ...who, off, reminderHour: hour });
}

export type PrefsSaved = { ok: true; prefs: NoticePrefs } | { ok: false; error: string };

// One switch: a topic this account is offered, on or off.
export async function saveNoticeTopic(viewer: Viewer, topic: unknown, on: unknown): Promise<PrefsSaved> {
  const who = await whoIs(viewer);
  const offered = topicsFor(who);
  if (typeof on !== "boolean" || !NOTICE_TOPICS.includes(topic as NoticeTopic) || !offered.includes(topic as NoticeTopic)) {
    return { ok: false, error: PREFS_NOT_SAVED };
  }
  const admin = createServiceClient();
  const off = await readOff(viewer.profile.id);
  if (!admin || off === null) return { ok: false, error: PREFS_NOT_SAVED };
  const { error } = await admin
    .from("elite_profiles")
    .update({ notify_off: withTopic(off, topic as NoticeTopic, on) })
    .eq("id", viewer.profile.id);
  if (error) return { ok: false, error: PREFS_NOT_SAVED };
  return { ok: true, prefs: await loadNoticePrefs(viewer) };
}

// "When do you usually train?": one of the four choices. "It changes"
// stores no hour, and the hour they are learned to train at is used.
export async function saveReminderChoice(viewer: Viewer, key: unknown): Promise<PrefsSaved> {
  const who = await whoIs(viewer);
  const choice = reminderChoice(key);
  if (!who.member || !viewer.playerId || !choice) return { ok: false, error: PREFS_NOT_SAVED };
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: PREFS_NOT_SAVED };
  const { error } = await admin.from("elite_players").update({ reminder_hour: choice.hour }).eq("id", viewer.playerId);
  if (error) return { ok: false, error: PREFS_NOT_SAVED };
  return { ok: true, prefs: await loadNoticePrefs(viewer) };
}
