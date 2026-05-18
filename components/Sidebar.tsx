"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DollarSign,
  Film,
  Home,
  Library,
  Megaphone,
  Settings,
  Sparkles,
  Star,
  TrendingUp,
  Webhook,
} from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Command Center", icon: Home, group: "Sell" },
  { href: "/ugc", label: "AI UGC Generator", icon: Sparkles, group: "Sell" },
  { href: "/library", label: "Creative Library", icon: Library, group: "Sell" },
  { href: "/funnel", label: "VSL Funnel", icon: Megaphone, group: "Sell" },
  { href: "/sales", label: "Course Sales", icon: DollarSign, group: "Sell" },
  { href: "/clients", label: "Active Clients", icon: Star, group: "CRM" },
  { href: "/leads", label: "Leads", icon: TrendingUp, group: "CRM" },
  { href: "/integrations", label: "Integrations", icon: Webhook, group: "System" },
];

export function Sidebar() {
  const pathname = usePathname();
  const groups = Array.from(new Set(nav.map((n) => n.group)));

  return (
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-white/5 bg-black/60 px-4 py-5 backdrop-blur-md lg:flex">
      <Logo className="px-2" />

      <nav className="mt-8 flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group}>
            <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
              {group}
            </div>
            <div className="flex flex-col gap-0.5">
              {nav
                .filter((n) => n.group === group)
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
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                        active
                          ? "bg-white/[0.06] text-bone shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                          : "text-muted hover:bg-white/[0.03] hover:text-bone",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] transition-colors",
                          active
                            ? "text-accent"
                            : "text-muted group-hover:text-bone",
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
        <Link
          href="/funnel"
          className="relative overflow-hidden rounded-2xl border border-white/5 bg-ink-200 p-4 transition-colors hover:border-white/10"
        >
          <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-accent/30 blur-2xl" />
          <div className="relative">
            <div className="chip-accent">
              <Film className="h-3 w-3" />
              Funnel
            </div>
            <div className="mt-3 text-sm font-semibold leading-snug">
              Dribbling Course · $97
            </div>
            <div className="mt-1 text-xs text-muted">
              UGC ad → VSL → Stripe → GHL.
            </div>
          </div>
        </Link>

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
