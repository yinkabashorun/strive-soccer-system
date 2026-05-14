"use client";

import { Bell, Command, Search } from "lucide-react";
import { motion } from "framer-motion";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-black/70 backdrop-blur-md">
      <div className="flex items-center gap-4 px-5 py-3 md:px-8">
        <div className="lg:hidden">
          <div className="h-8 w-8 rounded-lg bg-accent" />
        </div>

        <div className="hidden flex-1 md:block">
          <div className="group relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              placeholder="Search players, sessions, content…"
              className="w-full rounded-xl border border-white/5 bg-white/[0.03] py-2 pl-9 pr-12 text-sm text-bone placeholder:text-muted focus:border-white/15 focus:outline-none focus:ring-0"
            />
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              <span className="kbd flex items-center gap-1">
                <Command className="h-3 w-3" /> K
              </span>
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1.5 sm:flex"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Live · 3 sessions today
            </span>
          </motion.div>

          <button className="btn-ghost relative">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
          </button>

          <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] py-1 pl-1 pr-3">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-deep text-[11px] font-bold text-black">
              YB
            </div>
            <div className="hidden text-xs sm:block">
              <div className="font-semibold leading-tight text-bone">
                Coach Yinka Jonny
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                Founder
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
