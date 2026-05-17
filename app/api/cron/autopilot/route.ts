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

// Cron entrypoint. Vercel hits GET on the schedule defined in vercel.json.
// The dashboard button POSTs — no auth required for POST (it's your own UI).
// GET is protected by CRON_SECRET so only Vercel's scheduler can call it.

function authorizeGet(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return true; // open in dev / if secret not set
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

// GET — called by Vercel cron (requires CRON_SECRET)
export async function GET(req: Request) {
    if (!authorizeGet(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return run(14, true);
}

// POST — called by the dashboard "Run autopilot now" button (no auth needed)
export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const count = Math.min(Math.max(parseInt(body?.count ?? "14", 10) || 14, 1), 28);
    const waitForVideos = body?.waitForVideos !== false;
    return run(count, waitForVideos);
}
