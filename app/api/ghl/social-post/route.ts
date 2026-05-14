import { NextResponse } from "next/server";
import {
  rememberScheduledPost,
  scheduleTikTokPost,
} from "@/lib/ghl-social";
import type { AdAsset } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  asset: AdAsset;
  scheduledFor?: string; // ISO; defaults to "next 9am ET"
};

/**
 * POST /api/ghl/social-post
 *
 * Hands a generated AdAsset to GHL's Social Planner for scheduling on TikTok.
 * When env vars are not set, runs in mock mode and returns a fake ghlPostId so
 * the UI flow is end-to-end testable without credentials.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.asset) {
    return NextResponse.json(
      { ok: false, error: "missing asset" },
      { status: 400 },
    );
  }

  const scheduledFor = body.scheduledFor ?? nextMorningSlot().toISOString();

  if (!body.asset.videoUrl) {
    return NextResponse.json(
      { ok: false, error: "asset has no videoUrl — run /api/video/generate first" },
      { status: 400 },
    );
  }

  const result = await scheduleTikTokPost({
    caption: body.asset.caption,
    videoUrl: body.asset.videoUrl,
    posterUrl: body.asset.posterUrl,
    scheduledFor,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  rememberScheduledPost({
    id: `sch_${Date.now().toString(36)}`,
    adAssetId: body.asset.id,
    scheduledFor,
    platform: body.asset.platform,
    status: "pending",
    ghlPostId: result.ghlPostId,
  });

  return NextResponse.json({
    ok: true,
    scheduledFor,
    ghlPostId: result.ghlPostId,
    mock: result.mock ?? false,
  });
}

function nextMorningSlot() {
  // Default to next 9:00 AM ET (UTC-4 in May = 13:00 UTC).
  const now = new Date();
  const candidate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      13,
      0,
      0,
    ),
  );
  if (candidate.getTime() <= now.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}
