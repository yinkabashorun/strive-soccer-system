import { NextResponse } from "next/server";
import { pickPillar, pickGoal } from "@/lib/ai-content";
import { generateAdStrategy } from "@/lib/anthropic";
import { composeAd } from "@/lib/video-gen";
import { adAssetToPost, savePost } from "@/lib/store";
import type { AdAsset, AdGoal, AdPillar } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  idea?: string;
  pillar?: AdPillar;
  goal?: AdGoal;
  platform?: AdAsset["platform"];
  /** When true, persist to queue as awaiting_approval. Default true. */
  persist?: boolean;
};

/**
 * POST /api/video/generate
 *
 * Generates a full ad: strategist (Claude) → video (Higgsfield) → voice
 * (ElevenLabs) → compose. By default the result is persisted to the queue
 * as `awaiting_approval` so Yinka can review before scheduling.
 *
 * Set `persist: false` to get a transient preview without writing.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const persist = body.persist !== false;

  try {
    const { asset, source } = await generateAdStrategy({
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

    if (persist) {
      const stored = adAssetToPost(asset, {
        generatedBy: "studio",
        status: "awaiting_approval",
      });
      await savePost(stored);
      return NextResponse.json({
        ok: true,
        asset,
        post: stored,
        strategist: source,
      });
    }

    return NextResponse.json({ ok: true, asset, strategist: source });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Generation failed",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "Strive Studio · video generator",
    accepts: ["POST { idea?, pillar?, goal?, platform?, persist? }"],
  });
}
