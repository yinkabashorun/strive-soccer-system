import { NextResponse } from "next/server";
import { ghlContactToLead, type GHLContactPayload } from "@/lib/ghl";

// POST /api/ghl/webhook
//
// GHL's native Webhook action (used in our workflows) sends a flat payload:
// {
//   contact_id: "...",
//   first_name: "...",
//   full_name: "...",
//   tags: "",
//   country: "US",
//   date_created: "...",
//   contact_type: "lead",
//   location: { name: "Strive Soccer", id: "...", address: "..." },
//   workflow: { id: "...", name: "Strive OS → GHL Sync" },
//   triggerData: {},
//   contact: { attributionSource: {...}, ... },
//   email?: "...",
//   phone?: "...",
// }
//
// We determine event type from the workflow name.
// We also support the custom wrapped shape: { event: "contact.created", data: {...} }

export async function GET() {
      return NextResponse.json({
              ok: true,
              endpoint: "Strive OS · GHL webhook",
              version: 3,
              acceptedShapes: ["native-ghl (contact_id + workflow.name)", "wrapped (event + data)"],
      });
}

/** Map GHL workflow names → internal event strings */
function resolveEventFromWorkflow(workflowName: string): string {
      const name = workflowName.toLowerCase();
      if (name.includes("sync") || name.includes("contact")) return "contact.created";
      if (name.includes("opportunity") || name.includes("stage")) return "opportunity.stage_changed";
      if (name.includes("payment")) return "payment.received";
      if (name.includes("appointment") || name.includes("booked")) return "appointment.booked";
      return "contact.created"; // safe default
}

/** Extract contact payload from either shape */
function extractContactPayload(body: Record<string, unknown>): GHLContactPayload {
      // Wrapped shape: { event, data: { id, firstName, ... } }
  if (body.event && body.data && typeof body.data === "object") {
          return body.data as GHLContactPayload;
  }

  // Native GHL shape: flat with contact_id, first_name, full_name, etc.
  const raw = body as Record<string, unknown>;

  // Split full_name into first/last if needed
  const fullName = (raw.full_name as string) || "";
      const nameParts = fullName.trim().split(" ");
      const inferredFirst = nameParts[0] || "";
      const inferredLast = nameParts.slice(1).join(" ") || "";

  return {
          id: (raw.contact_id as string) || (raw.id as string) || "",
          firstName: (raw.first_name as string) || inferredFirst || "",
          lastName: (raw.last_name as string) || inferredLast || "",
          email: (raw.email as string) || "",
          phone: (raw.phone as string) || "",
          tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
          dateAdded: (raw.date_created as string) || new Date().toISOString(),
          locationId: (raw.location as Record<string, unknown>)?.id as string || "",
          customFields: [],
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

  // ── Determine event type ──────────────────────────────────────────────────

  let event: string;

  if (typeof body.event === "string") {
          // Wrapped shape: { event: "contact.created", data: {...} }
        event = body.event;
  } else if (body.workflow && typeof (body.workflow as Record<string,unknown>).name === "string") {
          // Native GHL shape with workflow context
        const workflowName = (body.workflow as Record<string, unknown>).name as string;
          event = resolveEventFromWorkflow(workflowName);
          console.log(`[ghl-webhook] resolved event="${event}" from workflow="${workflowName}"`);
  } else if (body.contact_id || body.first_name || body.id) {
          // Native GHL shape without workflow — treat as contact event
        event = "contact.created";
          console.log("[ghl-webhook] no workflow name found, defaulting to contact.created");
  } else {
          console.error("[ghl-webhook] unrecognised payload shape:", JSON.stringify(body));
          return NextResponse.json({ error: "unrecognised payload" }, { status: 400 });
  }

  // ── Route by event ────────────────────────────────────────────────────────

  if (event === "contact.created" || event === "contact.updated") {
          const contactPayload = extractContactPayload(body);
          console.log("[ghl-webhook] contact payload extracted:", JSON.stringify(contactPayload));

        if (!contactPayload.id && !contactPayload.firstName) {
                  return NextResponse.json({ error: "contact has no id or name" }, { status: 400 });
        }

        try {
                  const lead = await ghlContactToLead(contactPayload);
                  console.log("[ghl-webhook] lead upserted:", JSON.stringify(lead));
                  return NextResponse.json({ ok: true, event, lead });
        } catch (err) {
                  console.error("[ghl-webhook] ghlContactToLead failed:", err);
                  return NextResponse.json({ error: "upsert failed", detail: String(err) }, { status: 500 });
        }
  }

  // Other events — acknowledge receipt
  console.log(`[ghl-webhook] event="${event}" acknowledged (no handler yet)`);
      return NextResponse.json({ ok: true, event, message: "acknowledged" });
}
