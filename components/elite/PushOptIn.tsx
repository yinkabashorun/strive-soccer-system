"use client";

import { useEffect, useState } from "react";
import { Bell, Share } from "lucide-react";
import type { NotifyStep } from "@/lib/elite/install";
import { VAPID_PUBLIC_KEY, readStep, saveSubscription } from "@/lib/elite/push-client";
import { isNativeApp } from "@/lib/elite/native";
import {
  enableNativePush,
  readNativePushStep,
  registerNativePush,
} from "@/lib/elite/native-push-client";

const DISMISS_KEY = "strive_push_dismissed";
const INSTALL_DISMISS_KEY = "strive_install_dismissed";

function dismissed(key: string): boolean {
  try {
    return Boolean(localStorage.getItem(key));
  } catch {
    // localStorage unavailable (private mode, etc.): show the card anyway
    return false;
  }
}

// The notifications card at the top of the player app. What it shows is
// decided by notifyStep (lib/elite/install.ts):
//   - a browser that offers push: "Turn on notifications", one tap;
//   - an iPhone or iPad in a browser tab: how to add the app to the home
//     screen, because that is the only place Apple offers push (until Nov
//     18 2026 this case showed nothing at all, and no iPhone ever signed up);
//   - already allowed: nothing on screen, the device is re-saved quietly.
// Each card is shown until the member acts on it or taps "Not now", never
// on every visit. In a browser it renders nothing when push isn't configured
// (no VAPID key). Inside the App Store app the same "Turn on notifications"
// card asks the phone itself (native-push-client.ts).
export function PushOptIn() {
  const [step, setStep] = useState<NotifyStep>("none");
  const [busy, setBusy] = useState(false);

  // Inside the App Store app notifications are the phone's own (Apple's
  // push service), not web push, and there is no "add to home screen".
  const [native, setNative] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isNativeApp()) {
      setNative(true);
      void readNativePushStep().then((next) => {
        if (next === "resync") {
          void registerNativePush();
          return;
        }
        if (next === "enable" && !dismissed(DISMISS_KEY)) setStep("enable");
      });
      return;
    }
    if (!VAPID_PUBLIC_KEY) return;
    const next = readStep();
    if (next === "resync") {
      saveSubscription().catch(() => undefined);
      return;
    }
    if (next === "enable" && dismissed(DISMISS_KEY)) return;
    if (next === "install_ios" && dismissed(INSTALL_DISMISS_KEY)) return;
    setStep(next);
  }, []);

  async function enable() {
    setBusy(true);
    try {
      if (native) {
        await enableNativePush();
      } else {
        const permission = await Notification.requestPermission();
        if (permission === "granted") await saveSubscription();
      }
    } catch {
      // best-effort: a failed subscribe just means no push, not a broken app
    } finally {
      setBusy(false);
      setStep("none");
    }
  }

  function dismiss(key: string) {
    setStep("none");
    try {
      localStorage.setItem(key, "1");
    } catch {
      // fine to skip persisting the dismissal
    }
  }

  if (step === "install_ios") {
    return (
      <div className="elite-card flex items-start gap-3 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
          <Share className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-bone">Add Strive Elite to your home screen</div>
          <div className="mt-0.5 text-sm text-white/60">
            Tap the Share button in your browser, then tap Add to Home Screen. Open Strive
            Elite from your home screen and turn on notifications, so you know the moment
            your new week is live or your coach messages you.
          </div>
        </div>
        <button
          onClick={() => dismiss(INSTALL_DISMISS_KEY)}
          className="shrink-0 rounded-xl px-3 py-2 text-sm text-white/50 hover:text-white/80"
        >
          Not now
        </button>
      </div>
    );
  }

  if (step !== "enable") return null;

  return (
    <div className="elite-card flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
        <Bell className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-bone">Turn on notifications</div>
        <div className="text-sm text-white/50">
          Get alerted the moment your new week drops or your coach messages you.
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => dismiss(DISMISS_KEY)}
          className="rounded-xl px-3 py-2 text-sm text-white/40 hover:text-white/70"
        >
          Not now
        </button>
        <button
          onClick={enable}
          disabled={busy}
          className="rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {busy ? "..." : "Turn on"}
        </button>
      </div>
    </div>
  );
}
