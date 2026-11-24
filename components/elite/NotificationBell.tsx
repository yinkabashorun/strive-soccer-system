"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { EliteNotification } from "@/lib/elite/types";
import { markAllNotificationsRead } from "@/lib/elite/player-actions";
import { badgeText, bellList, openBell, unreadCount } from "@/lib/elite/bell";
import { cleanNoticePath } from "@/lib/elite/notices";
import { cn, timeAgo } from "@/lib/utils";

// In-app notification bell for the player. Opening the list is reading
// it: everything is marked read (saved behind the screen; a no-op for the
// example player) and the red count clears at once. The notes that were
// new stay marked with a gold dot until the list is closed. Rules in
// lib/elite/bell.ts.
//
// A note that says where it goes (elite_notifications.url, migration 088)
// is a link to that page of ours: a tap opens it in this same window and
// closes the list, so nothing ever leaves the app for Safari. A note from
// before 088 has no address and stays plain text.
export function NotificationBell({
  initial,
}: {
  initial: EliteNotification[];
}) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState<string[]>([]);
  const [, start] = useTransition();

  const unread = unreadCount(items);
  const badge = badgeText(unread);
  const shown = bellList(items);

  function toggle() {
    if (open) {
      setOpen(false);
      setFresh([]);
      return;
    }
    const next = openBell(items);
    setItems(next.items);
    setFresh(next.fresh);
    setOpen(true);
    if (next.fresh.length > 0) {
      start(() => {
        void markAllNotificationsRead();
      });
    }
  }

  function close() {
    setOpen(false);
    setFresh([]);
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} new` : "Notifications"}
        aria-expanded={open}
        className="relative grid h-11 w-11 place-items-center rounded-xl text-white/60 transition-colors hover:bg-white/5 hover:text-white"
      >
        <Bell className="h-5 w-5" />
        {badge && (
          <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
          <div
            role="dialog"
            aria-label="Notifications"
            className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+4.5rem)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-ink-100 shadow-lift lg:absolute lg:inset-x-auto lg:left-0 lg:top-auto lg:mt-2 lg:w-80"
          >
            <div className="border-b border-white/[0.06] px-4 py-3">
              <span className="font-display text-sm font-bold uppercase tracking-tight">
                Notifications
              </span>
            </div>
            <div className="max-h-[60svh] overflow-y-auto">
              {shown.length === 0 ? (
                <div className="p-6 text-center text-sm text-white/60">
                  Nothing new. Your coach&apos;s messages and each new week show up here.
                </div>
              ) : (
                shown.map((n) => {
                  const isFresh = fresh.includes(n.id);
                  const path = cleanNoticePath(n.url);
                  const row = cn(
                    "flex min-h-[44px] gap-3 border-b border-white/5 px-4 py-3 last:border-b-0",
                    isFresh && "bg-accent/[0.04]",
                    path && "transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
                  );
                  const inside = (
                    <>
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          isFresh ? "bg-accent" : "bg-transparent"
                        )}
                      />
                      <span className={cn("min-w-0 flex-1", !path && "select-text")}>
                        <span className="block text-sm font-semibold text-bone">
                          {isFresh && <span className="sr-only">New: </span>}
                          {n.title}
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-relaxed text-white/60">
                          {n.body}
                        </span>
                        <span className="mt-1 block text-[11px] text-white/50">
                          {timeAgo(n.created_at)}
                        </span>
                      </span>
                    </>
                  );
                  return path ? (
                    <Link key={n.id} href={path} onClick={close} className={row}>
                      {inside}
                    </Link>
                  ) : (
                    <div key={n.id} className={row}>
                      {inside}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
