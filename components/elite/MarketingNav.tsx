"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { cn } from "@/lib/utils";

const links = [
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled || open
          ? "border-b border-white/5 bg-black/80 backdrop-blur-xl"
          : "bg-transparent"
      )}
    >
      <div className="pt-safe">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Wordmark />

          <nav className="hidden items-center gap-8 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-white/60 transition-colors hover:text-white"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="text-sm font-medium text-white/60 transition-colors hover:text-white"
            >
              Log in
            </Link>
            <Link href="/signup" className="btn-accent">
              Get Started
            </Link>
          </nav>

          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white md:hidden"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden">
          <nav className="flex flex-col gap-1 px-5 pb-6 pt-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl px-3 py-3 text-lg font-medium text-white/80 hover:bg-white/5"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="rounded-xl px-3 py-3 text-lg font-medium text-white/80 hover:bg-white/5"
            >
              Log in
            </Link>
            <Link href="/signup" className="btn-accent mt-2 w-full py-3 text-base">
              Get Started
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
