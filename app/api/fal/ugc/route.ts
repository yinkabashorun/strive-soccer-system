import { NextResponse } from "next/server";
import { isFalConfigured, pollUGCVideo, startUGCVideo } from "@/lib/fal";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/fal/ugc
// Body: { prompt?, pillar?, durationSec? } — also accepts the legacy
// { pitch, creatorStyle } fields for backward compatibility.
// Returns a Fal job. Poll with GET /api/fal/ugc?id=<request_id>.

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  try {
    const job = await startUGCVideo({
      prompt: body?.prompt,
      pillar: body?.pillar,
      durationSec: body?.durationSec ?? 5,
      pitch: body?.pitch,
      creatorStyle: body?.creatorStyle,
      audioDataUri: body?.audioDataUri,
      productUrl: process.env.NEXT_PUBLIC_COURSE_URL,
    });
    return NextResponse.json({ ...job, configured: isFalConfigured() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fal_failed" },
      { status: 500 },
    );
  }
}

// GET /api/fal/ugc?id=...
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  try {
    const job = await pollUGCVideo(id);
    return NextResponse.json(job);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "poll_failed" },
      { status: 500 },
    );
  }
}
