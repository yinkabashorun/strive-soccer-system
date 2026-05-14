import { NextResponse } from "next/server";
import { getPost, updatePost } from "@/lib/store";
import { cancelScheduledPost } from "@/lib/ghl-social";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = { reason?: string };

/**
 * POST /api/posts/[id]/reject
 * Body: { reason?: string }
 *
 * Rejects a post. If it was already scheduled in GHL, also cancels there.
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

  if (post.ghlPostId) {
    await cancelScheduledPost(post.ghlPostId).catch(() => false);
  }

  const updated = await updatePost(post.id, {
    status: "rejected",
    rejectReason: body.reason ?? "Manually rejected",
    scheduledFor: null,
    ghlPostId: null,
  });

  return NextResponse.json({ ok: true, post: updated });
}
