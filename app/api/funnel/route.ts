import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SLUG = "dribbling-course";

const FIELDS = [
  "product_name",
  "vsl_url",
  "checkout_url",
  "offer_price_cents",
  "currency",
  "lead_magnet_url",
  "top_cta",
  "current_offer",
  "main_promise",
  "objections_handled",
  "testimonials",
  "conversion_notes",
] as const;

// GET  /api/funnel?slug=dribbling-course — read funnel settings
// PUT  /api/funnel — upsert funnel settings (body includes slug)

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug") ?? DEFAULT_SLUG;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ funnel: null, error: "supabase_not_configured" });
  }
  try {
    const db = supabase();
    const { data, error } = await db
      .from("funnel_settings")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ funnel: data });
  } catch (err) {
    return NextResponse.json(
      { funnel: null, error: err instanceof Error ? err.message : "fetch_failed" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "supabase_not_configured" },
      { status: 503 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const slug = typeof body?.slug === "string" && body.slug ? body.slug : DEFAULT_SLUG;
  const update: Record<string, unknown> = {
    slug,
    updated_at: new Date().toISOString(),
  };
  for (const f of FIELDS) {
    if (f in body) update[f] = body[f];
  }

  try {
    const db = supabase();
    const { data, error } = await db
      .from("funnel_settings")
      .upsert(update, { onConflict: "slug" })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ funnel: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "save_failed" },
      { status: 500 },
    );
  }
}
