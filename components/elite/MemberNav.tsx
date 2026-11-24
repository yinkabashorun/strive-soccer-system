"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Users, BookOpen, CalendarDays, Home, MessageSquare, UserRound, type LucideIcon } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { NotificationBell } from "./NotificationBell";
import { activeTab, type MemberTab } from "@/lib/elite/experience";
import { entranceBetween, setEntrance } from "@/lib/elite/tab-motion";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { EliteNotification } from "@/lib/elite/types";

const ICONS: Record<MemberTab["icon"], LucideIcon> = {
  home: Home,
  week: CalendarDays,
  courses: BookOpen,
  coach: MessageSquare,
  you: UserRound,
  friends: Users,
};

// The member app's navigation (approved mock v4, Nov 20 2026): on a phone,
// the four tabs (five with Coach) on a bar that fades out of the page, the
// lit tab in off-white with a small gold dot; the bell and the member's
// ring in the top corner. On a desktop, the same tabs as a left rail.
// Which tabs a member has is one rule (memberTabs, lib/elite/experience.ts).
export function MemberNav({
  tabs,
  name,
  weekDone,
  notifications,
  photo = null,
}: {
  tabs: MemberTab[];
  name: string;
  // This week's sessions done, 0 to 1: the gold arc around the photo.
  weekDone: number;
  notifications?: EliteNotification[];
  // the member's own profile photo (081), else their initials
  photo?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const current = activeTab(pathname, tabs);
  // The tab lights the moment a finger lands on it, not when the next
  // screen has arrived (Nov 23 2026: "when im clicking things there is a
  // delay"). Put back to the real tab once the screen has changed.
  const [pressed, setPressed] = useState<string | null>(null);
  useEffect(() => setPressed(null), [pathname]);
  const lit = pressed ?? current;

  // Every tab is fetched ahead, the moment the app opens and again when it
  // comes back to the front, so the first tap on any of them is already on
  // the phone (next.config.js staleTimes keeps it there).
  const hrefs = tabs.map((t) => t.href).join("|");
  useEffect(() => {
    const all = hrefs.split("|").filter(Boolean);
    const warm = () => all.forEach((h) => router.prefetch(h));
    warm();
    const onShow = () => {
      if (document.visibilityState === "visible") warm();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, [hrefs, router]);

  const press = (href: string) => {
    if (href === current) return;
    setPressed(href);
    const from = tabs.findIndex((t) => t.href === current);
    const to = tabs.findIndex((t) => t.href === href);
    setEntrance(entranceBetween(from, to, "tap"));
  };

  return (
    <>
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-white/5 bg-black px-4 py-6 lg:flex">
        <div className="flex items-start justify-between px-2">
          <Wordmark size="md" />
          {notifications && <NotificationBell initial={notifications} />}
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {tabs.map((t) => {
            const Icon = ICONS[t.icon];
            const on = lit === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                prefetch
                aria-current={t.href === current ? "page" : undefined}
                data-lit={on ? "true" : undefined}
                onPointerDown={() => press(t.href)}
                className={cn(
                  "no-press flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors",
                  on ? "bg-white/[0.06] text-bone" : "text-white/55 hover:text-bone"
                )}
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Phone: the bell and the member's ring, top right */}
      <div className="pointer-events-none absolute right-3 top-[calc(env(safe-area-inset-top)+12px)] z-30 flex items-center gap-1 lg:hidden">
        <div className="pointer-events-auto">{notifications && <NotificationBell initial={notifications} />}</div>
        <Link href="/you" aria-label="You" onPointerDown={() => press("/you")} className="pointer-events-auto grid h-[52px] w-[52px] place-items-center">
          <MemberRing name={name} done={weekDone} photo={photo} />
        </Link>
      </div>

      {/* Phone: the tab bar */}
      {tabs.length > 1 && (
        <nav
          aria-label="Tabs"
          // Solid black wherever a tab sits, so nothing reads through the
          // labels; a short fade above it lets the page slip under softly.
          className="fixed inset-x-0 bottom-0 z-40 bg-black pb-safe before:pointer-events-none before:absolute before:inset-x-0 before:-top-7 before:h-7 before:bg-[linear-gradient(180deg,rgba(0,0,0,0),#000)] before:content-[''] lg:hidden"
        >
          <div className="mx-auto flex max-w-md items-stretch justify-around px-3 pt-3">
            {tabs.map((t) => {
              const Icon = ICONS[t.icon];
              const on = lit === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  prefetch
                  aria-current={t.href === current ? "page" : undefined}
                  data-lit={on ? "true" : undefined}
                  // pointerdown, not click: the tab answers as the finger lands
                  onPointerDown={() => press(t.href)}
                  // a finger that slides off the tab before it lifts did not choose it
                  onPointerUp={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) setPressed(null);
                  }}
                  onPointerCancel={() => setPressed(null)}
                  className="no-press group flex min-h-[56px] flex-1 flex-col items-center justify-center pb-1"
                >
                  <Icon
                    className={cn(
                      "h-6 w-6 transition-[color,transform] duration-150 ease-out group-active:scale-[0.86]",
                      on ? "text-bone" : "text-white/50"
                    )}
                    strokeWidth={on ? 2.1 : 1.8}
                  />
                  <span className={cn("mt-1 text-[11.5px] font-semibold transition-colors duration-150", on ? "text-bone" : "text-white/50")}>{t.label}</span>
                  <span className={cn("mt-1 h-1 w-1 rounded-full transition-[background-color,transform] duration-200", on ? "scale-100 bg-gold" : "scale-0 bg-transparent")} aria-hidden />
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

// The member's photo (or initials) inside a ring that fills gold as the week's sessions are
// done. Only ever what was done: an empty ring is a fresh week.
export function MemberRing({ name, done, size = 44, photo = null }: { name: string; done: number; size?: number; photo?: string | null }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, Math.max(0, done));
  return (
    <span className="relative grid place-items-center" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 46 46" className="absolute inset-0 h-full w-full -rotate-90">
        <defs>
          <linearGradient id="member-ring-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f0dca0" />
            <stop offset=".45" stopColor="#c8a858" />
            <stop offset="1" stopColor="#8c6d2c" />
          </linearGradient>
        </defs>
        <circle cx="23" cy="23" r={r} fill="none" stroke="#161616" strokeWidth="3.5" />
        {frac > 0 && (
          <circle
            cx="23"
            cy="23"
            r={r}
            fill="none"
            stroke="url(#member-ring-gold)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - frac)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        )}
      </svg>
      {photo ? (
        // the member's own photo, from our own route: the same address for
        // as long as the photo is the same, so it is loaded once
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" decoding="async" className="rounded-full object-cover" style={{ width: Math.round(size * 0.773), height: Math.round(size * 0.773) }} />
      ) : (
        <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[linear-gradient(145deg,#262626,#141414)] text-[12px] font-semibold tracking-wide text-bone">
          {initials(name)}
        </span>
      )}
    </span>
  );
}
