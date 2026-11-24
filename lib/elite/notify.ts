// THE ONE SENDER of a notification. Every bell row and every push in the
// app goes out through notifyPlayer (a member) or notifyProfile (a free
// account), given a notice from the catalogue (lib/elite/notices.ts).
// tests/push-texts.test.ts refuses a push or a bell row written anywhere
// else.
//
// What it does, in order:
//   1. writes the bell row with the notice's key. The database holds one
//      row per (player, key) (migration 088), so the insert IS the claim:
//      a repeat of the same notice hits the key and everything stops here,
//      bell and push. (Production once held 95 copies of "Week 8 is ready"
//      for one profile.)
//   2. reads the person's choices (Account, Notifications): a topic they
//      turned off sends no push. The bell row was still written: it is the
//      record, and nobody is interrupted by it.
//   3. sends the push to every device on file, under the topic's group,
//      with the collapse id, quietly between 9:30 PM and 7:00 AM New York.
//   4. says what it did.
//
// Email and the texts to a parent stay with the caller: the texts are
// Coach Yinka's own approved words. The email's subject is the notice's
// title, so the three never disagree.
//
// The claim ledgers that already exist are untouched and come first:
// announce.ts (a week is announced once), elite_training_reminders (one
// reminder a day), elite_free_notices and elite_plan_notices (the free
// app). The key here is a second lock under them. A notice with no bell
// row (a reminder, everything a free account gets) is claimed by its
// caller's ledger before this is called; a free account has no bell.
//
// Works before migration 088 is applied: an insert the database refuses
// for a column it does not have falls back to the row as it always was,
// and a choice that cannot be read means nothing is turned off.
//
// Best effort, and it never throws: a notice that cannot go never fails
// the thing that caused it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase/server";
import { sendPushToPlayer, sendPushToProfile, type PushPayload } from "./push";
import { claimOutcome } from "./announce";
import { nyClock } from "./free-notices";
import { FRONT_DOOR, cleanNoticePath, interruptionFor, topicIsOff, type Notice } from "./notices";

export type BellOutcome =
  | "written" // the row, with where it opens and its key
  | "legacy" // the row as it was before 088 (no address, no key)
  | "already" // this notice was already sent to this person: nothing more happens
  | "failed" // the row could not be written at all
  | "none"; // this kind writes no bell row

export type NotifyResult = {
  bell: BellOutcome;
  // devices the push reached
  pushed: number;
  // why no push went out, when none was tried
  held: null | "already" | "topic_off" | "no_push";
};

const NOTHING: NotifyResult = { bell: "none", pushed: 0, held: "no_push" };

// The push of a notice: its words, where a tap opens, its topic and kind,
// its collapse id and whether it arrives quietly at this hour.
export function pushOf(notice: Notice, at: Date = new Date()): PushPayload {
  return {
    title: notice.title,
    body: notice.body,
    url: cleanNoticePath(notice.path) ?? FRONT_DOOR,
    topic: notice.topic,
    kind: notice.kind,
    ...(notice.collapse ? { collapse: notice.collapse } : {}),
    quiet: interruptionFor(notice.kind, nyClock(at)) === "passive",
  };
}

// The topics a person turned off. Anything that cannot be read (088 not
// applied, a failed request) is "nothing turned off".
async function topicsOff(db: SupabaseClient, profileId: string | null): Promise<string[]> {
  if (!profileId) return [];
  try {
    const { data, error } = await db.from("elite_profiles").select("notify_off").eq("id", profileId).maybeSingle();
    const off = (data as { notify_off?: unknown } | null)?.notify_off;
    return !error && Array.isArray(off) ? (off as string[]) : [];
  } catch {
    return [];
  }
}

async function profileOfPlayer(db: SupabaseClient, playerId: string): Promise<string | null> {
  try {
    const { data } = await db.from("elite_players").select("profile_id").eq("id", playerId).maybeSingle();
    return (data as { profile_id?: string | null } | null)?.profile_id ?? null;
  } catch {
    return null;
  }
}

// The bell row. The insert is the claim: the unique index on (player,
// key) answers a repeat with 23505.
async function writeBell(db: SupabaseClient, playerId: string, notice: Notice): Promise<BellOutcome> {
  const row = { player_id: playerId, kind: notice.kind, title: notice.title, body: notice.body };
  try {
    const { error } = await db
      .from("elite_notifications")
      .insert({ ...row, url: cleanNoticePath(notice.path), dedupe_key: notice.key });
    if (!error) return "written";
    if (claimOutcome(error) === "already") return "already";
    // 088 is not applied yet (no such column), or the database refused the
    // new fields: the row as it always was.
    const legacy = await db.from("elite_notifications").insert(row);
    return legacy.error ? "failed" : "legacy";
  } catch {
    return "failed";
  }
}

// A member. `db` is only for a caller that has no service client to fall
// back on (a local build); production always uses the service client.
export async function notifyPlayer(
  playerId: string,
  notice: Notice,
  opts: { db?: SupabaseClient | null } = {}
): Promise<NotifyResult> {
  try {
    const db = createServiceClient() ?? opts.db ?? null;
    if (!db || !playerId) return NOTHING;

    const bell = notice.bell ? await writeBell(db, playerId, notice) : "none";
    if (bell === "already") return { bell, pushed: 0, held: "already" };
    if (!notice.push) return { bell, pushed: 0, held: "no_push" };

    const off = await topicsOff(db, await profileOfPlayer(db, playerId));
    if (topicIsOff(off, notice.topic)) return { bell, pushed: 0, held: "topic_off" };

    const { sent } = await sendPushToPlayer(playerId, pushOf(notice));
    return { bell, pushed: sent, held: null };
  } catch {
    return NOTHING;
  }
}

// A free account: it has no member row and no bell, so a notice is its
// push. Its caller has already claimed it (elite_free_notices,
// elite_plan_notices, the insert that made an earned month).
export async function notifyProfile(profileId: string, notice: Notice): Promise<NotifyResult> {
  try {
    if (!notice.push || !profileId) return NOTHING;
    const db = createServiceClient();
    if (!db) return NOTHING;
    if (topicIsOff(await topicsOff(db, profileId), notice.topic)) return { bell: "none", pushed: 0, held: "topic_off" };
    const { sent } = await sendPushToProfile(profileId, pushOf(notice));
    return { bell: "none", pushed: sent, held: null };
  } catch {
    return NOTHING;
  }
}
