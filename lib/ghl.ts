// GoHighLevel integration surface.
//
// Strive OS does NOT replace GHL. GHL stays the source of truth for:
//   - Leads (form submissions, ads, opt-ins)
//   - Automations (SMS/email sequences)
//   - Pipelines (sales stages)
//
// This file is the contract between GHL and Strive OS. We:
//   1. Receive webhooks at /api/ghl/webhook
//   2. Map GHL payloads into our domain types
//   3. Push back to GHL (player created, attendance taken, payment received)

export type GHLEvent =
  | "contact.created"
  | "contact.updated"
  | "opportunity.stage_changed"
  | "payment.received"
  | "appointment.booked";

export type GHLContactPayload = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
};

export function ghlContactToLead(c: GHLContactPayload) {
  const sourceMap: Record<string, "TikTok" | "Instagram" | "Referral" | "Website" | "GHL Form"> = {
    tiktok: "TikTok",
    instagram: "Instagram",
    referral: "Referral",
    website: "Website",
  };
  const tag = (c.tags ?? []).find((t) => sourceMap[t.toLowerCase()]);
  return {
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Unknown",
    source: (tag && sourceMap[tag.toLowerCase()]) ?? "GHL Form",
    interest: "Group Training" as const,
    createdAt: new Date().toISOString(),
    status: "New" as const,
  };
}

export async function pushToGHL(_event: GHLEvent, _payload: unknown) {
  // Outbound webhook to GHL — wire to your account's webhook URL.
  // const url = process.env.GHL_WEBHOOK_URL;
  // if (!url) return;
  // await fetch(url, {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //     Authorization: `Bearer ${process.env.GHL_API_KEY}`,
  //   },
  //   body: JSON.stringify({ event: _event, payload: _payload }),
  // });
}

export function isGHLConfigured() {
  return Boolean(process.env.GHL_API_KEY && process.env.GHL_WEBHOOK_URL);
}
