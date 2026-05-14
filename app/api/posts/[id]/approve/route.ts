import { NextResponse } from "next/server";
import { getPost, updatePost } from "@/lib/store";
import { scheduleTikTokPost } from "@/lib/ghl-social";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { scheduledFor?: string };

/**
 * POST /api/posts/[id]/approve
 * Body: { scheduledFor?: ISO }
 *
 * Approves a post: pushes to GHL Social Planner, marks scheduled.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const post = await getPost(params.id);
  if (!post) {
    return NextResponse.json({ ok: false, error: "Post not found" }, { status: 404 });
  }

  if (!post.videoUrl) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Post has no video yet — wait for rendering to finish or regenerate.",
      },
      { status: 400 },
    );
  }

  const scheduledFor = body.scheduledFor ?? post.scheduledFor ?? nextSlot();

  const result = await scheduleTikTokPost({
    caption: post.caption,
    videoUrl: post.videoUrl,
    posterUrl: post.posterUrl ?? undefined,
    scheduledFor,
  });

  if (!result.ok) {
    await updatePost(post.id, { status: "failed" });
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? "GHL schedule failed",
        statusCode: result.statusCode,
      },
      { status: 502 },
    );
  }

  const updated = await updatePost(post.id, {
    status: "scheduled",
    scheduledFor,
    ghlPostId: result.ghlPostId ?? null,
  });

  return NextResponse.json({
    ok: true,
    post: updated,
    mock: result.mock ?? false,
  });
}

function nextSlot() {
  const now = new Date();
  const c = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      13, // 9am ET
      0,
      0,
    ),
  );
  if (c.getTime() <= now.getTime()) c.setUTCDate(c.getUTCDate() + 1);
  return c.toISOString();
}
