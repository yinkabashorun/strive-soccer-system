// Strive Elite real push notifications (Web Push / VAPID). Unlike email
// (lib/elite/email.ts), this reaches a player's phone/laptop even when the
// app is closed, no login required to see the alert. Best-effort and
// no-op-safe the same way: with no VAPID keys configured, every function
// quietly does nothing and the app is fully functional without it.
import webpush from "web-push";
import { createServiceClient } from "./supabase/server";
import type { PushStatus } from "./install";

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
  const [{ data: subs }, { count }] = await Promise.all([
    admin.from("elite_push_subscriptions").select("player_id"),
    admin
      .from("elite_players")
      .select("id", { count: "exact", head: true })
      .in("subscription_status", ["active", "trialing"]),
  ]);
  status.devices = subs?.length ?? 0;
  status.playersOn = new Set((subs ?? []).map((s) => s.player_id as string)).size;
  status.playersTotal = count ?? 0;
  return status;
}

export type PushPayload = { title: string; body: string; url?: string };

// Push to every device a player has subscribed on. Dead subscriptions
// (device unsubscribed, browser data cleared, etc.) come back as 404/410
// from the push service - deleted on the spot so they never keep failing.
export async function sendPushToPlayer(
  playerId: string,
  payload: PushPayload
): Promise<{ sent: number }> {
  if (!isPushConfigured()) return { sent: 0 };
  ensureConfigured();
  const admin = createServiceClient();
  if (!admin) return { sent: 0 };

  const { data: subs } = await admin
    .from("elite_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("player_id", playerId);
  if (!subs || subs.length === 0) return { sent: 0 };

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
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
  return { sent };
}
