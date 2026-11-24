// Strive Elite real push notifications (Web Push / VAPID, plus Apple's
// push service for the App Store app). Unlike email
// (lib/elite/email.ts), this reaches a player's phone/laptop even when the
// app is closed, no login required to see the alert. Best-effort and
// no-op-safe the same way: with no VAPID keys configured, every function
// quietly does nothing and the app is fully functional without it.
import webpush from "web-push";
import { createServiceClient } from "./supabase/server";
import type { PushStatus } from "./install";
import { isNativePushConfigured, sendApns, type ApnsPayload } from "./apns";

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

// A push as lib/elite/notify.ts hands it over: the notice's words, where a
// tap opens, the topic and kind, a collapse id, and whether it arrives
// quietly. Callers never build one by hand: every push is a notice
// (lib/elite/notices.ts), sent by notifyPlayer / notifyProfile.
export type PushPayload = ApnsPayload;

// What a browser is sent (public/sw.js reads it): `tag` is the collapse id
// (a later notification with the same tag replaces the earlier one) and
// `silent` the quiet delivery.
export function webPushBody(payload: PushPayload): string {
  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    ...(payload.topic ? { topic: payload.topic } : {}),
    ...(payload.kind ? { kind: payload.kind } : {}),
    ...(payload.collapse ? { tag: payload.collapse } : {}),
    ...(payload.quiet ? { silent: true } : {}),
  });
}

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

// The filter for "this person's devices": the key asked for, and the other
// key of the same person when they have one. Ids are uuids read from our
// own tables, checked before they go into a filter.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function devicesWhere(column: "player_id" | "profile_id", id: string, siblings: readonly string[]): string {
  const other = column === "player_id" ? "profile_id" : "player_id";
  const parts = [`${column}.eq.${id}`];
  for (const s of siblings) if (UUID_RE.test(s)) parts.push(`${other}.eq.${s}`);
  return parts.join(",");
}

async function devicesFilter(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  column: "player_id" | "profile_id",
  id: string
): Promise<string> {
  if (!UUID_RE.test(id)) return `${column}.eq.${id}`;
  try {
    if (column === "player_id") {
      const { data } = await admin.from("elite_players").select("profile_id").eq("id", id).maybeSingle();
      const profile = (data as { profile_id: string | null } | null)?.profile_id;
      return devicesWhere(column, id, profile ? [profile] : []);
    }
    const { data } = await admin.from("elite_players").select("id").eq("profile_id", id);
    return devicesWhere(column, id, ((data as { id: string }[] | null) ?? []).map((p) => p.id));
  } catch {
    return devicesWhere(column, id, []);
  }
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
  // ONE APP (lib/elite/one-app.ts): the same person is on file by profile
  // while they are a free player and by player once Strive Pro is on, and a
  // phone is moved only the next time the app opens. So a push goes to the
  // devices under EITHER key of that one person: a friend's post still
  // reaches a player who upgraded, and a new week reaches a phone that was
  // put on file while they were free.
  const where = await devicesFilter(admin, column, id);

  if (web) {
    ensureConfigured();
    const { data: subs } = await admin
      .from("elite_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .or(where);
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            webPushBody(payload)
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
      .or(where);
    const tokens = [...new Set((phones ?? []).map((p) => p.token as string))];
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
