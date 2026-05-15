import { NextResponse } from "next/server";
import { getPost, updatePost } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  videoUrl: string;
  posterUrl?: string;
  voiceUrl?: string;
  durationSec?: number;
};

/**
 * POST /api/posts/[id]/attach-video
 *
 * Yinka pastes the cloudfront video URL Claude returned. We attach it and
 * flip the post to `awaiting_approval` so the queue UI shows the approve
 * button.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.videoUrl || typeof body.videoUrl !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing videoUrl in body." },
      { status: 400 },
    );
  }

  if (!/^https?:\/\//i.test(body.videoUrl)) {
    return NextResponse.json(
      { ok: false, error: "videoUrl must be a full https URL." },
      { status: 400 },
    );
  }

  const post = await getPost(params.id);
  if (!post) {
    return NextResponse.json(
      { ok: false, error: "Post not found." },
      { status: 404 },
    );
  }

  const updated = await updatePost(post.id, {
    videoUrl: body.videoUrl,
    posterUrl: body.posterUrl ?? post.posterUrl ?? body.videoUrl,
    voiceUrl: body.voiceUrl ?? post.voiceUrl ?? null,
    durationSec: body.durationSec ?? post.durationSec,
    status: "awaiting_approval",
  });

  return NextResponse.json({ ok: true, post: updated });
}
