// Strive Elite real push notifications (Web Push / VAPID, plus Apple's
// push service for the App Store app). Unlike email
// (lib/elite/email.ts), this reaches a player's phone/laptop even when the
// app is closed, no login required to see the alert. Best-effort and
// no-op-safe the same way: with no VAPID keys configured, every function
// quietly does nothing and the app is fully functional without it.
import webpush from "web-push";
import { createServiceClient } from "./supabase/server";
import type { PushStatus } from "./install";
import { isNativePushConfigured, sendApns } from "./apns";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:coach@strivesoccer100x.com";

export function isPushConfigured(): boolean {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

let configured = false;
function ensureConfigured() {
  if (configured || !isPushConfigured()) return;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY!, PRIVATE_KEY!);
  configured = true;
}

// What the coach dashboard shows about push: are the keys set, and how many
// active players have a device on file. Before Nov 18 2026 nothing showed
// this, and push sat at zero devices for seven weeks without anyone knowing.
export async function getPushStatus(): Promise<PushStatus> {
  const status: PushStatus = {
    configured: isPushConfigured(),
    devices: 0,
    playersOn: 0,
    playersTotal: 0,
  };
  const admin = createServiceClient();
  if (!admin) return status;
  const [{ data: subs }, { data: phones }, { count }] = await Promise.all([
    admin.from("elite_push_subscriptions").select("player_id"),
    admin.from("elite_native_push_tokens").select("player_id"),
    admin
      .from("elite_players")
      .select("id", { count: "exact", head: true })
      .in("subscription_status", ["active", "trialing"]),
  ]);
  // A device is a browser subscription or a phone with the App Store app.
  // A free account's devices (078) carry no player and are not counted.
  const all = [...(subs ?? []), ...(phones ?? [])].filter((s) => s.player_id);
  status.devices = all.length;
  status.playersOn = new Set(all.map((s) => s.player_id as string)).size;
  status.playersTotal = count ?? 0;
  return status;
}

export type PushPayload = { title: string; body: string; url?: string };

// Push to every device a player has on file: browsers and home-screen web
// apps through Web Push, the App Store app through Apple's push service
// (lib/elite/apns.ts). Each channel is skipped when its keys are not set.
// Dead devices (unsubscribed, app deleted) are deleted on the spot so they
// never keep failing.
export async function sendPushToPlayer(
  playerId: string,
  payload: PushPayload
): Promise<{ sent: number }> {
  return sendToDevices("player_id", playerId, payload);
}

// The same for a free account (078): its devices are on file by profile.
export async function sendPushToProfile(
  profileId: string,
  payload: PushPayload
): Promise<{ sent: number }> {
  return sendToDevices("profile_id", profileId, payload);
}

async function sendToDevices(
  column: "player_id" | "profile_id",
  id: string,
  payload: PushPayload
): Promise<{ sent: number }> {
  const web = isPushConfigured();
  const native = isNativePushConfigured();
  if (!web && !native) return { sent: 0 };
  const admin = createServiceClient();
  if (!admin) return { sent: 0 };

  let sent = 0;

  if (web) {
    ensureConfigured();
    const { data: subs } = await admin
      .from("elite_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq(column, id);
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            JSON.stringify(payload)
          );
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await admin.from("elite_push_subscriptions").delete().eq("id", s.id);
          }
        }
      })
    );
  }

  if (native) {
    const { data: phones } = await admin
      .from("elite_native_push_tokens")
      .select("token")
      .eq(column, id);
    const tokens = (phones ?? []).map((p) => p.token as string);
    if (tokens.length > 0) {
      const result = await sendApns(tokens, payload);
      sent += result.sent;
      if (result.forget.length > 0) {
        await admin.from("elite_native_push_tokens").delete().in("token", result.forget);
      }
    }
  }

  return { sent };
}
