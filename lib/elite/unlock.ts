// A week that is due goes live, and is announced.
//
// TWO STEPS, on purpose (Coach Yinka, Nov 24 2026: "lets not send notis at
// 6 am", "dont text parents either", "4 pm is fine"):
//
//   1. THE WEEK OPENS at its unlock time (early Monday, New York). Nothing
//      is sent. A player who opens the app before school sees the new week.
//   2. THE WEEK IS ANNOUNCED from 4:00 PM New York (announce.ts
//      weekAnnounceOpen): the bell note and the notification (one notice,
//      lib/elite/notices.ts), the email, and the parent report where a
//      membership has one. Once per player per week, held by the database
//      (announce.ts, migration 066).
//
// Nobody is texted that a new week is live. That text is gone, with the
// early hour.
//
// The same two steps hold for a week that goes live at once (a first week,
// a catch-up during the week): the publish step (coach-actions.ts) writes
// the plan row as waiting and calls this, so there is ONE place a week is
// announced from. Called by the hourly job, by the coach's pages on load,
// and by the publish step. Idempotent and cheap (an indexed query, usually
// zero rows). Uses the service client.

import { createServiceClient } from "./supabase/server";
import { sendPlayerEmail } from "./email";
import { sendPlayerSMS } from "./sms";
import { notifyPlayer } from "./notify";
import { newWeekNotice } from "./notices";
import { buildParentRecap } from "./parent-recap";
import { SESSIONS_PER_WEEK, sessionsWord } from "./training";
import { withoutPlayersOnBreak } from "./health";
import { nyHour } from "./time";
import { claimWeekAnnouncement, weekAnnounceOpen } from "./announce";

let lastRun = 0;

export type UnlockRun = {
  // weeks announced by this run
  announced: { playerId: string; week: number }[];
  // weeks that are live but whose announcement could not be recorded, so
  // nothing was sent (they are tried again on the next run)
  unrecorded: { playerId: string; week: number }[];
};

export async function unlockDueWeeks(opts: { force?: boolean } = {}): Promise<UnlockRun> {
  const run: UnlockRun = { announced: [], unrecorded: [] };
  // Throttle: at most once a minute per server instance. The publish step
  // has just written a row and asks past it.
  const now = Date.now();
  if (!opts.force && now - lastRun < 60_000) return run;
  lastRun = now;

  const admin = createServiceClient();
  if (!admin) return run;

  const { data: due } = await admin
    .from("elite_weekly_plans")
    .select("id, player_id, week, focus, homework")
    .eq("notified", false)
    .lte("unlocks_at", new Date().toISOString())
    .order("unlocks_at", { ascending: true })
    .limit(50);
  if (!due || due.length === 0) return run;

  // A player on a break (034) keeps their unlock, and its announcement,
  // until they are back: the plan row stays waiting and is picked up by
  // the first run after the break ends.
  const resting = new Set(
    (await withoutPlayersOnBreak(admin, due.map((p) => ({ id: p.player_id as string })))).map((p) => p.id)
  );
  const ready = due.filter((p) => resting.has(p.player_id as string));
  const open = weekAnnounceOpen(nyHour());

  for (const plan of ready) {
    const playerId = plan.player_id as string;
    const week = plan.week as number;
    const { data: player } = await admin
      .from("elite_players")
      .select("full_name, current_week")
      .eq("id", playerId)
      .maybeSingle();

    // 1) The week is open from its unlock time, whatever the hour.
    if (!player || week > (player.current_week ?? 0)) {
      await admin
        .from("elite_players")
        .update({ current_week: week, today_focus: plan.focus })
        .eq("id", playerId);
    }

    // 2) The announcement waits for 4:00 PM New York.
    if (!open) continue;

    // Take the row first so two requests at once cannot both announce.
    const { data: taken } = await admin
      .from("elite_weekly_plans")
      .update({ notified: true })
      .eq("id", plan.id)
      .eq("notified", false)
      .select("id");
    if (!taken || taken.length === 0) continue;

    // One announcement per player per week, enforced by the database.
    const claim = await claimWeekAnnouncement(admin, playerId, week);
    if (claim === "already") continue;
    if (claim === "failed") {
      // The ledger could not be written: nothing is sent (an announcement
      // that cannot be recorded is one that can repeat), the row goes back
      // to waiting, and the next run tries again.
      await admin.from("elite_weekly_plans").update({ notified: false }).eq("id", plan.id);
      run.unrecorded.push({ playerId, week });
      continue;
    }

    const first = player?.full_name?.split(" ")[0] ?? "";
    const firstWeek = week === 1;
    // The plan row stores the sessions it was built with (four or six).
    const built = Array.isArray(plan.homework) ? plan.homework.length : 0;
    const w = sessionsWord(built || SESSIONS_PER_WEEK);
    const sessionsSaid = w[0].toUpperCase() + w.slice(1);

    // The bell row, the notification and the email subject are one notice.
    const notice = newWeekNotice({ first, week, firstWeek, focus: plan.focus });
    await notifyPlayer(playerId, notice);
    await sendPlayerEmail(playerId, {
      event: "new_week",
      subject: notice.title,
      body: firstWeek
        ? `Your Strive Elite training starts now.\n\nThis week's focus: ${plan.focus}\n\n${sessionsSaid} sessions, each opening with your plyometric warm-up. Open the app and start Session 1.`
        : `Your new training week is live.\n\nThis week's focus: ${plan.focus}\n\n${sessionsSaid} sessions, plyo warm-up first. Open the app and start Session 1.`,
    }).catch(() => undefined);
    run.announced.push({ playerId, week });

    // The weekly parent report, for a membership that has one: real
    // numbers from the week that just ended, sent with the announcement.
    // Best-effort; never blocks the announcement itself.
    try {
      const recap = await buildParentRecap(playerId, week - 1);
      if (recap) {
        await sendPlayerEmail(playerId, {
          event: "parent_weekly_report",
          subject: `${recap.playerFirst}'s week ${recap.week} report`,
          body: recap.text,
        });
        await sendPlayerSMS(playerId, {
          event: "parent_weekly_report",
          message: recap.text,
        });
      }
    } catch {
      /* the report is a bonus: the week is announced either way */
    }
  }
  return run;
}
