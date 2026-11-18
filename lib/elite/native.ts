// The phone itself: haptics, keeping the screen awake, and knowing whether
// the page is running inside the native iPhone shell or in a browser.
//
// Client-only helpers, every one of them safe to call anywhere: with no
// native shell and no browser support they quietly do nothing. The shell
// (Capacitor) injects `window.Capacitor`; nothing here imports a native
// package, so the website builds and runs exactly the same without it.
import { FEEL_PREF_KEY, feelEnabled, hapticFor, type Moment } from "./session-flow";

type NativePlugin = Record<string, ((options?: unknown) => Promise<unknown>) | undefined>;
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, NativePlugin | undefined>;
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<unknown>;
};

function capacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

// True inside the App Store app, false in Safari, Chrome or the home-screen
// web app.
export function isNativeApp(): boolean {
  try {
    return capacitor()?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

// Call a method of a native plugin, by name. Inside the shell the bridge
// offers two doors and either may be the one that is open: the plugin
// object (when the plugin's web package is loaded) and the bridge's own
// nativePromise (always there). Resolves to null outside the shell or when
// the plugin is not installed.
export async function callNative(
  plugin: string,
  method: string,
  options?: unknown
): Promise<unknown> {
  if (!isNativeApp()) return null;
  const cap = capacitor();
  try {
    const direct = cap?.Plugins?.[plugin]?.[method];
    if (typeof direct === "function") return await direct(options);
    if (typeof cap?.nativePromise === "function") {
      return await cap.nativePromise(plugin, method, options ?? {});
    }
  } catch {
    // an absent or failing native call never breaks the page
  }
  return null;
}

// A touch of feedback for a moment in the session. Native haptics inside
// the shell; a short vibration where a browser offers one (Android); and
// nothing on iPhone Safari, which offers neither. Off when the player has
// switched vibration off on their Account page.
export function feel(moment: Moment): void {
  try {
    if (typeof window !== "undefined" && !feelEnabled(window.localStorage.getItem(FEEL_PREF_KEY))) {
      return;
    }
  } catch {
    // storage blocked: fall through with the default (on)
  }
  try {
    const h = hapticFor(moment);
    if (isNativeApp()) {
      for (const call of h.native) {
        const run = () => void callNative("Haptics", call.method, call.options);
        if (call.after) setTimeout(run, call.after);
        else run();
      }
      return;
    }
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(h.pattern);
    }
  } catch {
    // feedback is a nicety, never a reason to fail a tap
  }
}

type WakeLockSentinel = { release: () => Promise<void> };

// Keep the screen on while a session is open (a player with a ball at
// their feet is not touching the phone). Returns the function that lets
// the screen sleep again. Re-taken when the app comes back to the front,
// because the browser drops the lock whenever the page is hidden.
export function keepAwake(): () => void {
  if (typeof navigator === "undefined" || typeof document === "undefined") return () => undefined;
  const wl = (navigator as unknown as {
    wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
  }).wakeLock;
  if (!wl) return () => undefined;

  let sentinel: WakeLockSentinel | null = null;
  let stopped = false;
  const take = () => {
    if (stopped || document.visibilityState !== "visible") return;
    wl.request("screen")
      .then((s) => {
        if (stopped) void s.release().catch(() => undefined);
        else sentinel = s;
      })
      .catch(() => undefined);
  };
  take();
  document.addEventListener("visibilitychange", take);
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", take);
    void sentinel?.release().catch(() => undefined);
    sentinel = null;
  };
}
