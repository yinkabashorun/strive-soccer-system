// Browser-side push: reading where this device stands and putting it on
// (or taking it off) file. Shared by the notifications card at the top of
// the player app and the Notifications row on the Account page.
import { notifyStep, type NotifyPermission, type NotifyStep } from "./install";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function readPermission(): NotifyPermission {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

export function readStep(): NotifyStep {
  const hasPush = "serviceWorker" in navigator && "PushManager" in window;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return notifyStep({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone,
    hasPush,
    permission: readPermission(),
  });
}

// Put this device on file: register the service worker, reuse the
// subscription the browser already holds or make one, and save it. Safe to
// run on every visit (the save is an upsert), which is how a subscription
// the browser quietly replaced finds its way back to the server.
export async function saveSubscription(): Promise<void> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    }));
  await fetch("/api/elite/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
}

// True when this device currently holds a push subscription.
export async function hasSubscription(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    return Boolean(await reg?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

// Take this device off file, on the phone and on the server. A member can
// always turn notifications off from inside the app (App Review 4.5.4).
export async function removeSubscription(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/elite/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}
