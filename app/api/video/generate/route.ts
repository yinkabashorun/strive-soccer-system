import { NextResponse } from "next/server";
import { synthesizeAd, pickPillar, pickGoal } from "@/lib/ai-content";
import { composeAd } from "@/lib/video-gen";
import type { AdAsset, AdGoal, AdPillar } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  idea?: string;
  pillar?: AdPillar;
  goal?: AdGoal;
  platform?: AdAsset["platform"];
};

/**
 * POST /api/video/generate
 *
 * Body: { idea?, pillar?, goal?, platform? }
 *
 * Returns a fully composed AdAsset (with mock video + voice URLs until
 * Higgsfield / ElevenLabs keys are wired).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  const asset = synthesizeAd({
    idea: body.idea ?? "",
    pillar: body.pillar ?? pickPillar(),
    goal: body.goal ?? pickGoal(),
    platform: body.platform ?? "TikTok",
  });

  asset.status = "rendering_video";
  const composed = await composeAd(asset);

  asset.videoUrl = composed.videoUrl;
  asset.voiceUrl = composed.voiceUrl;
  asset.posterUrl = composed.posterUrl;
  asset.durationSec = composed.durationSec;
  asset.status = "ready";

  return NextResponse.json({ ok: true, asset });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "Strive Studio · video generator",
    accepts: ["POST { idea?, pillar?, goal?, platform? }"],
  });
}
