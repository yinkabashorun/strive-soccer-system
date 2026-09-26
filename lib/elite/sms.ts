// Strive Elite player/parent SMS via GoHighLevel. Chosen over Twilio
// directly because A2P 10DLC registration takes weeks and GHL already has
// a registered sending number - one inbound webhook per event, GHL's own
// workflow does the actual send. Best-effort and no-op-safe the same way
// as lib/elite/email.ts and lib/elite/push.ts: with no GHL_WEBHOOK_URL*
// set, every function quietly does nothing and the app is fully
// functional without it.
import { createServiceClient } from "./supabase/server";

// Each event can have its own GHL workflow via GHL_WEBHOOK_URL_<EVENT>
// (uppercased); GHL_WEBHOOK_URL is the catch-all fallback. Same convention
// as lib/elite/email.ts's dispatchGHL, kept as a separate, simpler payload
// here since SMS only ever needs {event, phone, first_name, message}.
function ghlUrlFor(event: string): string | undefined {
  return (
    process.env[`GHL_WEBHOOK_URL_${event.toUpperCase()}`] ||
    process.env.GHL_WEBHOOK_URL
  );
}

export function isSmsConfigured(): boolean {
  return Object.keys(process.env).some(
    (k) => k.startsWith("GHL_WEBHOOK_URL") && process.env[k]
  );
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

async function postToGhl(
  event: string,
  phone: string,
  firstName: string,
  message: string
): Promise<boolean> {
  const url = ghlUrlFor(event);
  if (!url) return false;
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        phone: normalized,
        first_name: firstName,
        message: capForSms(message),
      }),
    });
    return res.ok;
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
  return postToGhl(opts.event, player.parent_phone, firstName, opts.message);
}
