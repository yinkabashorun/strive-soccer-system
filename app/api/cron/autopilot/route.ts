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

// GET — called by Vercel cron (requires CRON_SECRET)
// POST — called by the dashboard "Run autopilot now" button (no auth needed)

function authorizeGet(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get("x-strive-autopilot") === secret) return true;
  return false;
}

async function run(count: number) {
  if (getAutopilotState().inFlight) {
    return NextResponse.json(
      { ok: false, error: "autopilot_already_running", state: getAutopilotState() },
      { status: 409 },
    );
  }
  markAutopilotStart();
  try {
    // runAutopilot now waits for each video render (up to ~240s of the
    // 300s function budget) so every GHL post gets its media attached.
    const result = await runAutopilot({ count });
    markAutopilotFinish(result);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "autopilot_failed";
    console.error("[autopilot] run failed:", msg);
    markAutopilotError();
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// GET — Vercel cron (full 14-post weekly run)
export async function GET(req: Request) {
  if (!authorizeGet(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return run(14);
}

// POST — dashboard button (3 posts by default, fast & cheap test)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  // Default to 3 for the manual button (faster, cheaper) — cron uses GET with 14
  const count = Math.min(Math.max(parseInt(body?.count ?? "3", 10) || 3, 1), 14);
  return run(count);
    }
