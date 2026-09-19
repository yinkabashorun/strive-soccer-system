import { NextResponse } from "next/server";
import { runAutoWeeklyPlans } from "@/lib/elite/auto-plan";

export const runtime = "nodejs";
export const maxDuration = 300;

// Fully automated weekly plan generation (Vercel cron, Sunday 3pm ET). Runs
// generatePlanFromNotes + applyGeneratedPlanCore for every active player
// with no coach in the loop, and the new week publishes immediately rather
// than waiting for Monday - see lib/elite/auto-plan.ts for the notes
// synthesis and skip logic.
//
// Schedule note: vercel.json fires this at a fixed UTC hour (19:00), which
// is 3pm during Eastern Daylight Time. When DST ends (~first Sunday of
// November) that becomes 2pm ET until the cron is bumped to 20:00 UTC -
// Vercel cron has no timezone support, so this is a manual flip twice a
// year, same limitation the existing digest cron already has.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { ran, results } = await runAutoWeeklyPlans();
  return NextResponse.json({ ok: true, ran, results });
}
