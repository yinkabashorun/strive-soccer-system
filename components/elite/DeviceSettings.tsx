"use client";

import { useEffect, useState } from "react";
import { AUTOPLAY_PREF_KEY, FEEL_PREF_KEY } from "@/lib/elite/session-flow";
import { SOUND_PREF_KEY } from "@/lib/elite/set-timer";
import {
  VAPID_PUBLIC_KEY,
  hasSubscription,
  readStep,
  removeSubscription,
  saveSubscription,
} from "@/lib/elite/push-client";
import { isNativeApp } from "@/lib/elite/native";
import {
  disableNativePush,
  enableNativePush,
  readNativePushStep,
} from "@/lib/elite/native-push-client";
import { cn } from "@/lib/utils";

type Push = "loading" | "on" | "off" | "install" | "blocked" | "unavailable";

function readPref(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== "off";
  } catch {
    return true;
  }
}
function writePref(key: string, on: boolean) {
  try {
    if (on) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, "off");
  } catch {
    // storage blocked: the switch simply will not stick
  }
}

// The settings that belong to this phone, on the Account page:
// notifications (on, off, and a plain reason when they cannot be turned
// on from here), vibration, and whether drill demos play on their own.
// Nothing here is required to use the app.
export function DeviceSettings({ showNotifications }: { showNotifications: boolean }) {
  const [push, setPush] = useState<Push>("loading");
  const [busy, setBusy] = useState(false);
  const [feel, setFeel] = useState(true);
  const [autoplay, setAutoplay] = useState(true);
  const [sound, setSound] = useState(true);
  // Inside the App Store app the switch drives the phone's own
  // notifications instead of web push.
  const [native, setNative] = useState(false);

  useEffect(() => {
    setFeel(readPref(FEEL_PREF_KEY));
    setAutoplay(readPref(AUTOPLAY_PREF_KEY));
    setSound(readPref(SOUND_PREF_KEY));
    if (isNativeApp()) {
      setNative(true);
      void readNativePushStep().then((step) =>
        setPush(step === "resync" ? "on" : step === "blocked" ? "blocked" : "off")
      );
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setPush("unavailable");
      return;
    }
    const step = readStep();
    if (step === "install_ios") setPush("install");
    else if (step === "enable") setPush("off");
    else if (step === "resync") {
      void hasSubscription().then((has) => setPush(has ? "on" : "off"));
    } else {
      setPush(typeof Notification !== "undefined" && Notification.permission === "denied" ? "blocked" : "unavailable");
    }
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      if (native) {
        const step = await enableNativePush();
        setPush(step === "resync" ? "on" : step === "blocked" ? "blocked" : "off");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await saveSubscription();
        setPush("on");
      } else if (permission === "denied") {
        setPush("blocked");
      }
    } catch {
      // stays as it was
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      if (native) await disableNativePush();
      else await removeSubscription();
      setPush("off");
    } finally {
      setBusy(false);
    }
  }

  const pushLine: Record<Push, string> = {
    loading: "Checking this phone.",
    on: "On for this phone. New week, a message from your coach, Film Room.",
    off: "Off for this phone.",
    install:
      "On an iPhone, add Strive Elite to your home screen first: tap Share, then Add to Home Screen. Then turn them on here.",
    blocked: "Blocked for this app in your phone's settings. Allow them there, then come back.",
    unavailable: "Not available in this browser.",
  };

  return (
    <div className="divide-y divide-white/[0.06]">
      {showNotifications && (
        <div className="flex items-center gap-4 p-4">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-bone">Notifications</div>
            <div className="mt-0.5 text-sm text-white/60">{pushLine[push]}</div>
          </div>
          {(push === "on" || push === "off") && (
            <button
              onClick={() => void (push === "on" ? turnOff() : turnOn())}
              disabled={busy}
              className={cn(
                "shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60",
                push === "on" ? "border border-white/15 text-bone" : "bg-white text-black"
              )}
            >
              {busy ? "..." : push === "on" ? "Turn off" : "Turn on"}
            </button>
          )}
        </div>
      )}
      <Switch
        label="Vibration"
        detail="A light tap when you tick a drill or finish a session."
        on={feel}
        onChange={(v) => {
          setFeel(v);
          writePref(FEEL_PREF_KEY, v);
        }}
      />
      <Switch
        label="Timer sound"
        detail="A tone when a set or a rest starts and ends."
        on={sound}
        onChange={(v) => {
          setSound(v);
          writePref(SOUND_PREF_KEY, v);
        }}
      />
      <Switch
        label="Play drill demos automatically"
        detail="Muted, on a loop. Off means one tap to play."
        on={autoplay}
        onChange={(v) => {
          setAutoplay(v);
          writePref(AUTOPLAY_PREF_KEY, v);
        }}
      />
    </div>
  );
}

function Switch({
  label,
  detail,
  on,
  onChange,
}: {
  label: string;
  detail: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-4 p-4 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-bone">{label}</span>
        <span className="mt-0.5 block text-sm text-white/60">{detail}</span>
      </span>
      <span
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          on ? "bg-accent" : "bg-white/15"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
            on ? "translate-x-[22px]" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}
