// A finished session counts ONCE on the player's free-app week (Nov 24
// 2026, lib/elite/one-app.ts): a Strive Pro member who has friends and
// clubs in the app trains in Train, and the minutes they really trained go
// on their week, the friends board, their club's time and the weekly
// matchup, exactly like a session a free player logs by hand.
//
// How "once" is held: the entry's id is worked out from the player, the
// week and the session, so a second write of the same session meets the
// primary key and changes nothing. No new column, no second ledger.
//
//   - written when the last drill of a session is ticked done (the tick's
//     own action, lib/elite/player-actions.ts toggleHomework), by the
//     website and the iPhone app alike
//   - the minutes are the session's credited minutes (the one rule,
//     creditedMinutes): the time each drill really took. A session tapped
//     through in seconds adds nothing and writes nothing.
//   - the database holds the day's 8 hours (071), as for any entry
//   - a drill unticked later takes the entry back off the week, unless a
//     photo was posted on it (a post is never deleted from under friends)
//   - the write that puts it on the week tells a friend it just passed
//     ("<First> just passed you", once a day at most per friend)
//   - it has no photo, so it unlocks nothing in the feed. The finish
//     screen offers "Post it to your friends", which adds a photo to THIS
//     entry (attachSessionPhoto): the time is never counted twice.
//
// Server only. Never throws: a tick is never refused or slowed by this.
import { createHash } from "node:crypto";
import { createServiceClient } from "./supabase/server";
import { creditedMinutes } from "./time-trained";
import { nyToday } from "./time";
import { noticeFriendPassed } from "./free-notices-server";

// elite_training_logs.minutes is checked 1 to 300 (069)
export const SESSION_LOG_MAX = 300;

// A stable uuid for (player, week, session): the same three always give
// the same id, and it is shaped like any other uuid the table holds.
export function sessionLogId(playerId: string, week: number, session: number): string {
  const h = createHash("sha256").update(`strive-session-log:${playerId}:${week}:${session}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// What the phone names a session by: "<week>-<session>".
export function parseSessionRef(raw: unknown): { week: number; session: number } | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{1,3})-(\d{1,2})$/.exec(raw.trim());
  if (!m) return null;
  const week = Number(m[1]);
  const session = Number(m[2]);
  return week >= 1 && session >= 1 ? { week, session } : null;
}

type DrillRow = { completed: boolean | null; duration_min: number | null; actual_seconds: number | null };

// The minutes a finished session puts on the week, or null when it is not
// finished or adds nothing. Pure.
export function sessionLogMinutes(rows: readonly DrillRow[]): number | null {
  if (rows.length === 0 || rows.some((r) => !r.completed)) return null;
  const minutes = rows.reduce((sum, r) => sum + creditedMinutes(r), 0);
  return minutes >= 1 ? Math.min(SESSION_LOG_MAX, minutes) : null;
}

type Admin = NonNullable<ReturnType<typeof createServiceClient>>;

async function sessionRows(admin: Admin, playerId: string, week: number, session: number): Promise<DrillRow[] | null> {
  const { data, error } = await admin
    .from("elite_homework")
    .select("completed, duration_min, actual_seconds")
    .eq("player_id", playerId)
    .eq("week", week)
    .eq("session", session);
  return error ? null : ((data as DrillRow[] | null) ?? []);
}

// Make the week agree with one session: on it when the session is finished,
// off it when it is not. Returns whether the session is on the week now.
export async function settleSessionLog(i: { playerId: string; profileId: string; week: number; session: number }): Promise<boolean> {
  try {
    const admin = createServiceClient();
    if (!admin) return false;
    // only an account with the free app behind it has a week to put it on
    const { data: tracker } = await admin.from("elite_trackers").select("profile_id, target_minutes").eq("profile_id", i.profileId).maybeSingle();
    if (!tracker) return false;
    const rows = await sessionRows(admin, i.playerId, i.week, i.session);
    if (rows === null) return false;
    const id = sessionLogId(i.playerId, i.week, i.session);
    const minutes = sessionLogMinutes(rows);
    if (minutes === null) {
      // a drill was unticked: the time comes back off, unless friends
      // already see a photo on it
      await admin.from("elite_training_logs").delete().eq("id", id).eq("profile_id", i.profileId).is("photo_path", null);
      return false;
    }
    const { error } = await admin.from("elite_training_logs").insert({
      id,
      profile_id: i.profileId,
      trained_on: nyToday(),
      minutes,
      kind: "training",
      proof: "session", // timed drill by drill by the session player: it counts everywhere
      week_target: (tracker as { target_minutes: number | null }).target_minutes || null,
    });
    // 23505: this session is already on the week. That is the point.
    if (error) return String(error.code ?? "") === "23505";
    // The write that put the session on the week, and only that one, tells
    // a friend it just passed (free-notices-server.ts). A session written
    // again meets the key above and tells nobody.
    await noticeFriendPassed({ posterId: i.profileId, entryId: id, today: nyToday() }).catch(() => []);
    return true;
  } catch {
    return false;
  }
}

// The session a drill belongs to, then settle it. Called by the tick.
export async function settleSessionLogForDrill(i: { playerId: string; profileId: string; homeworkId: string }): Promise<void> {
  try {
    const admin = createServiceClient();
    if (!admin) return;
    const { data } = await admin.from("elite_homework").select("week, session").eq("id", i.homeworkId).eq("player_id", i.playerId).maybeSingle();
    const row = data as { week: number | null; session: number | null } | null;
    if (!row?.week || !row.session) return;
    await settleSessionLog({ playerId: i.playerId, profileId: i.profileId, week: row.week, session: row.session });
  } catch {
    /* the tick itself is saved; the week catches up on the next tick */
  }
}
