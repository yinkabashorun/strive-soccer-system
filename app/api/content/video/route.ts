import { NextResponse } from "next/server";
import { isFalConfigured, startUGCVideo } from "@/lib/fal";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/content/video
// Body: { script: string, style?: string }
// Returns: { requestId, status, configured }

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const script = typeof body?.script === "string" ? body.script.trim() : "";
  const style = typeof body?.style === "string" ? body.style : undefined;

  if (!script) {
    return NextResponse.json({ error: "script_required" }, { status: 400 });
  }

  try {
    const job = await startUGCVideo({
      prompt: script,
      creatorStyle: style,
      durationSec: 5,
    });
    return NextResponse.json({
      requestId: job.id,
      status: job.status,
      configured: isFalConfigured(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "video_failed" },
      { status: 500 },
    );
  }
}
