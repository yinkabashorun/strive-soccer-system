// Strive Elite player/parent SMS via GoHighLevel. Chosen over Twilio
// directly because A2P 10DLC registration takes weeks and GHL already has
// a registered sending number. Goes straight through the GHL API (same
// auth as lib/ghl.ts's Social Planner + lib/ghl-buyer.ts's contact
// upsert) rather than an Inbound Webhook - GHL_API_KEY already
// authenticates this app to GHL, so no extra workflow to build.
// Best-effort and no-op-safe the same way as lib/elite/email.ts and
// lib/elite/push.ts: with no GHL_API_KEY set, every function quietly does
// nothing and the app is fully functional without it.
import { createServiceClient } from "./supabase/server";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";

// Strive Soccer's GHL location. GHL_LOCATION_ID is already used elsewhere
// (Social Planner, dribbling-course buyer upsert) but wasn't guaranteed to
// be set for this feature, so fall back to the known literal rather than
// silently no-op.
const DEFAULT_LOCATION_ID = "SjVsI2ZXLXjBrWGA0VfI";

function locationId(): string {
  return process.env.GHL_LOCATION_ID || DEFAULT_LOCATION_ID;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY ?? ""}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    Version: GHL_VERSION,
  };
}

export function isSmsConfigured(): boolean {
  return Boolean(process.env.GHL_API_KEY);
}

// Best-effort US-centric normalize: GHL/its SMS provider can likely
// handle loose formats, but a clean E.164 number is the safest thing to
// hand any SMS API. Falls back to whatever was typed if it doesn't look
// like a plain US number - never throws, never blocks a send.
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
}

// Keeps a text from silently ballooning into a multi-segment (multi-cost)
// SMS - three periods, not an ellipsis character, so it stays in the
// cheap GSM-7 charset instead of forcing UCS-2 encoding.
const SMS_CHAR_LIMIT = 480;
function capForSms(message: string): string {
  return message.length > SMS_CHAR_LIMIT
    ? `${message.slice(0, SMS_CHAR_LIMIT - 3)}...`
    : message;
}

// POST /contacts/upsert is idempotent on phone, so re-firing this on every
// text is safe and keeps the GHL contact record current with whatever
// name we have.
async function upsertContact(phone: string, firstName: string): Promise<string | null> {
  const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      locationId: locationId(),
      phone,
      firstName,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { contact?: { id?: string }; id?: string };
  return data.contact?.id ?? data.id ?? null;
}

async function sendSmsToContact(contactId: string, message: string): Promise<boolean> {
  const res = await fetch(`${GHL_BASE}/conversations/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      type: "SMS",
      contactId,
      message,
    }),
  });
  return res.ok;
}

// Upsert the contact by phone, then send the text. Exported directly (not
// just via sendPlayerSMS) so it can be exercised on its own - e.g. a
// one-off test send with no player record involved.
export async function sendSms(
  phone: string,
  firstName: string,
  message: string
): Promise<boolean> {
  if (!isSmsConfigured()) return false;
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  try {
    const contactId = await upsertContact(normalized, firstName);
    if (!contactId) return false;
    return await sendSmsToContact(contactId, capForSms(message));
  } catch {
    return false;
  }
}

// Text a player's family (parent_phone). first_name is the PARENT's first
// name where we have one (matches how a real coach would address a text
// to mom/dad), falling back to the player's own first name.
export async function sendPlayerSMS(
  playerId: string,
  opts: { event: string; message: string }
): Promise<boolean> {
  if (!isSmsConfigured()) return false;
  const admin = createServiceClient();
  if (!admin) return false;

  const { data: player } = await admin
    .from("elite_players")
    .select("full_name, parent_name, parent_phone")
    .eq("id", playerId)
    .maybeSingle();
  if (!player?.parent_phone) return false;

  const firstName =
    (player.parent_name || player.full_name || "").trim().split(" ")[0] || "there";
  return sendSms(player.parent_phone, firstName, opts.message);
}
