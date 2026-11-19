// Notifications inside the App Store app: the pure rules. (The calls to the
// phone are in native-push-client.ts; the sender is apns.ts.)
//
// The shell asks the phone for permission, the phone hands back a device
// token, the site saves it, and Apple delivers to it. A member can turn
// notifications off again from the Account page at any time (App Review
// 4.5.4): the phone comes off file and stays off until they turn it on.

// What the phone says about permission (Capacitor's PermissionState).
export type NativePermission = "prompt" | "prompt-with-rationale" | "granted" | "denied";

export type NativePushStep =
  | "enable" // not asked yet: show the "Turn on notifications" card
  | "resync" // allowed: register again quietly so the token stays current
  | "off" // the member turned them off in the app: ask nothing, send nothing
  | "blocked"; // refused in the phone's Settings: only Settings can change it

// Kept on the phone: "off" once the member has switched notifications off.
export const NATIVE_PUSH_PREF_KEY = "strive_native_push";
// The last device token this phone was given, so it can be taken off file.
export const NATIVE_PUSH_TOKEN_KEY = "strive_native_push_token";

export function nativePushStep(permission: unknown, pref: string | null): NativePushStep {
  if (permission === "denied") return "blocked";
  if (pref === "off") return "off";
  if (permission === "granted") return "resync";
  return "enable";
}

// Where a tapped notification may take the member: a path on our own site
// and nothing else. A full address is accepted only when it is ours.
export function notificationPath(url: unknown, origin = "https://thestriveapp.com"): string | null {
  if (typeof url !== "string") return null;
  const u = url.trim();
  if (/^\/(?!\/)/.test(u) && !u.includes("\\")) return u;
  if (u.startsWith(`${origin}/`)) return notificationPath(u.slice(origin.length), origin);
  return null;
}
