import { NextResponse } from "next/server";
import { runAutoWeeklyPlans } from "@/lib/elite/auto-plan";

export const runtime = "nodejs";
export const maxDuration = 300;

// Fully automated weekly plan generation (Vercel cron, Sunday evening VA
// time, ahead of the Monday morning unlock). Runs generatePlanFromNotes +
// applyGeneratedPlanCore for every active player with no coach in the loop -
// see lib/elite/auto-plan.ts for the notes synthesis and skip logic.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { ran, results } = await runAutoWeeklyPlans();
  return NextResponse.json({ ok: true, ran, results });
}
