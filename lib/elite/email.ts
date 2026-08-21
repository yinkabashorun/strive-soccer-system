// Strive Elite outbound notifications (player + parent + coach).
//
// Two channels, both best-effort and no-op-safe:
//   1. GoHighLevel - POSTs the event to a GHL Inbound Webhook (GHL_WEBHOOK_URL)
//      so your GHL workflow sends the actual email/SMS with your branding.
//   2. Resend - a direct transactional email fallback if RESEND_API_KEY is set.
//
// Nothing here throws to the caller. With neither configured, every function
// quietly does nothing and the app is fully functional.

import { createServiceClient } from "./supabase/server";

const FROM = process.env.RESEND_FROM || "Strive Elite <coach@strivesoccer100x.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://thestriveapp.com";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
// GHL is configured if the catch-all URL or ANY per-event URL is set
// (GHL_WEBHOOK_URL, GHL_WEBHOOK_URL_PLAYER_SIGNED_UP, …).
export function isGhlConfigured(): boolean {
  return Object.keys(process.env).some(
    (k) => k.startsWith("GHL_WEBHOOK_URL") && process.env[k]
  );
}

// Each automation can have its own GHL workflow: set
// GHL_WEBHOOK_URL_<EVENT> (uppercased) to route that event to its own
// Inbound Webhook; GHL_WEBHOOK_URL is the catch-all fallback.
function ghlUrlFor(event: string): string | undefined {
  return (
    process.env[`GHL_WEBHOOK_URL_${event.toUpperCase()}`] ||
    process.env.GHL_WEBHOOK_URL
  );
}

type Mail = { subject: string; body: string; event?: string };

type Contact = { name: string; email: string };

// POST an event to the GoHighLevel Inbound Webhook. The GHL workflow reads
// these fields to send the branded email/SMS and match the contact.
async function dispatchGHL(payload: {
  event: string;
  audience: "player" | "coach";
  subject: string;
  body: string;
  recipients: Contact[];
  player?: { name: string; week?: number };
}): Promise<boolean> {
  const url = ghlUrlFor(payload.event);
  if (!url || payload.recipients.length === 0) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        // flat fields for easy mapping inside a GHL workflow
        to_name: payload.recipients[0]?.name ?? "",
        to_email: payload.recipients[0]?.email ?? "",
        emails: payload.recipients.map((r) => r.email).filter(Boolean),
        app_url: APP_URL,
        source: "strive-elite",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Resend fallback - a branded HTML email.
async function dispatchResend(
  recipients: Contact[],
  mail: Mail
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = recipients.map((r) => r.email).filter(Boolean);
  if (!key || to.length === 0) return false;

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#0a0a0a;color:#f5f3ea;padding:32px">
  <div style="max-width:520px;margin:0 auto">
    <div style="font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#F5C518;font-size:14px">Strive Elite</div>
    <div style="margin-top:20px;font-size:16px;line-height:1.6;color:#e8e6dd;white-space:pre-line">${escapeHtml(
      mail.body
    )}</div>
    <a href="${APP_URL}" style="display:inline-block;margin-top:28px;background:#ffffff;color:#0a0a0a;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px">Open Strive Elite</a>
    <div style="margin-top:28px;font-size:12px;color:#8a887f">Strive Soccer FC · You're receiving this because you're part of the Strive Elite program.</div>
  </div>
</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject: mail.subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Notify the player + their parent contact.
export async function sendPlayerEmail(
  playerId: string,
  mail: Mail
): Promise<boolean> {
  if (!isGhlConfigured() && !isEmailConfigured()) return false;
  const admin = createServiceClient();
  if (!admin) return false;
  const { data: player } = await admin
    .from("elite_players")
    .select("full_name, parent_email, parent_name, current_week, profile_id")
    .eq("id", playerId)
    .maybeSingle();
  if (!player) return false;

  const recipients: Contact[] = [];
  if (player.parent_email)
    recipients.push({ name: player.parent_name || "", email: player.parent_email });
  if (player.profile_id) {
    const { data: prof } = await admin
      .from("elite_profiles")
      .select("email, full_name")
      .eq("id", player.profile_id)
      .maybeSingle();
    if (prof?.email)
      recipients.push({ name: prof.full_name || player.full_name, email: prof.email });
  }
  if (recipients.length === 0) return false;

  const ghl = await dispatchGHL({
    event: mail.event ?? "player_notification",
    audience: "player",
    subject: mail.subject,
    body: mail.body,
    recipients,
    player: { name: player.full_name, week: player.current_week },
  });
  const email = await dispatchResend(recipients, mail);
  return ghl || email;
}

// Notify the coach who manages this player.
export async function sendCoachEmail(
  playerId: string,
  mail: Mail
): Promise<boolean> {
  if (!isGhlConfigured() && !isEmailConfigured()) return false;
  const admin = createServiceClient();
  if (!admin) return false;
  const { data: player } = await admin
    .from("elite_players")
    .select("full_name, coach_id")
    .eq("id", playerId)
    .maybeSingle();
  if (!player?.coach_id) return false;
  const { data: coach } = await admin
    .from("elite_profiles")
    .select("email, full_name")
    .eq("id", player.coach_id)
    .maybeSingle();
  if (!coach?.email) return false;

  const recipients: Contact[] = [
    { name: coach.full_name || "Coach", email: coach.email },
  ];
  const ghl = await dispatchGHL({
    event: mail.event ?? "coach_notification",
    audience: "coach",
    subject: mail.subject,
    body: mail.body,
    recipients,
    player: { name: player.full_name },
  });
  const email = await dispatchResend(recipients, mail);
  return ghl || email;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
