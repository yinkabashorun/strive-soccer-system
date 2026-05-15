import { NextResponse } from "next/server";
import { pickPillar, pickGoal } from "@/lib/ai-content";
import { generateAdStrategy } from "@/lib/anthropic";
import { buildHiggsfieldPrompt } from "@/lib/higgsfield-prompt";
import { adAssetToPost, getConfig, savePost } from "@/lib/store";
import type { AdAsset, AdGoal, AdPillar } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  idea?: string;
  pillar?: AdPillar;
  goal?: AdGoal;
  platform?: AdAsset["platform"];
  /** When true (default), persist to queue. */
  persist?: boolean;
};

/**
 * POST /api/video/generate
 *
 * Writes a full ad — strategist (Claude) produces hook + script + caption +
 * CTA + video prompt + voiceover. Composes the Higgsfield Claude.ai prompt
 * block from the operator's avatar / webproduct / mode config.
 *
 * Status: `awaiting_video`. Yinka generates the video manually in Claude.ai
 * with the Higgsfield MCP, pastes the URL back via /api/posts/[id]/attach-video.
 *
 * No video is rendered server-side — Higgsfield has no public REST API.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const persist = body.persist !== false;

  try {
    const config = await getConfig();
    const { asset, source } = await generateAdStrategy({
      idea: body.idea ?? "",
      pillar: body.pillar ?? pickPillar(),
      goal: body.goal ?? pickGoal(),
      platform: body.platform ?? "TikTok",
    });

    const higgsfieldPrompt = buildHiggsfieldPrompt(
      {
        hook: asset.hook,
        voiceoverScript: asset.voiceoverScript,
        caption: asset.caption,
        pillar: asset.pillar,
        goal: asset.goal,
        videoPrompt: asset.videoPrompt,
      },
      config,
    );

    asset.status = "awaiting_video";

    if (persist) {
      const stored = adAssetToPost(asset, {
        generatedBy: "studio",
        status: "awaiting_video",
        higgsfieldPrompt,
      });
      await savePost(stored);
      return NextResponse.json({
        ok: true,
        asset,
        post: stored,
        higgsfieldPrompt,
        strategist: source,
      });
    }

    return NextResponse.json({
      ok: true,
      asset,
      higgsfieldPrompt,
      strategist: source,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "Generation failed. Check the Strategist in Settings.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "Strive Studio · script generator",
    accepts: ["POST { idea?, pillar?, goal?, platform?, persist? }"],
    note: "Generates script + Higgsfield prompt. No server-side video render — Yinka generates the video via Claude.ai with the Higgsfield MCP.",
  });
}
