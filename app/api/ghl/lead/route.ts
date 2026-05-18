import { NextResponse } from "next/server";
import {
  TAG_LEAD,
  isGHLLeadConfigured,
  upsertGHLContact,
} from "@/lib/ghl-lead";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/ghl/lead
// Body: { email, name?, phone?, source?, extraTags?: string[] }
//
// Push a new course lead into GHL with the "Dribbling Course Lead" tag.
// Also writes a lead_events row so the Command Center analytics catch it.

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  if (!email && !phone) {
    return NextResponse.json(
      { error: "email_or_phone_required" },
      { status: 400 },
    );
  }
  const name = typeof body?.name === "string" ? body.name : undefined;
  const source = typeof body?.source === "string" ? body.source : "Strive OS";
  const extraTags = Array.isArray(body?.extraTags)
    ? body.extraTags.filter((t: unknown): t is string => typeof t === "string")
    : [];
  const tags = [TAG_LEAD, ...extraTags];

  if (!isGHLLeadConfigured()) {
    // Even without GHL, log the lead locally so it isn't lost.
    if (isSupabaseConfigured()) {
      try {
        const db = supabase();
        await db.from("lead_events").insert({
          event_type: "lead_captured",
          email: email || null,
          name: name ?? null,
          source,
          metadata: { phone: phone || null, tags, ghl: "not_configured" },
        });
      } catch {
        // best effort
      }
    }
    return NextResponse.json(
      {
        ok: false,
        error: "ghl_not_configured",
        captured_locally: isSupabaseConfigured(),
      },
      { status: 503 },
    );
  }

  const r = await upsertGHLContact({
    email: email || undefined,
    phone: phone || undefined,
    name,
    source,
    tags,
  });

  if (!r.ok) {
    if (isSupabaseConfigured()) {
      try {
        const db = supabase();
        await db.from("integration_logs").insert({
          service: "ghl",
          event: "lead.upsert_failed",
          status: "error",
          detail: r.error,
        });
      } catch {
        // best effort
      }
    }
    return NextResponse.json(
      { ok: false, error: r.error },
      { status: r.status },
    );
  }

  if (isSupabaseConfigured()) {
    try {
      const db = supabase();
      await db.from("lead_events").insert({
        event_type: "lead_captured",
        email: email || null,
        name: name ?? null,
        source,
        ghl_contact_id: r.contactId ?? null,
        metadata: { tags },
      });
      await db.from("integration_logs").insert({
        service: "ghl",
        event: "lead.captured",
        status: "ok",
        detail: `${email || phone} · tags=${tags.join(",")}`,
        metadata: { contactId: r.contactId },
      });
    } catch {
      // best effort
    }
  }

  return NextResponse.json({ ok: true, contactId: r.contactId, tags });
}
