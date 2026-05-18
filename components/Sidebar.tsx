"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarRange,
  ExternalLink,
  GraduationCap,
  Home,
  Megaphone,
  Radio,
  Settings,
  Sparkles,
  UserRound,
  Users,
  Webhook,
} from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Command Center", icon: Home },
  { href: "/sessions", label: "Sessions", icon: CalendarRange },
  { href: "/players", label: "Players", icon: Users },
  { href: "/course", label: "Course", icon: GraduationCap },
  { href: "/content", label: "AI Content Engine", icon: Sparkles },
  { href: "/admin/course-ads", label: "Course Ad Library", icon: Megaphone },
  { href: "/portal", label: "Player Portal", icon: UserRound },
  { href: "/integrations", label: "Integrations", icon: Webhook },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-white/5 bg-black/60 px-4 py-5 backdrop-blur-md lg:flex">
      <Logo className="px-2" />

      <nav className="mt-8 flex flex-col gap-0.5">
        <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
          Workspace
        </div>
        {nav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-white/[0.06] text-bone shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                  : "text-muted hover:bg-white/[0.03] hover:text-bone",
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  active ? "text-accent" : "text-muted group-hover:text-bone",
                )}
              />
              <span className="font-medium">{item.label}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_12px_2px_rgba(229,255,61,0.6)]" />
              )}
            </Link>
          );
        })}

        {/* External: the live public VSL */}
        <div className="mt-4 px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
          Live funnel
        </div>
        <Link
          href="/dribbling-course"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-all hover:bg-white/[0.03] hover:text-bone"
        >
          <BookOpen className="h-[18px] w-[18px] text-accent" />
          <span className="font-medium">Dribbling Course</span>
          <ExternalLink className="ml-auto h-3 w-3" />
        </Link>
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-ink-200 p-4">
          <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-accent/30 blur-2xl" />
          <div className="relative">
            <div className="chip-accent">$97</div>
            <div className="mt-3 text-sm font-semibold leading-snug">
              Strive Dribbling System
            </div>
            <div className="mt-1 text-xs text-muted">
              4 modules · lifetime access · 14-day refund.
            </div>
            <Link
              href="/admin/course-ads"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              Open ad library <Radio className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-muted hover:text-bone"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
