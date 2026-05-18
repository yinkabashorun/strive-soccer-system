import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = [
  "idea",
  "script_ready",
  "voiceover_ready",
  "video_ready",
  "published",
  "winner",
  "loser",
] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function isStatus(v: unknown): v is AllowedStatus {
  return (
    typeof v === "string" && (ALLOWED_STATUSES as readonly string[]).includes(v)
  );
}

// PATCH /api/creatives/[id]
// Body: any subset of { status, performance_notes, voiceover_audio_url,
//                       fal_request_id, video_url, ghl_post_id, title }
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "supabase_not_configured" },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("status" in body) {
    if (!isStatus(body.status)) {
      return NextResponse.json(
        { error: "invalid_status", allowed: ALLOWED_STATUSES },
        { status: 400 },
      );
    }
    update.status = body.status;
  }
  for (const k of [
    "performance_notes",
    "voiceover_audio_url",
    "fal_request_id",
    "video_url",
    "ghl_post_id",
    "title",
  ]) {
    if (k in body) update[k] = body[k];
  }

  try {
    const db = supabase();
    const { data, error } = await db
      .from("creatives")
      .update(update)
      .eq("id", params.id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ creative: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "update_failed" },
      { status: 500 },
    );
  }
}

// DELETE /api/creatives/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "supabase_not_configured" },
      { status: 503 },
    );
  }
  try {
    const db = supabase();
    const { error } = await db.from("creatives").delete().eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete_failed" },
      { status: 500 },
    );
  }
}
