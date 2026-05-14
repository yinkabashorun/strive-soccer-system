import { NextResponse } from "next/server";
import { adAssetToPost, getPost, savePost, updatePost } from "@/lib/store";
import { generateAdStrategy } from "@/lib/anthropic";
import { composeAd } from "@/lib/video-gen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { keepIdea?: boolean };

/**
 * POST /api/posts/[id]/regenerate
 *
 * Re-runs the strategist + renderers on the same idea/pillar/goal. The
 * original row is marked rejected with reason "regenerated" so we keep the
 * audit trail; a fresh row is inserted in awaiting_approval.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const original = await getPost(params.id);
  if (!original) {
    return NextResponse.json({ ok: false, error: "Post not found" }, { status: 404 });
  }

  // Mark original as superseded
  await updatePost(original.id, {
    status: "rejected",
    rejectReason: "Superseded by regenerate",
  });

  try {
    const { asset, source } = await generateAdStrategy({
      idea: body.keepIdea === false ? "" : original.idea ?? "",
      pillar: original.pillar,
      goal: original.goal,
      platform: original.platform,
    });

    asset.status = "rendering_video";
    const composed = await composeAd(asset);
    asset.videoUrl = composed.videoUrl;
    asset.voiceUrl = composed.voiceUrl;
    asset.posterUrl = composed.posterUrl;
    asset.durationSec = composed.durationSec;
    asset.status = "ready";

    const stored = adAssetToPost(asset, {
      generatedBy: "regenerate",
      status: "awaiting_approval",
    });
    await savePost(stored);

    return NextResponse.json({ ok: true, post: stored, strategist: source });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
