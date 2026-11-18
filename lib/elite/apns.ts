// Native iPhone push (Apple Push Notification service), for the App Store
// app. Web Push (lib/elite/push.ts) cannot reach a phone inside the native
// shell: Apple only delivers there through APNs, to the device token the
// shell hands the site (elite_native_push_tokens, migration 067).
//
// Token-based auth: a short ES256 JWT signed with the .p8 key from the
// Apple Developer account. The four values live in Vercel, never in this
// repository (it is public):
//   APNS_KEY_ID     the 10-character Key ID of the .p8 key
//   APNS_TEAM_ID    the 10-character Apple Team ID
//   APNS_P8         the full text of the .p8 file
//   APNS_BUNDLE_ID  the app's bundle ID (default com.strivesoccer.elite)
// With any of the first three unset every function here quietly does
// nothing, the same way web push behaves with no VAPID keys.
import { connect } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";

export const DEFAULT_BUNDLE_ID = "com.strivesoccer.elite";
const APNS_HOST = process.env.APNS_HOST || "https://api.push.apple.com";

export type ApnsConfig = { keyId: string; teamId: string; p8: string; bundleId: string };

// Reads the config from an env-shaped object. A key pasted into a one-line
// field arrives with literal "\n"; both shapes are accepted.
export function apnsConfig(env: Record<string, string | undefined> = process.env): ApnsConfig | null {
  const keyId = env.APNS_KEY_ID?.trim();
  const teamId = env.APNS_TEAM_ID?.trim();
  const p8 = env.APNS_P8?.replace(/\\n/g, "\n").trim();
  if (!keyId || !teamId || !p8) return null;
  return { keyId, teamId, p8, bundleId: env.APNS_BUNDLE_ID?.trim() || DEFAULT_BUNDLE_ID };
}

export function isNativePushConfigured(): boolean {
  return apnsConfig() !== null;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

// The provider token Apple asks for: header {alg, kid}, claims {iss, iat},
// signed ES256 (raw r||s, which is what JWT wants, not DER).
export function apnsJwt(cfg: Pick<ApnsConfig, "keyId" | "teamId" | "p8">, nowSeconds: number): string {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }));
  const claims = b64url(JSON.stringify({ iss: cfg.teamId, iat: nowSeconds }));
  const data = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(data), {
    key: createPrivateKey(cfg.p8),
    dsaEncoding: "ieee-p1363",
  });
  return `${data}.${b64url(signature)}`;
}

// Apple rejects a provider token older than an hour and throttles one that
// is re-made too often, so one token is kept for 40 minutes.
const JWT_TTL_SECONDS = 40 * 60;
let cached: { token: string; made: number; keyId: string } | null = null;
function providerToken(cfg: ApnsConfig): string {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.keyId === cfg.keyId && now - cached.made < JWT_TTL_SECONDS) return cached.token;
  cached = { token: apnsJwt(cfg, now), made: now, keyId: cfg.keyId };
  return cached.token;
}

export type ApnsPayload = { title: string; body: string; url?: string };

// What goes to the phone. `url` rides beside `aps` so a tap on the
// notification can open the right screen.
export function apnsBody(payload: ApnsPayload): string {
  return JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
    ...(payload.url ? { url: payload.url } : {}),
  });
}

// A device token that will never work again (the app was deleted, the token
// belongs to another app or environment) is taken off file on the spot.
export function apnsShouldForget(status: number, reason: string | null): boolean {
  if (status === 410) return true;
  return status === 400 && (reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic");
}

// A device token as Apple issues it: hex, 64 characters today, longer
// allowed. Anything else is refused before it reaches the database.
export function cleanDeviceToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  return /^[0-9a-f]{64,200}$/.test(t) ? t : null;
}

export type ApnsResult = { sent: number; forget: string[] };

// Send one notification to each device token over a single connection.
// Never throws: a failed send is no push, not a failed request.
export async function sendApns(tokens: string[], payload: ApnsPayload): Promise<ApnsResult> {
  const cfg = apnsConfig();
  const result: ApnsResult = { sent: 0, forget: [] };
  if (!cfg || tokens.length === 0) return result;

  let jwt: string;
  try {
    jwt = providerToken(cfg);
  } catch {
    return result; // a malformed key: nothing can be sent
  }
  const body = apnsBody(payload);

  await new Promise<void>((done) => {
    const client = connect(APNS_HOST);
    let open = tokens.length;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        client.close();
      } catch {
        // already closed
      }
      done();
    };
    const timer = setTimeout(finish, 10_000);
    client.on("error", finish);

    for (const token of tokens) {
      const req = client.request({
        ":method": "POST",
        ":path": `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        "apns-topic": cfg.bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      });
      let status = 0;
      let text = "";
      req.on("response", (headers) => {
        status = Number(headers[":status"]) || 0;
      });
      req.setEncoding("utf8");
      req.on("data", (chunk: string) => {
        text += chunk;
      });
      const settle = () => {
        if (status === 200) result.sent++;
        else {
          let reason: string | null = null;
          try {
            reason = (JSON.parse(text) as { reason?: string }).reason ?? null;
          } catch {
            // no body
          }
          if (apnsShouldForget(status, reason)) result.forget.push(token);
        }
        if (--open === 0) finish();
      };
      req.on("end", settle);
      req.on("error", () => {
        if (--open === 0) finish();
      });
      req.end(body);
    }
  });
  return result;
}
