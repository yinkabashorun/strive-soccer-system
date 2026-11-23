// The reminder at the member's usual time, sent (Nov 22 2026). Called by
// the hourly plan-builder cron. The rules are pure in reminders.ts; this
// file only reads what they need and sends. Every send is claimed first in
// elite_training_reminders (078, player + New York date): only the caller
// whose insert succeeds sends, so a second cron instance, a retry or a bug
// that runs this twice in an hour can never send a second push that day.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase/server";
import { isPushConfigured, sendPushToPlayer } from "./push";
import { isNativePushConfigured } from "./apns";
import { trainingReminderPush } from "./push-texts";
import { claimOutcome, maySend } from "./announce";
import { currentBreak } from "./breaks";
import { groupSessions, planSessionsLeft } from "./session-flow";
import { liveWeekFor, nyDayNumber, nyHour, nyToday } from "./time";
import { nyDateOf, reminderDecision, usualHour } from "./reminders";
import type { Homework, TrainingBreak } from "./types";

export type ReminderRun = { checked: number; sent: number };

async function claimReminder(admin: SupabaseClient, playerId: string, nyDate: string) {
  try {
    const { error } = await admin.from("elite_training_reminders").insert({ player_id: playerId, ny_date: nyDate });
    return claimOutcome(error);
  } catch {
    return "failed" as const;
  }
}

export async function sendTrainingReminders(): Promise<ReminderRun> {
  const run: ReminderRun = { checked: 0, sent: 0 };
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

  const { data: players } = await admin
    .from("elite_players")
    .select("id, week1_monday, current_week")
    .in("subscription_status", ["active", "trialing"])
    .in("id", [...withPush]);
  const roster = (players as { id: string; week1_monday: string | null; current_week: number | null }[] | null) ?? [];
  if (roster.length === 0) return run;

  const ids = roster.map((p) => p.id);
  const today = nyToday();
  const hour = nyHour();
  const [{ data: rows }, { data: breaks }] = await Promise.all([
    admin
      .from("elite_homework")
      .select("id, player_id, week, session, is_extra, completed, completed_at, sort, title")
      .in("player_id", ids),
    admin.from("elite_training_breaks").select("player_id, since, until").in("player_id", ids).gte("until", today),
  ]);
  const hwBy = new Map<string, Homework[]>();
  for (const h of (rows as Homework[] | null) ?? []) hwBy.set(h.player_id, [...(hwBy.get(h.player_id) ?? []), h]);
  const breaksBy = new Map<string, Pick<TrainingBreak, "since" | "until">[]>();
  for (const b of (breaks as (Pick<TrainingBreak, "since" | "until"> & { player_id: string })[] | null) ?? []) {
    breaksBy.set(b.player_id, [...(breaksBy.get(b.player_id) ?? []), b]);
  }

  for (const p of roster) {
    run.checked++;
    const hw = hwBy.get(p.id) ?? [];
    // The week being trained, the same rule as the dashboard.
    const live = liveWeekFor(p.week1_monday, p.current_week);
    const maxBuilt = hw.reduce((m, h) => Math.max(m, h.week), 0);
    const week = Math.max(1, Math.min(live, maxBuilt || 1));
    const sessions = groupSessions(hw.filter((h) => h.week === week));
    const left = planSessionsLeft(sessions, {});
    const decision = reminderDecision({
      nyHour: hour,
      nyDay: day,
      usualHour: usualHour(hw.filter((h) => h.completed).map((h) => h.completed_at)),
      notificationsOn: true,
      onBreak: currentBreak(breaksBy.get(p.id) ?? [], today) !== null,
      hasWeek: sessions.length > 0,
      sessionsLeft: left,
      trainedToday: hw.some((h) => h.completed && h.completed_at && nyDateOf(h.completed_at) === today),
    });
    if (!decision.send) continue;
    if (!maySend(await claimReminder(admin, p.id, today))) continue;
    const { sent } = await sendPushToPlayer(p.id, trainingReminderPush({ sessionsLeft: left }));
    if (sent > 0) run.sent++;
  }
  return run;
}
