import { NextResponse } from "next/server";
import { runPlanBuilder } from "@/lib/elite/auto-plan";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { unlockDueWeeks } from "@/lib/elite/unlock";
import { sendTrainingReminders } from "@/lib/elite/reminders-server";
import { runClubMatchups } from "@/lib/elite/club-matchups-server";
import { endDuePasses } from "@/lib/elite/squad-pass-server";
import { isSundayEveNY, nyHour } from "@/lib/elite/time";

export const runtime = "nodejs";
export const maxDuration = 300;
// Never let Next prerender this at build time: a GET route handler with no
// dynamic access gets built ONCE and served from cache forever after -
// which here would mean the cron fires every hour and gets a frozen JSON
// body back without a single line of this file running. Whether the
// handler touched request headers used to depend on CRON_SECRET being set,
// so the route was only dynamic by accident. Now it's dynamic on purpose.
export const dynamic = "force-dynamic";
// force-dynamic alone does NOT stop Next caching this route's database
// reads (see lib/elite/supabase/fresh-fetch.ts). This does, for every
// fetch the route makes, whichever client makes it.
export const fetchCache = "force-no-store";

// The plan builder's heartbeat (Vercel cron, EVERY HOUR - vercel.json).
// What each hour does is decided here in NY time, not by the schedule:
//
//   Sunday before 3pm ET  - nothing. The week isn't over; building next
//                           week now would miss today's sessions/check-in.
//   Sunday 3pm ET onward  - build every player's NEXT week (Monday hold).
//   Mon-Sat, every hour   - catch-up only: anyone whose live week has no
//                           plan gets it now. Otherwise a no-op that still
//                           logs a row, which is how the dashboard knows
//                           the cron is alive at all.
//   Mon-Sat, every hour   - the reminder at a member's usual time: one
//                           push a day at most, only at their hour, never
//                           on a break, once the week is done or if they
//                           trained today (lib/elite/reminders.ts, 078).
//   Every hour            - open the weeks that are due (early Monday,
//                           New York) and, from 4:00 PM, announce them
//                           (lib/elite/unlock.ts; nobody is texted about a
//                           new week); then heal any
//                           homework whose drill got its video later and
//                           AUDIT every live week (lib/elite/health.ts),
//                           texting the coach about anything new.
//   Every hour, LAST      - the weekly club matchup (083): decide the
//                           matchups of weeks that have ended, and on
//                           Monday match the clubs for the new week. Its
//                           own step, after everything else, inside its own
//                           catch: it can never stop or slow the plan
//                           builder, and running it twice changes nothing
//                           (lib/elite/club-matchups-server.ts).
//
// Hourly + an NY-hour check makes this DST-proof: no twice-a-year
// schedule flip, the 3pm Sunday slot is 3pm in Virginia year-round.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
  if (secret && !authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Monday-held weeks whose time has come go live first, so a catch-up
  // decision below sees the real state.
  await unlockDueWeeks().catch(() => undefined);

  // The reminder at each member's usual time (claimed per player per day,
  // so a second run this hour sends nothing). Never on a Sunday.
  const reminders = await sendTrainingReminders().catch(() => ({ checked: 0, sent: 0, paused: 0 }));

  // Earned months of Strive Pro whose time is up are closed (086): the
  // account is a free account again, nothing of its own is lost.
  await endDuePasses().catch(() => ({ ended: 0 }));

  // The weekly club matchup: its own step, run last, never throwing.
  const clubMatchups = () => runClubMatchups({ authed }).catch(() => ({ status: "failed" as const }));

  if (isSundayEveNY() && nyHour() < 15) {
    return NextResponse.json({ ok: true, skipped: "sunday before 3pm ET", reminders, matchups: await clubMatchups() });
  }

  const outcome = await runPlanBuilder({ trigger: "cron", authed });

  // Keep the run log to two months. Best-effort.
  try {
    const admin = createServiceClient();
    if (admin) {
      await admin
        .from("elite_cron_runs")
        .delete()
        .lt("ran_at", new Date(Date.now() - 60 * 864e5).toISOString());
      // The sent-text ledger (066) only has to remember today.
      await admin
        .from("elite_sms_sends")
        .delete()
        .lt("sent_at", new Date(Date.now() - 60 * 864e5).toISOString());
      // The reminder ledger (078) only has to remember today.
      await admin
        .from("elite_training_reminders")
        .delete()
        .lt("sent_at", new Date(Date.now() - 60 * 864e5).toISOString());
    }
  } catch {
    /* next run tries again */
  }

  return NextResponse.json({ ok: true, ...outcome, reminders, matchups: await clubMatchups() });
}
