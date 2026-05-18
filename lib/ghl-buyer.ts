// GHL helper: upsert a contact and tag them as a dribbling course buyer.
// Used by /api/ghl/dribbling-course-buyer, which the success page fires
// in the background as soon as Stripe confirms the purchase.

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

export const DRIBBLING_BUYER_TAG = "dribbling-course-buyer";

export function isGHLBuyerConfigured(): boolean {
  return Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
}

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
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ") || undefined,
  };
}

export type UpsertBuyerInput = {
  email: string;
  name?: string;
  phone?: string;
  sessionId?: string;
};

export type UpsertBuyerResult = {
  ok: boolean;
  contactId?: string;
  status: number;
  error?: string;
};

// POST /contacts/upsert is idempotent on email/phone, so re-firing this
// from the success page (or a Stripe webhook later) is safe.
export async function upsertDribblingCourseBuyer(
  input: UpsertBuyerInput,
): Promise<UpsertBuyerResult> {
  if (!isGHLBuyerConfigured()) {
    return { ok: false, status: 503, error: "ghl_not_configured" };
  }

  const { firstName, lastName } = splitName(input.name);

  const body = {
    locationId: process.env.GHL_LOCATION_ID,
    email: input.email,
    phone: input.phone,
    firstName,
    lastName,
    source: "Strive Dribbling System · Stripe checkout",
    tags: [DRIBBLING_BUYER_TAG],
    customFields: input.sessionId
      ? [{ key: "stripe_session_id", field_value: input.sessionId }]
      : undefined,
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
  const data = (await res.json()) as {
    contact?: { id?: string };
    id?: string;
  };
  return {
    ok: true,
    contactId: data.contact?.id ?? data.id,
    status: res.status,
  };
}
