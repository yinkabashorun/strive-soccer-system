// Strive Elite transactional email.
//
// Best-effort, no-op-safe. Sends via Resend when RESEND_API_KEY is set;
// otherwise every function quietly does nothing so the app is fully
// functional without email configured. Never throws to the caller.

import { createServiceClient } from "./supabase/server";

const FROM = process.env.RESEND_FROM || "Strive Elite <coach@strivesoccer100x.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.strivesoccer100x.com";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

type Mail = { subject: string; body: string };

// Low-level send. Wraps the body in a minimal branded HTML shell.
export async function sendEmail(
  to: string | string[],
  mail: Mail
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!key || recipients.length === 0) return false;

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#0a0a0a;color:#f5f3ea;padding:32px">
  <div style="max-width:520px;margin:0 auto">
    <div style="font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#E5FF3D;font-size:14px">Strive Elite</div>
    <div style="margin-top:20px;font-size:16px;line-height:1.6;color:#e8e6dd;white-space:pre-line">${escapeHtml(
      mail.body
    )}</div>
    <a href="${APP_URL}" style="display:inline-block;margin-top:28px;background:#E5FF3D;color:#0a0a0a;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px">Open Strive Elite</a>
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
      body: JSON.stringify({
        from: FROM,
        to: recipients,
        subject: mail.subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Email the player + their parent contact.
export async function sendPlayerEmail(
  playerId: string,
  mail: Mail
): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  const admin = createServiceClient();
  if (!admin) return false;
  const { data: player } = await admin
    .from("elite_players")
    .select("parent_email, profile_id")
    .eq("id", playerId)
    .maybeSingle();
  if (!player) return false;

  const emails = new Set<string>();
  if (player.parent_email) emails.add(player.parent_email);
  if (player.profile_id) {
    const { data: prof } = await admin
      .from("elite_profiles")
      .select("email")
      .eq("id", player.profile_id)
      .maybeSingle();
    if (prof?.email) emails.add(prof.email);
  }
  return sendEmail([...emails], mail);
}

// Email the coach who manages this player.
export async function sendCoachEmail(
  playerId: string,
  mail: Mail
): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  const admin = createServiceClient();
  if (!admin) return false;
  const { data: player } = await admin
    .from("elite_players")
    .select("coach_id")
    .eq("id", playerId)
    .maybeSingle();
  if (!player?.coach_id) return false;
  const { data: coach } = await admin
    .from("elite_profiles")
    .select("email")
    .eq("id", player.coach_id)
    .maybeSingle();
  if (!coach?.email) return false;
  return sendEmail(coach.email, mail);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
