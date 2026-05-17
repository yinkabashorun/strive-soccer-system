import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = [
  "New",
  "Contacted",
  "Trial Booked",
  "Converted",
  "Lost",
] as const;

type LeadStatus = (typeof ALLOWED_STATUSES)[number];

function isStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (ALLOWED_STATUSES as readonly string[]).includes(v);
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }
  try {
    const db = supabase();
    const { data, error } = await db
      .from("leads")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ lead: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch_failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const status = body?.status;
  if (!isStatus(status)) {
    return NextResponse.json(
      { error: "invalid_status", allowed: ALLOWED_STATUSES },
      { status: 400 },
    );
  }

  try {
    const db = supabase();
    const { data, error } = await db
      .from("leads")
      .update({ status })
      .eq("id", params.id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, lead: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "update_failed" },
      { status: 500 },
    );
  }
}
