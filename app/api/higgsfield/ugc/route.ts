import { NextResponse } from "next/server";
import { isHiggsfieldConfigured, pollUGCVideo, startUGCVideo } from "@/lib/higgsfield";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/higgsfield/ugc
// Body: { pitch, pillar, creatorStyle?, durationSec?, audioDataUri? }
// Returns: HiggsfieldJob

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body?.pitch || !body?.pillar) {
    return NextResponse.json({ error: "pitch_and_pillar_required" }, { status: 400 });
  }
  try {
    const job = await startUGCVideo({
      pitch: String(body.pitch),
      pillar: String(body.pillar),
      creatorStyle: body.creatorStyle,
      durationSec: body.durationSec ?? 30,
      audioDataUri: body.audioDataUri,
      productUrl: process.env.NEXT_PUBLIC_COURSE_URL,
    });
    return NextResponse.json({ ...job, configured: isHiggsfieldConfigured() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "higgsfield_failed" },
      { status: 500 },
    );
  }
}

// GET /api/higgsfield/ugc?id=...
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
