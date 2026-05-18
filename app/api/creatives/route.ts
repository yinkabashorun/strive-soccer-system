import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET  /api/creatives — list newest creatives
// POST /api/creatives — save a creative
//
// Both routes are no-ops when Supabase isn't wired — returns 503 with a
// clear error, never crashes.

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ creatives: [] });
  }
  try {
    const db = supabase();
    const { data, error } = await db
      .from("creatives")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ creatives: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      {
        creatives: [],
        error: err instanceof Error ? err.message : "fetch_failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "supabase_not_configured" },
      { status: 503 },
    );
  }
  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const row = {
    title: body.title ?? null,
    audience: body.audience ?? null,
    pain_point: body.painPoint ?? body.pain_point ?? null,
    transformation: body.transformation ?? null,
    tone: body.tone ?? null,
    platform: body.platform ?? null,
    hook: body.hook ?? null,
    script: body.script ?? null,
    caption: body.caption ?? null,
    cta: body.cta ?? null,
    shot_list: body.shotList ?? body.shot_list ?? null,
    voiceover_script: body.voiceoverScript ?? body.voiceover_script ?? null,
    landing_angle: body.landingAngle ?? body.landing_angle ?? null,
    vsl_section: body.vslSection ?? body.vsl_section ?? null,
    status: body.status ?? "script_ready",
    voiceover_audio_url: body.voiceoverAudioUrl ?? null,
    fal_request_id: body.falRequestId ?? null,
    video_url: body.videoUrl ?? null,
    performance_notes: body.performanceNotes ?? null,
  };

  try {
    const db = supabase();
    const { data, error } = await db
      .from("creatives")
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ creative: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "insert_failed" },
      { status: 500 },
    );
  }
}
