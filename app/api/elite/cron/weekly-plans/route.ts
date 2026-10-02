import { NextResponse } from "next/server";
import { runPlanBuilder } from "@/lib/elite/auto-plan";
import { backfillHomeworkVideos } from "@/lib/elite/data";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { unlockDueWeeks } from "@/lib/elite/unlock";
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
//   Every hour            - unlock Monday-held weeks that are due (so the
//                           Monday 6am ET unlock + texts no longer depend
//                           on someone opening the app), then heal any
//                           homework whose drill got its video later.
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

  if (isSundayEveNY() && nyHour() < 15) {
    return NextResponse.json({ ok: true, skipped: "sunday before 3pm ET" });
  }

  const outcome = await runPlanBuilder({ trigger: "cron", authed });

  // Best-effort: heal any homework stuck without a video because it was
  // published before its drill had one in the bank. Never blocks the
  // week's own publish result.
  let videosFixed = 0;
  try {
    const admin = createServiceClient();
    if (admin) {
      videosFixed = await backfillHomeworkVideos(admin);
      // Keep the run log to two months.
      await admin
        .from("elite_cron_runs")
        .delete()
        .lt("ran_at", new Date(Date.now() - 60 * 864e5).toISOString());
    }
  } catch {
    /* next run tries again */
  }

  return NextResponse.json({ ok: true, ...outcome, videosFixed });
}
