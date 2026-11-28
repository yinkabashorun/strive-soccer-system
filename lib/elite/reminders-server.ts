// The reminder at the member's own time, sent (Nov 22 2026; made specific
// and self-limiting Nov 24 2026). Called by the hourly plan-builder cron.
// The rules are pure in reminders.ts; this file only reads what they need
// and sends. Every send is claimed first in elite_training_reminders (078,
// player + New York date): only the caller whose insert succeeds sends, so
// a second cron instance, a retry or a bug that runs this twice in an hour
// can never send a second push that day. The words are a notice
// (lib/elite/notices.ts) and go out through the one sender (notify.ts).
//
// Works before migration 088 is applied: with no reminder_hour column the
// learned hour and the default decide, and with no reminders_paused_at the
// count of unanswered reminders alone holds the pause.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase/server";
import { everyRow } from "./supabase/every-row";
import { isPushConfigured } from "./push";
import { isNativePushConfigured } from "./apns";
import { notifyPlayer } from "./notify";
import { reminderNotice, remindersPausedNotice, topicIsOff } from "./notices";
import { claimOutcome, maySend, weekIsLiveUnannounced } from "./announce";
import { currentBreak } from "./breaks";
import { groupSessions, planSessionsLeft } from "./session-flow";
import { liveWeekFor, nyDayNumber, nyHour, nyToday } from "./time";
import {
  nyDateOf,
  reminderDecision,
  reminderFacts,
  reminderHourFor,
  reminderStage,
  remindersSinceTick,
  usualHour,
} from "./reminders";
import type { Homework, TrainingBreak } from "./types";

export type ReminderRun = { checked: number; sent: number; paused: number };

async function claimReminder(admin: SupabaseClient, playerId: string, nyDate: string) {
  try {
    const { error } = await admin.from("elite_training_reminders").insert({ player_id: playerId, ny_date: nyDate });
    return claimOutcome(error);
  } catch {
    return "failed" as const;
  }
}

type RosterRow = {
  id: string;
  profile_id: string | null;
  week1_monday: string | null;
  current_week: number | null;
  reminder_hour?: number | null;
  reminders_paused_at?: string | null;
  // the quiz's weakest areas, weakest first (the reminder's one title that
  // names the area reads the first)
  weaknesses?: string[] | null;
};

// The members to look at, with their own reminder hour and the pause's
// memory where the database has them (088), and without where it does not.
async function rosterOf(admin: SupabaseClient, ids: string[]): Promise<RosterRow[]> {
  const base = "id, profile_id, week1_monday, current_week";
  const on = ["active", "trialing"];
  const full = await admin
    .from("elite_players")
    .select(`${base}, reminder_hour, reminders_paused_at, weaknesses`)
    .in("subscription_status", on)
    .in("id", ids);
  if (!full.error) return (full.data as RosterRow[] | null) ?? [];
  const old = await admin.from("elite_players").select(base).in("subscription_status", on).in("id", ids);
  return (old.data as RosterRow[] | null) ?? [];
}

// Who turned "Your week" off. A choice that cannot be read is nobody.
async function weekTopicOff(admin: SupabaseClient, profileIds: string[]): Promise<Set<string>> {
  if (profileIds.length === 0) return new Set();
  try {
    const { data, error } = await admin.from("elite_profiles").select("id, notify_off").in("id", profileIds);
    if (error) return new Set();
    return new Set(
      ((data as { id: string; notify_off: string[] | null }[] | null) ?? []).filter((p) => topicIsOff(p.notify_off, "week")).map((p) => p.id)
    );
  } catch {
    return new Set();
  }
}

// Whether a player's week is announced today (New York date): the ledger
// says it was announced today, or the week has opened and is still waiting
// for its 4:00 PM announcement (announce.ts). Either way the announcement
// is the one thing they hear from us that day.
async function announcedToday(admin: SupabaseClient, playerId: string, week: number, today: string): Promise<boolean> {
  try {
    const { data } = await admin
      .from("elite_week_announcements")
      .select("announced_at")
      .eq("player_id", playerId)
      .eq("week", week)
      .maybeSingle();
    const at = (data as { announced_at?: string } | null)?.announced_at;
    if (at) return nyDateOf(at) === today;
    return await weekIsLiveUnannounced(admin, playerId, week);
  } catch {
    return false;
  }
}

