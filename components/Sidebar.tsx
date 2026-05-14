"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarRange,
  GraduationCap,
  Home,
  Inbox,
  Radio,
  Sparkles,
  Target,
  UserRound,
  Users,
  Settings,
  Wand2,
  Webhook,
} from "lucide-react";
import { Logo } from "./Logo";
import { cn, formatCurrency } from "@/lib/utils";
import { moneyOnTable, summerProgress } from "@/lib/pipeline";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  section: "ops" | "content" | "more";
};

const nav: NavItem[] = [
  // Ops
  { href: "/", label: "Command Center", icon: Home, section: "ops" },
  { href: "/pipeline", label: "Pipeline", icon: Target, section: "ops" },
  { href: "/sessions", label: "Sessions", icon: CalendarRange, section: "ops" },
  { href: "/players", label: "Players", icon: Users, section: "ops" },
  // Content
  { href: "/studio", label: "AI Ad Studio", icon: Wand2, section: "content" },
  { href: "/queue", label: "Queue", icon: Inbox, section: "content" },
  { href: "/content", label: "Content Engine", icon: Sparkles, section: "content" },
  { href: "/course", label: "Course", icon: GraduationCap, section: "content" },
  // More
  { href: "/portal", label: "Player Portal", icon: UserRound, section: "more" },
  { href: "/integrations", label: "Integrations", icon: Webhook, section: "more" },
];

const SECTIONS: Array<{ key: NavItem["section"]; label: string }> = [
  { key: "ops", label: "Operations" },
  { key: "content", label: "Content" },
  { key: "more", label: "More" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-white/5 bg-black/60 px-4 py-5 backdrop-blur-md lg:flex">
      <Logo className="px-2" />

      <nav className="mt-8 flex flex-col gap-3 overflow-y-auto pr-1 scrollbar-thin">
        {SECTIONS.map((section) => (
          <div key={section.key}>
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
              {section.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {nav
                .filter((item) => item.section === section.key)
                .map((item) => {
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
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all",
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
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <SidebarMoneyChip />

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

function SidebarMoneyChip() {
  const m = moneyOnTable();
  const s = summerProgress();
  return (
    <Link
      href="/pipeline"
      className="group relative block overflow-hidden rounded-2xl border border-accent/20 bg-ink-200 p-4 transition-colors hover:border-accent/40"
    >
      <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-accent/30 blur-2xl" />
      <div className="relative">
        <div className="chip-accent">
          <Radio className="h-3 w-3" />
          On the table
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <div className="h-display text-2xl font-semibold tabular-nums">
            {formatCurrency(m.totalUncollected)}
          </div>
        </div>
        <div className="mt-0.5 text-[11px] text-muted">
          {m.uncollectedCount} open · {s.daysUntilSessions}d to first session
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft"
            style={{ width: `${Math.max(2, Math.min(100, s.pct * 100))}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted">
          <span>Summer</span>
          <span className="text-bone">{(s.pct * 100).toFixed(1)}%</span>
        </div>
      </div>
    </Link>
  );
}
