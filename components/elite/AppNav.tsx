"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Clipboard,
  Film,
  Home,
  LogOut,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Wordmark } from "./Wordmark";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/elite/auth-actions";

export type NavItem = { href: string; label: string; icon: string };

const ICONS: Record<string, LucideIcon> = {
  Home,
  Clipboard,
  BarChart3,
  Film,
  Users,
};

// Responsive shell navigation: a left rail on desktop, a thumb-friendly
// bottom tab bar on mobile. Shared by the player and coach areas.
export function AppNav({
  items,
  name,
  color,
  roleLabel,
}: {
  items: NavItem[];
  name: string;
  color?: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === pathname || (href !== "/" && pathname?.startsWith(href));

  return (
    <>
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-white/5 bg-black/40 px-4 py-6 backdrop-blur-md lg:flex">
        <div className="px-2">
          <Wordmark size="md" />
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/30">
            {roleLabel}
          </div>
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          {items.map((item) => {
            const Icon = ICONS[item.icon] ?? Home;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-white/[0.06] text-bone"
                    : "text-white/50 hover:bg-white/[0.03] hover:text-bone"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px]",
                    active ? "text-accent" : "text-white/40 group-hover:text-bone"
                  )}
                />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
            <Avatar name={name} color={color} size={38} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-bone">
                {name}
              </div>
              <div className="text-[11px] text-white/40">{roleLabel}</div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="grid h-8 w-8 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/5 bg-black/70 px-5 py-3 backdrop-blur-xl pt-safe lg:hidden">
        <Wordmark size="sm" />
        <div className="flex items-center gap-3">
          <Avatar name={name} color={color} size={32} />
          <form action={signOut}>
            <button
              type="submit"
              className="grid h-9 w-9 place-items-center rounded-lg text-white/50 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </form>
        </div>
      </div>

      {/* Mobile bottom tab bar (only when there's more than one tab) */}
      {items.length > 1 && (
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-black/85 backdrop-blur-xl pb-safe lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {items.map((item) => {
            const Icon = ICONS[item.icon] ?? Home;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-1 flex-col items-center gap-1 py-2.5"
              >
                <Icon
                  className={cn(
                    "h-[22px] w-[22px] transition-colors",
                    active ? "text-accent" : "text-white/40"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    active ? "text-bone" : "text-white/40"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
      )}
    </>
  );
}
