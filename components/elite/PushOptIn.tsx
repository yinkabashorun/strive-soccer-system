"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Share } from "lucide-react";
import {
  PUSH_ASKED_KEY,
  PUSH_ASKED_LEGACY_KEYS,
  finishAsk,
  type FinishAsk,
  type NotifyStep,
} from "@/lib/elite/install";
import { VAPID_PUBLIC_KEY, readStep, saveSubscription } from "@/lib/elite/push-client";
import { isNativeApp } from "@/lib/elite/native";
import {
  enableNativePush,
  readNativePushStep,
  registerNativePush,
} from "@/lib/elite/native-push-client";

function wasAsked(): boolean {
  try {
    return [PUSH_ASKED_KEY, ...PUSH_ASKED_LEGACY_KEYS].some((k) => Boolean(localStorage.getItem(k)));
  } catch {
    // Storage unavailable (private mode): the ask cannot be remembered, so
    // it is not made at all rather than made on every finish.
    return true;
  }
}

function markAsked() {
  try {
    localStorage.setItem(PUSH_ASKED_KEY, "1");
  } catch {
    // nothing to do
  }
}

// Where this phone stands, as one NotifyStep. In a browser that is
// notifyStep (lib/elite/install.ts) and it is "none" when push is not
// configured. Inside the App Store app notifications are the phone's own
// (Apple's push service): "enable" when the phone has not been asked yet,
// "resync" when it has said yes.
async function currentStep(): Promise<NotifyStep> {
  if (isNativeApp()) {
    const step = await readNativePushStep();
    return step === "enable" ? "enable" : step === "resync" ? "resync" : "none";
  }
  if (!VAPID_PUBLIC_KEY) return "none";
  return readStep();
}

// Renders nothing. A phone that has already said yes is put back on file
// quietly on every visit, so a subscription the phone replaced finds its
// way back to the server. Mounted once in the player shell.
export function PushKeepAlive() {
  useEffect(() => {
    void currentStep()
      .then((step) => {
        if (step !== "resync") return;
        if (isNativeApp()) return registerNativePush();
        return saveSubscription();
      })
      .catch(() => undefined);
  }, []);
  return null;
}

// The one ask (A8). It is made once, right after the finish screen of a
// completed session: the moment a member can see why they would want to
// hear that the next week is live. What there is to ask is decided by
// finishAsk:
//   - a phone that can be asked: "Turn on notifications", one tap;
//   - an iPhone or iPad in a browser tab: how to add the app to the home
//     screen, the only place Apple offers push;
//   - asked before, already on, blocked, or the example player: nothing.
// `shown()` marks it asked, so it is never made twice. The Account page is
// where a member turns notifications on later.
export function useNotificationsAsk(enabled: boolean): { ask: FinishAsk; shown: () => void } {
  const [ask, setAsk] = useState<FinishAsk>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let live = true;
    void currentStep()
      .then((step) => {
        if (live) setAsk(finishAsk({ step, asked: wasAsked(), example: false }));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [enabled]);

  const shown = useCallback(() => markAsked(), []);
  return { ask, shown };
}

// The ask itself: one screen, one plain line of why, one button. Shown in
// place of the finish screen after the member taps Done there, then the
// session closes whatever they choose.
export function PushOptIn({ ask, onDone }: { ask: Exclude<FinishAsk, null>; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    try {
      if (isNativeApp()) {
        await enableNativePush();
      } else {
        const permission = await Notification.requestPermission();
        if (permission === "granted") await saveSubscription();
      }
    } catch {
      // best-effort: a failed subscribe just means no push, not a broken app
    } finally {
      setBusy(false);
      onDone();
    }
  }

  const install = ask === "install_ios";
  const Icon = install ? Share : Bell;

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-safe">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 text-center">
        <div className="flex min-h-full flex-col items-center justify-center py-6">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-accent/10 text-accent animate-rise">
            <Icon className="h-9 w-9" />
          </span>
          <h2 className="mt-6 font-display text-4xl font-black uppercase leading-[0.95] animate-rise [animation-delay:80ms]">
            {install ? "Add Strive Elite to your home screen" : "Turn on notifications"}
          </h2>
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-white/75 animate-rise [animation-delay:160ms]">
            {install
              ? "Tap the Share button in your browser, then tap Add to Home Screen. Open Strive Elite from your home screen and turn on notifications, so you know the moment your new week is live or your coach messages you."
              : "So you know the moment your new week is live, your coach messages you, or a Film Room is announced. Nothing else."}
          </p>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-white/60 animate-rise [animation-delay:220ms]">
            You can change this any time on your Account page.
          </p>
        </div>
      </div>

      <div className="px-4 pt-3 pb-safe">
        <div className="mx-auto max-w-md pb-3">
          {install ? (
            <button
              onClick={onDone}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black active:scale-[0.98]"
            >
              Got it
            </button>
          ) : (
            <>
              <button
                onClick={enable}
                disabled={busy}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? "One moment" : "Turn on notifications"}
              </button>
              <button
                onClick={onDone}
                disabled={busy}
                className="mt-1 flex h-12 w-full items-center justify-center text-[15px] font-medium text-white/65"
              >
                Not now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
