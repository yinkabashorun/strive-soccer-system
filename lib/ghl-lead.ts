// Course-specific GHL helpers: push a new lead with the dribbling course
// tag, promote a buyer to "Dribbling Course Buyer" after Stripe payment.

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

export const TAG_LEAD = "Dribbling Course Lead";
export const TAG_BUYER = "Dribbling Course Buyer";

export type GHLUpsertContact = {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  source?: string;
  tags?: string[];
};

function headers() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    Version: GHL_VERSION,
  };
}

function splitName(full?: string): { firstName?: string; lastName?: string } {
  if (!full) return {};
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return {};
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") || undefined };
}

export function isGHLLeadConfigured(): boolean {
  return Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
}

// Upsert a contact in GHL with the supplied tags. Idempotent — GHL matches
// on email or phone when both are absent of `contactId`.
//
// Docs: POST /contacts/upsert
export async function upsertGHLContact(input: GHLUpsertContact): Promise<{
  ok: boolean;
  contactId?: string;
  status: number;
  error?: string;
}> {
  if (!isGHLLeadConfigured()) {
    return { ok: false, status: 503, error: "ghl_not_configured" };
  }
  const { firstName: fn, lastName: ln } = splitName(input.name);
  const body = {
    locationId: process.env.GHL_LOCATION_ID,
    firstName: input.firstName ?? fn,
    lastName: input.lastName ?? ln,
    email: input.email,
    phone: input.phone,
    source: input.source ?? "Strive OS",
    tags: input.tags ?? [],
  };

  const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: `ghl_upsert_${res.status}: ${detail.slice(0, 240)}`,
    };
  }
  const data = (await res.json()) as { contact?: { id?: string }; id?: string };
  const contactId = data.contact?.id ?? data.id;
  return { ok: true, contactId, status: res.status };
}

// Add a tag to an existing GHL contact. Used to promote a lead to buyer
// after the Stripe webhook fires.
export async function tagGHLContact(
  contactId: string,
  tags: string[],
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!isGHLLeadConfigured()) {
    return { ok: false, status: 503, error: "ghl_not_configured" };
  }
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: `ghl_tag_${res.status}: ${detail.slice(0, 240)}`,
    };
  }
  return { ok: true, status: res.status };
}
