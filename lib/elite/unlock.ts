// Processes due week unlocks (Monday morning VA time). Called lazily from
// app layouts on load — idempotent and cheap (indexed query, usually zero
// rows), so the app needs no cron: the first visit after Monday 6am ET
// flips the week live, fires the in-app notification, and sends the
// email/SMS event. Uses the service client so a player's own visit can
// unlock their week.

import { createServiceClient } from "./supabase/server";
import { sendPlayerEmail } from "./email";
import { buildParentRecap } from "./parent-recap";

let lastRun = 0;

export async function unlockDueWeeks(): Promise<void> {
  // Throttle: at most once a minute per server instance.
  const now = Date.now();
  if (now - lastRun < 60_000) return;
  lastRun = now;

  const admin = createServiceClient();
  if (!admin) return;

  const { data: due } = await admin
    .from("elite_weekly_plans")
    .select("id, player_id, week, focus")
    .eq("notified", false)
    .lte("unlocks_at", new Date().toISOString())
    .limit(50);
  if (!due || due.length === 0) return;

  for (const plan of due) {
    // Claim first so concurrent requests can't double-notify.
    const { data: claimed } = await admin
      .from("elite_weekly_plans")
      .update({ notified: true })
      .eq("id", plan.id)
      .eq("notified", false)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const { data: player } = await admin
      .from("elite_players")
      .select("full_name, current_week")
      .eq("id", plan.player_id)
      .maybeSingle();
    const first = player?.full_name?.split(" ")[0] ?? "";

    if (!player || plan.week > (player.current_week ?? 0)) {
      await admin
        .from("elite_players")
        .update({ current_week: plan.week, today_focus: plan.focus })
        .eq("id", plan.player_id);
    }

    await admin.from("elite_notifications").insert({
      player_id: plan.player_id,
      kind: "new_week",
      title: first ? `Week ${plan.week} is ready, ${first}` : `Week ${plan.week} is ready`,
      body: plan.focus || "Your coach set your focus for the week.",
    });

    await sendPlayerEmail(plan.player_id, {
      event: "new_week",
      subject: first ? `${first} — Week ${plan.week} is live` : `Week ${plan.week} is live`,
      body: `The new training week just unlocked.\n\nThis week's focus: ${plan.focus}\n\nFour sessions, plyo warm-up first, every time. Open the app and start Session 1.`,
    }).catch(() => undefined);

    // The weekly parent recap — real numbers from the week that just
    // ended, written by the AI (template fallback), sent alongside the
    // Monday unlock. Best-effort; never blocks the unlock itself.
    try {
      const recap = await buildParentRecap(plan.player_id, plan.week - 1);
      if (recap) {
        await sendPlayerEmail(plan.player_id, {
          event: "parent_weekly_report",
          subject: `${recap.playerFirst} — week ${recap.week} report`,
          body: recap.text,
        });
      }
    } catch {
      /* recap is a bonus — the unlock already succeeded */
    }
  }
}