export async function sendTrainingReminders(): Promise<ReminderRun> {
  const run: ReminderRun = { checked: 0, sent: 0, paused: 0 };
  if (!isPushConfigured() && !isNativePushConfigured()) return run;
  const day = nyDayNumber();
  if (day === 7) return run; // Monday to Saturday only
  const admin = createServiceClient();
  if (!admin) return run;

  // Only members who turned notifications on: a browser or the iPhone app.
  const [{ data: subs }, { data: phones }] = await Promise.all([
    admin.from("elite_push_subscriptions").select("player_id"),
    admin.from("elite_native_push_tokens").select("player_id"),
  ]);
  const withPush = new Set(
    [...(subs ?? []), ...(phones ?? [])].map((r) => r.player_id as string | null).filter((id): id is string => Boolean(id))
  );
  if (withPush.size === 0) return run;

  const roster = await rosterOf(admin, [...withPush]);
  if (roster.length === 0) return run;

  const ids = roster.map((p) => p.id);
  const today = nyToday();
  const hour = nyHour();
  const [rows, { data: breaks }, claimed, weekOff] = await Promise.all([
    everyRow<Homework>((from, to) =>
      admin
        .from("elite_homework")
        .select("id, player_id, week, session, is_extra, completed, completed_at, sort, title, duration_min")
        .in("player_id", ids)
        .order("id")
        .range(from, to)
    ),
    admin.from("elite_training_breaks").select("player_id, since, until").in("player_id", ids).gte("until", today),
    // the days a reminder was claimed (kept 60 days by the cron)
    everyRow<{ player_id: string; ny_date: string }>((from, to) =>
      admin
        .from("elite_training_reminders")
        .select("player_id, ny_date")
        .in("player_id", ids)
        .order("player_id")
        .order("ny_date")
        .range(from, to)
    ),
    weekTopicOff(admin, roster.map((p) => p.profile_id).filter((id): id is string => Boolean(id))),
  ]);
  const hwBy = new Map<string, Homework[]>();
  for (const h of rows) hwBy.set(h.player_id, [...(hwBy.get(h.player_id) ?? []), h]);
  const breaksBy = new Map<string, Pick<TrainingBreak, "since" | "until">[]>();
  for (const b of (breaks as (Pick<TrainingBreak, "since" | "until"> & { player_id: string })[] | null) ?? []) {
    breaksBy.set(b.player_id, [...(breaksBy.get(b.player_id) ?? []), b]);
  }
  const claimedBy = new Map<string, string[]>();
  for (const c of claimed) claimedBy.set(c.player_id, [...(claimedBy.get(c.player_id) ?? []), c.ny_date]);

  for (const p of roster) {
    run.checked++;
    const hw = hwBy.get(p.id) ?? [];
    // The week being trained, the same rule as the dashboard.
    const live = liveWeekFor(p.week1_monday, p.current_week);
    const maxBuilt = hw.reduce((m, h) => Math.max(m, h.week), 0);
    const week = Math.max(1, Math.min(live, maxBuilt || 1));
    const sessions = groupSessions(hw.filter((h) => h.week === week));
    const ticks = hw.filter((h) => h.completed && h.completed_at).map((h) => h.completed_at as string);
    const at = reminderHourFor({ chosen: p.reminder_hour, learned: usualHour(ticks), nyDay: day });
    const input = {
      nyHour: hour,
      nyDay: day,
      hour: at.hour,
      fromDefault: at.fromDefault,
      wentLiveToday: false,
      notificationsOn: true,
      topicOff: Boolean(p.profile_id && weekOff.has(p.profile_id)),
      onBreak: currentBreak(breaksBy.get(p.id) ?? [], today) !== null,
      hasWeek: sessions.length > 0,
      sessionsLeft: planSessionsLeft(sessions, {}),
      trainedToday: ticks.some((t) => nyDateOf(t) === today),
    };
    if (!reminderDecision(input).send) continue;
    // Nobody gets a reminder the day their week is announced: the
    // announcement at 4:00 PM already tells them that day.
    if (!reminderDecision({ ...input, wentLiveToday: await announcedToday(admin, p.id, week, today) }).send) continue;

    const facts = reminderFacts(sessions);
    if (!facts) continue;
    // Five in a row unanswered: one last notice, then nothing until they
    // tick off a drill again.
    const lastTick = ticks.length ? ticks.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b)) : null;
    const stage = reminderStage({
      sinceTick: remindersSinceTick(claimedBy.get(p.id) ?? [], lastTick ? nyDateOf(lastTick) : null),
      pausedAt: p.reminders_paused_at ?? null,
      lastTickAt: lastTick,
    });
    if (stage === "silent") continue;
    if (!maySend(await claimReminder(admin, p.id, today))) continue;
    if (stage === "pause_notice") {
      // remembered past the ledger's 60 days (088; nothing to write before it)
      await admin
        .from("elite_players")
        .update({ reminders_paused_at: new Date().toISOString() })
        .eq("id", p.id)
        .then(() => undefined, () => undefined);
      await notifyPlayer(p.id, remindersPausedNotice({ nyDate: today }));
      run.paused++;
      continue;
    }
    const told = await notifyPlayer(p.id, reminderNotice({ ...facts, area: p.weaknesses?.[0] ?? null, nyDate: today, to: p.id }));
    if (told.pushed > 0) run.sent++;
  }
  return run;
}
