import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ghlContactToLead, type GHLContactPayload } from "@/lib/ghl";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// POST /api/ghl/webhook
//
// GHL native Webhook action sends a flat payload with NO "type" field:
// { contact_id, first_name, full_name, tags, country, date_created,
//   contact_type, location:{...}, workflow:{id, name}, triggerData:{},
//   contact:{...}, email?, phone? }
//
// We detect the event from workflow.name, then map contact fields
// to GHLContactPayload { id, firstName?, lastName?, email?, phone?, tags? }
//
// Security:
// - If GHL_WEBHOOK_SECRET is set, we verify x-ghl-signature as an
//   HMAC-SHA256 over the raw request body (constant-time compare).
// - If GHL_WEBHOOK_SECRET is NOT set, we log a warning and accept the
//   request — this keeps local/dev flows working until you wire the secret.
//
// Activity:
// - Every POST writes a row to ghl_sync_log (ok or error). Log inserts are
//   best-effort — they never block the webhook response.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "Strive OS GHL webhook",
    version: 5,
  });
}

function resolveEvent(body: Record<string, unknown>): string {
  if (typeof body.event === "string") return body.event;
  const wf = body.workflow as Record<string, unknown> | undefined;
  if (wf && typeof wf.name === "string") {
    const n = wf.name.toLowerCase();
    if (n.includes("opportunity") || n.includes("stage")) return "opportunity.stage_changed";
    if (n.includes("payment")) return "payment.received";
    if (n.includes("appointment") || n.includes("booked")) return "appointment.booked";
    return "contact.created";
  }
  if (body.contact_id || body.first_name || body.id) return "contact.created";
  return "";
}

function extractContact(body: Record<string, unknown>): GHLContactPayload {
  if (body.event && body.data && typeof body.data === "object") {
    return body.data as GHLContactPayload;
  }
  const fullName = String(body.full_name ?? "").trim();
  const parts = fullName.split(" ");
  const tags: string[] = Array.isArray(body.tags)
    ? (body.tags as string[])
    : typeof body.tags === "string" && body.tags
    ? [body.tags]
    : [];
  return {
    id: String(body.contact_id ?? body.id ?? ""),
    firstName: String(body.first_name ?? parts[0] ?? ""),
    lastName: String(body.last_name ?? parts.slice(1).join(" ") ?? ""),
    email: typeof body.email === "string" ? body.email : undefined,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    tags,
  };
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[ghl-webhook] WARNING: no webhook secret set, skipping signature check");
    return true;
  }
  if (!signature) return false;

  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedB64 = createHmac("sha256", secret).update(rawBody).digest("base64");

  const cleaned = signature.replace(/^sha256=/i, "").trim();

  for (const expected of [expectedHex, expectedB64]) {
    if (cleaned.length !== expected.length) continue;
    try {
      const a = Buffer.from(cleaned);
      const b = Buffer.from(expected);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {
      // fall through
    }
  }
  return false;
}

async function logActivity(entry: {
  event: string;
  contact_id?: string | null;
  name?: string | null;
  status: "ok" | "error";
  detail?: string | null;
}) {
  if (!isSupabaseConfigured()) return;
  try {
    const db = supabase();
    await db.from("ghl_sync_log").insert({
      event: entry.event || null,
      contact_id: entry.contact_id ?? null,
      name: entry.name ?? null,
      status: entry.status,
      detail: entry.detail ?? null,
    });
  } catch (err) {
    // Logging must never break the webhook response.
    console.error("[ghl-webhook] log insert failed:", err);
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-ghl-signature");

  if (!verifySignature(rawBody, signature)) {
    console.error("[ghl-webhook] signature verification failed");
    await logActivity({
      event: "signature.invalid",
      status: "error",
      detail: "x-ghl-signature did not match GHL_WEBHOOK_SECRET",
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    await logActivity({ event: "parse.error", status: "error", detail: "invalid json" });
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  console.log("[ghl-webhook] raw payload:", JSON.stringify(body));

  const event = resolveEvent(body);
  console.log("[ghl-webhook] event:", event);

  if (!event) {
    console.error("[ghl-webhook] unrecognised payload");
    await logActivity({
      event: "unknown",
      status: "error",
      detail: "unrecognised payload shape",
    });
    return NextResponse.json({ error: "unrecognised payload" }, { status: 400 });
  }

  if (event === "contact.created" || event === "contact.updated") {
    const contact = extractContact(body);
    console.log("[ghl-webhook] contact:", JSON.stringify(contact));
    if (!contact.id && !contact.firstName) {
      await logActivity({
        event,
        contact_id: contact.id || null,
        status: "error",
        detail: "no contact id or name",
      });
      return NextResponse.json({ error: "no contact id or name" }, { status: 400 });
    }
    const lead = ghlContactToLead(contact);
    try {
      const db = supabase();
      const { error: dbErr } = await db.from("leads").upsert(
        {
          ghl_contact_id: contact.id || null,
          name: lead.name,
          first_name: contact.firstName ?? null,
          last_name: contact.lastName ?? null,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          source: lead.source,
          interest: lead.interest,
          status: lead.status,
          tags: contact.tags ?? [],
        },
        { onConflict: "ghl_contact_id", ignoreDuplicates: false },
      );
      if (dbErr) {
        console.error("[ghl-webhook] db error:", dbErr);
        await logActivity({
          event,
          contact_id: contact.id || null,
          name: lead.name,
          status: "error",
          detail: `db error: ${dbErr.message}`,
        });
        return NextResponse.json(
          { error: "db error", detail: dbErr.message },
          { status: 500 },
        );
      }
      console.log("[ghl-webhook] saved:", lead.name);
      await logActivity({
        event,
        contact_id: contact.id || null,
        name: lead.name,
        status: "ok",
        detail: `saved ${lead.name}`,
      });
      return NextResponse.json({ ok: true, event, name: lead.name });
    } catch (err) {
      console.error("[ghl-webhook] error:", err);
      await logActivity({
        event,
        contact_id: contact.id || null,
        name: lead.name,
        status: "error",
        detail: String(err).slice(0, 500),
      });
      return NextResponse.json(
        { error: "unexpected error", detail: String(err) },
        { status: 500 },
      );
    }
  }

  console.log("[ghl-webhook] acknowledged event:", event);
  await logActivity({
    event,
    status: "ok",
    detail: "acknowledged (no-op event)",
  });
  return NextResponse.json({ ok: true, event, message: "acknowledged" });
}
