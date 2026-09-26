"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const DISMISS_KEY = "strive_push_dismissed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// A small, dismissible prompt to turn on real push notifications (new week
// live, coach messages) instead of the player only finding out by opening
// the app. Shown once per browser until they either enable it or dismiss
// it - never nags on every visit. Renders nothing if push isn't configured
// (no VAPID key) or the browser doesn't support it (no silent errors, no
// broken button).
export function PushOptIn() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // localStorage unavailable (private mode, etc.) - show the prompt anyway
    }
    setVisible(true);
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      });
      await fetch("/api/elite/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
    } catch {
      // best-effort: a failed subscribe just means no push, not a broken app
    } finally {
      setBusy(false);
      setVisible(false);
    }
  }

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // fine to skip persisting the dismissal
    }
  }

  if (!visible) return null;

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
          onClick={dismiss}
          className="rounded-xl px-3 py-2 text-sm text-white/40 hover:text-white/70"
        >
          Not now
        </button>
        <button
          onClick={enable}
          disabled={busy}
          className="rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {busy ? "..." : "Enable"}
        </button>
      </div>
    </div>
  );
}
