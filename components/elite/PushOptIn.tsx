"use client";

import { useEffect, useState } from "react";
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

// The one ask, on the finish screen of a completed session (A8): the
// moment a member can see why they would want to hear that the next week
// is live. What it shows is decided by finishAsk:
//   - a phone that can be asked: "Turn on notifications", one tap;
//   - an iPhone or iPad in a browser tab: how to add the app to the home
//     screen, the only place Apple offers push;
//   - asked before, already on, blocked, or the example player: nothing.
// It is marked asked the moment it is shown, so it is never shown twice.
// The Account page is where a member turns notifications on later.
export function PushOptIn({ example = false }: { example?: boolean }) {
  const [ask, setAsk] = useState<FinishAsk>(null);
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState<"on" | "later" | null>(null);

  useEffect(() => {
    if (example || typeof window === "undefined") return;
    let live = true;
    void currentStep()
      .then((step) => {
        if (!live) return;
        const next = finishAsk({ step, asked: wasAsked(), example });
        if (!next) return;
        markAsked();
        setAsk(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [example]);

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
      setAnswered("on");
    }
  }

  if (!ask) return null;

  if (answered) {
    return (
      <p className="mt-5 max-w-xs text-sm text-white/60" role="status">
        {answered === "on"
          ? "Done. You can change this any time on your Account page."
          : "No problem. You can turn notifications on any time on your Account page."}
      </p>
    );
  }

  if (ask === "install_ios") {
    return (
      <div className="mt-5 w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left animate-rise [animation-delay:700ms]">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
            <Share className="h-4 w-4" />
          </span>
          <div className="text-[15px] font-semibold text-bone">Add Strive Elite to your home screen</div>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          Tap the Share button in your browser, then tap Add to Home Screen. Open Strive Elite
          from your home screen and turn on notifications, so you know the moment your new week
          is live or your coach messages you.
        </p>
        <button
          onClick={() => setAnswered("later")}
          className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-white/15 text-sm font-semibold text-bone"
        >
          Got it
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left animate-rise [animation-delay:700ms]">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
          <Bell className="h-4 w-4" />
        </span>
        <div className="text-[15px] font-semibold text-bone">Turn on notifications</div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/65">
        So you know the moment your new week is live, your coach messages you, or a Film Room is
        announced. Nothing else.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setAnswered("later")}
          className="flex h-11 flex-1 items-center justify-center rounded-xl text-sm font-medium text-white/60"
        >
          Not now
        </button>
        <button
          onClick={enable}
          disabled={busy}
          className="flex h-11 flex-1 items-center justify-center rounded-xl border border-white/25 text-sm font-semibold text-bone disabled:opacity-60"
        >
          {busy ? "One moment" : "Turn on"}
        </button>
      </div>
    </div>
  );
}
