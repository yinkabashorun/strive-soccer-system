import { NextResponse } from "next/server";
import { ghlContactToLead, type GHLContactPayload } from "@/lib/ghl";

// POST /api/ghl/webhook
//
// Accepts BOTH payload shapes from GoHighLevel:
//   1. Native Webhook action  → flat fields: { id, firstName, lastName, email, phone, type, ... }
//   2. Custom Webhook action  → wrapped:     { event: "contact.created", data: { ... } }
//
// GHL's native Webhook action sends the contact's fields directly at the top
// level with a `type` field indicating the event (e.g. "ContactCreate").

type GHLNativePayload = {
    type?: string;           // e.g. "ContactCreate", "OpportunityCreate"
    id?: string;
    contactId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    source?: string;
    tags?: string[];
    customFields?: Record<string, unknown>;
    // opportunity / pipeline fields
    stage?: string;
    pipelineStageId?: string;
    // payment fields
    amount?: number;
    // appointment fields
    appointmentId?: string;
    sessionId?: string;
};

type GHLWrappedPayload = {
    event: string;
    data: GHLContactPayload & {
      stage?: string;
      amount?: number;
      appointmentId?: string;
      sessionId?: string;
    };
};

function resolveEvent(body: GHLNativePayload & Partial<GHLWrappedPayload>): string | null {
    // Shape 2: already wrapped with explicit event key
  if (body.event) return body.event;

  // Shape 1: GHL native Webhook sends a `type` string
  if (body.type) {
        const t = body.type.toLowerCase();
        if (t.includes("contactcreate") || t === "contact_create") return "contact.created";
        if (t.includes("contactupdate") || t === "contact_update") return "contact.updated";
        if (t.includes("opportunitystageupdate") || t.includes("pipelinestage") || t.includes("opportunitystage")) return "opportunity.stage_changed";
        if (t.includes("opportunitycreate")) return "opportunity.stage_changed";
        if (t.includes("payment")) return "payment.received";
        if (t.includes("appointment") || t.includes("booking")) return "appointment.booked";
        // catch-all: log the type and treat as contact.created
      console.log(`[ghl-webhook] unknown type: ${body.type}`);
        return "contact.created";
  }

  // Shape 1 fallback: if it has contact-like fields, treat as contact.created
  if (body.id || body.contactId || body.firstName || body.lastName || body.email) {
        return "contact.created";
  }

  return null;
}

function resolveContactPayload(body: GHLNativePayload & Partial<GHLWrappedPayload>): GHLContactPayload {
    // Wrapped shape has data nested under `data`
  if (body.data) return body.data;
    // Native shape: fields are at top level
  return {
        id: body.id ?? body.contactId ?? "",
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        source: body.source,
        tags: body.tags,
        customFields: body.customFields,
  };
}

export async function POST(req: Request) {
    const raw = await req.json().catch(() => null);
    if (!raw) {
          return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

  // Log the raw payload so we can debug future shape mismatches
  console.log("[ghl-webhook] raw payload:", JSON.stringify(raw));

  const body = raw as GHLNativePayload & Partial<GHLWrappedPayload>;
    const event = resolveEvent(body);

  if (!event) {
        console.log("[ghl-webhook] could not resolve event from payload", JSON.stringify(body));
        return NextResponse.json({ error: "missing event" }, { status: 400 });
  }

  console.log(`[ghl-webhook] event=${event}`);

  switch (event) {
    case "contact.created":
    case "contact.updated": {
            const contactData = resolveContactPayload(body);
            const lead = ghlContactToLead(contactData);
            console.log(`[ghl-webhook] lead upserted:`, JSON.stringify(lead));
            // await supabase().from("leads").upsert(lead);
            return NextResponse.json({ ok: true, event, lead });
    }
    case "opportunity.stage_changed": {
            const stage = body.data?.stage ?? body.stage ?? body.pipelineStageId ?? "unknown";
            console.log(`[ghl-webhook] opportunity stage changed: ${stage}`);
            // await supabase().from("leads").update({ status: mapStageToStatus(stage) }).eq("id", body.id);
            return NextResponse.json({ ok: true, event, stage });
    }
    case "payment.received": {
            const amount = body.data?.amount ?? body.amount ?? 0;
            console.log(`[ghl-webhook] payment received: $${amount}`);
            // await supabase().from("players").update({ payment_status: "Paid" }).eq("ghl_contact_id", body.id);
            return NextResponse.json({ ok: true, event, amount });
    }
    case "appointment.booked": {
            console.log(`[ghl-webhook] appointment booked`);
            // await supabase().from("session_attendance").insert({ ... });
            return NextResponse.json({ ok: true, event });
    }
    default:
            console.log(`[ghl-webhook] unhandled event: ${event}`);
            return NextResponse.json({ ok: false, ignored: event }, { status: 200 });
  }
}

export async function GET() {
    return NextResponse.json({
          ok: true,
          endpoint: "Strive OS · GHL webhook",
          accepts: [
                  "contact.created",
                  "contact.updated",
                  "opportunity.stage_changed",
                  "payment.received",
                  "appointment.booked",
                ],
    });
}
