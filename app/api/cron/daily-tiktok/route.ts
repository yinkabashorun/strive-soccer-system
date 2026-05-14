import { NextResponse } from "next/server";
import { pickGoal, pickPillar } from "@/lib/ai-content";
import { generateAdStrategy } from "@/lib/anthropic";
import { composeAd } from "@/lib/video-gen";
import { rememberScheduledPost, scheduleTikTokPost } from "@/lib/ghl-social";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Daily auto-poster.
 *
 * Wire this to:
 *   - Vercel Cron:  vercel.json → { "crons": [{ "path": "/api/cron/daily-tiktok", "schedule": "0 9 * * *" }] }
 *   - GHL workflow (HTTP step at a recurring time)
 *   - GitHub Actions (cron) → curl
 *   - Or just call manually from /studio
 *
 * On each invocation it:
 *   1. Picks today's pillar + goal (rotation in lib/ai-content)
 *   2. Generates an ad from the rotation (no user idea required)
 *   3. Renders Higgsfield video + ElevenLabs voiceover
 *   4. Hands the composed asset to GHL Social Planner for TikTok
 *   5. Returns the schedule confirmation
 *
 * Auth: require ?key=<CRON_SECRET> matching env. Keeps the endpoint from
 * being hammered by drive-by traffic.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const expected = process.env.CRON_SECRET;

  if (expected && key !== expected) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const now = new Date();
  const { asset } = await generateAdStrategy({
    idea: "",
    pillar: pickPillar(now),
    goal: pickGoal(now),
    platform: "TikTok",
  });

  asset.status = "rendering_video";
  const composed = await composeAd(asset);
  asset.videoUrl = composed.videoUrl;
  asset.voiceUrl = composed.voiceUrl;
  asset.posterUrl = composed.posterUrl;
  asset.durationSec = composed.durationSec;
  asset.status = "composing";

  const scheduledFor = nextMorningSlot().toISOString();
  const scheduleResult = await scheduleTikTokPost({
    caption: asset.caption,
    videoUrl: asset.videoUrl!,
    posterUrl: asset.posterUrl,
    scheduledFor,
  });

  if (!scheduleResult.ok) {
    return NextResponse.json(
      { ok: false, error: scheduleResult.error, asset },
      { status: 502 },
    );
  }

  asset.status = "scheduled";
  asset.scheduledFor = scheduledFor;
  asset.ghlPostId = scheduleResult.ghlPostId;

  rememberScheduledPost({
    id: `sch_${Date.now().toString(36)}`,
    adAssetId: asset.id,
    scheduledFor,
    platform: asset.platform,
    status: "pending",
    ghlPostId: scheduleResult.ghlPostId,
  });

  return NextResponse.json({
    ok: true,
    asset,
    scheduledFor,
    ghlPostId: scheduleResult.ghlPostId,
    mock: scheduleResult.mock ?? false,
  });
}

export async function POST(req: Request) {
  return GET(req);
}

function nextMorningSlot() {
  const now = new Date();
  const candidate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      13, // 9am ET
      0,
      0,
    ),
  );
  if (candidate.getTime() <= now.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}
