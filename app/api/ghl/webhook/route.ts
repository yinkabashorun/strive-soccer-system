import { NextResponse } from "next/server";
import { ghlContactToLead, type GHLContactPayload } from "@/lib/ghl";

// POST /api/ghl/webhook
//
// GHL native Webhook action sends a flat payload with NO "type" field:
// { contact_id, first_name, full_name, tags, country, date_created,
//   contact_type, location:{...}, workflow:{id, name}, triggerData:{},
//   contact:{...}, email?, phone? }
//
// We detect the event from workflow.name, then map contact fields
// to GHLContactPayload { id, firstName?, lastName?, email?, phone?, tags? }

export async function GET() {
        return NextResponse.json({
                  ok: true,
                  endpoint: "Strive OS GHL webhook",
                  version: 4,
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

export async function POST(req: Request) {
        let body: Record<string, unknown>;
        try {
                  body = await req.json();
        } catch {
                  return NextResponse.json({ error: "invalid json" }, { status: 400 });
        }

  console.log("[ghl-webhook] raw payload:", JSON.stringify(body));

  const event = resolveEvent(body);
        console.log("[ghl-webhook] event:", event);

  if (!event) {
            console.error("[ghl-webhook] unrecognised payload");
            return NextResponse.json({ error: "unrecognised payload" }, { status: 400 });
  }

  if (event === "contact.created" || event === "contact.updated") {
            const contact = extractContact(body);
            console.log("[ghl-webhook] contact:", JSON.stringify(contact));
            if (!contact.id && !contact.firstName) {
                        return NextResponse.json({ error: "no contact id or name" }, { status: 400 });
            }
            try {
                        const lead = await ghlContactToLead(contact);
                        console.log("[ghl-webhook] lead upserted:", JSON.stringify(lead));
                        return NextResponse.json({ ok: true, event, lead });
            } catch (err) {
                        console.error("[ghl-webhook] upsert failed:", err);
                        return NextResponse.json({ error: "upsert failed", detail: String(err) }, { status: 500 });
            }
  }

  console.log("[ghl-webhook] acknowledged event:", event);
        return NextResponse.json({ ok: true, event, message: "acknowledged" });
}
