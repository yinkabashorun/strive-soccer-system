import { NextResponse } from "next/server";
import { runAutopilot } from "@/lib/autopilot";
import {
  getAutopilotState,
  markAutopilotError,
  markAutopilotFinish,
  markAutopilotStart,
} from "@/lib/autopilot-state";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Cron entrypoint. Vercel will hit GET on the schedule defined in vercel.json.
// Locally / programmatically you can POST with { count, waitForVideos }.
//
// Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
// set on the project. We accept that header or the `x-strive-autopilot` header
// for manual triggers.

function authorize(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // open in dev
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get("x-strive-autopilot") === secret) return true;
  return false;
}

async function run(count: number, waitForVideos: boolean) {
  if (getAutopilotState().inFlight) {
    return NextResponse.json(
      { ok: false, error: "autopilot_already_running", state: getAutopilotState() },
      { status: 409 },
    );
  }
  markAutopilotStart();
  try {
    const result = await runAutopilot({ count, waitForVideos });
    markAutopilotFinish(result);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    markAutopilotError();
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "autopilot_failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return run(14, true);
}

export async function POST(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const count = Math.min(Math.max(parseInt(body?.count ?? "14", 10) || 14, 1), 28);
  const waitForVideos = body?.waitForVideos !== false;
  return run(count, waitForVideos);
}
