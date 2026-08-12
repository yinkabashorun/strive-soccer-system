"use client";

import { useState, useTransition } from "react";
import { Bell, Check } from "lucide-react";
import type { EliteNotification } from "@/lib/elite/types";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/elite/player-actions";
import { cn, timeAgo } from "@/lib/utils";

// In-app notification bell for the player. Shows unread count and a
// dropdown; marking read persists (no-op in demo).
export function NotificationBell({
  initial,
}: {
  initial: EliteNotification[];
}) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  const unread = items.filter((n) => !n.read).length;

  function openMenu() {
    setOpen((v) => !v);
  }

  function readOne(id: string) {
    setItems((s) => s.map((n) => (n.id === id ? { ...n, read: true } : n)));
    start(() => {
      markNotificationRead(id);
    });
  }

  function readAll() {
    setItems((s) => s.map((n) => ({ ...n, read: true })));
    start(() => {
      markAllNotificationsRead();
    });
  }

  return (
    <div className="relative">
      <button
        onClick={openMenu}
        aria-label="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/5 hover:text-white"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-ink-100 shadow-lift">
            <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
              <span className="font-display text-sm font-bold uppercase tracking-tight">
                Notifications
              </span>
              {unread > 0 && (
                <button
                  onClick={readAll}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-6 text-center text-sm text-white/45">
                  You&apos;re all caught up.
                </div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => readOne(n.id)}
                    className={cn(
                      "flex w-full gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]",
                      !n.read && "bg-accent/[0.04]"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.read ? "bg-transparent" : "bg-accent"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-bone">
                        {n.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-white/55">
                        {n.body}
                      </span>
                      <span className="mt-1 block text-[10px] text-white/30">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                    {n.read && (
                      <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-white/25" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
