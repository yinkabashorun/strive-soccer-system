// Notifications inside the App Store app: the calls to the phone. Every
// function is safe anywhere and does nothing outside the native shell.
import { callNative, isNativeApp, onNative } from "./native";
import {
  NATIVE_PUSH_PREF_KEY,
  NATIVE_PUSH_TOKEN_KEY,
  nativePushStep,
  notificationPath,
  type NativePushStep,
} from "./native-push";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // storage blocked: the choice simply will not stick
  }
}

// Where this phone stands right now.
export async function readNativePushStep(): Promise<NativePushStep> {
  const status = (await callNative("PushNotifications", "checkPermissions")) as
    | { receive?: string }
    | null;
  return nativePushStep(status?.receive ?? "prompt", read(NATIVE_PUSH_PREF_KEY));
}

let listening = false;

// Listen once per page for the two things the phone tells us: the device
// token (saved on file every time it arrives, which is how a token Apple
// replaced finds its way back) and a tap on a notification (opens the
// screen the notification points at, on our own site only).
function listen() {
  if (listening) return;
  listening = true;
  onNative("PushNotifications", "registration", (data) => {
    const token = (data as { value?: string } | null)?.value;
    if (!token) return;
    write(NATIVE_PUSH_TOKEN_KEY, token);
    void fetch("/api/elite/push/native", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => undefined);
  });
  onNative("PushNotifications", "pushNotificationActionPerformed", (data) => {
    const payload = (data as { notification?: { data?: { url?: unknown } } } | null)?.notification
      ?.data;
    const path = notificationPath(payload?.url);
    if (path) window.location.assign(path);
  });
}

// Ask the phone for its device token (no prompt: permission must already
// be granted). The token arrives through the listener above.
export async function registerNativePush(): Promise<void> {
  if (!isNativeApp()) return;
  listen();
  await callNative("PushNotifications", "register");
}

// The member tapped "Turn on": show the phone's own prompt, and register
// if they allow it. Resolves to where the phone stands afterwards.
export async function enableNativePush(): Promise<NativePushStep> {
  if (!isNativeApp()) return "blocked";
  write(NATIVE_PUSH_PREF_KEY, null);
  const status = (await callNative("PushNotifications", "requestPermissions")) as
    | { receive?: string }
    | null;
  const step = nativePushStep(status?.receive ?? "prompt", null);
  if (step === "resync") await registerNativePush();
  return step;
}

// The member tapped "Turn off": the phone comes off file and stays off.
export async function disableNativePush(): Promise<void> {
  write(NATIVE_PUSH_PREF_KEY, "off");
  const token = read(NATIVE_PUSH_TOKEN_KEY);
  if (token) {
    await fetch("/api/elite/push/native", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => undefined);
    write(NATIVE_PUSH_TOKEN_KEY, null);
  }
  await callNative("PushNotifications", "unregister");
}
