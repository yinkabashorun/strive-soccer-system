import { NextResponse } from "next/server";
import { listPosts, type PostStatus } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/posts?status=awaiting_approval,scheduled&from=ISO&to=ISO&limit=N
 *
 * Lists posts in the queue. Used by the /queue page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const status = statusParam
    ? (statusParam.split(",").map((s) => s.trim()) as PostStatus[])
    : undefined;

  try {
    const posts = await listPosts({ status, from, to, limit });
    return NextResponse.json({ ok: true, posts });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
