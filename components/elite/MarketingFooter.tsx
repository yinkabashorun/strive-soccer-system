import Link from "next/link";
import { Instagram, Mail } from "lucide-react";
import { Wordmark } from "./Wordmark";

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/5 pb-safe">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Wordmark href="/" size="lg" />
            <p className="mt-4 text-sm leading-relaxed text-white/45">
              The complete development system for serious players. Built by
              Strive Soccer FC — for the players, by the players.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <FooterCol
              title="Platform"
              items={[
                { href: "/pricing", label: "Pricing" },
                { href: "/signup", label: "Get Started" },
                { href: "/login", label: "Log in" },
              ]}
            />
            <FooterCol
              title="Company"
              items={[
                { href: "/about", label: "About" },
                { href: "/contact", label: "Contact" },
              ]}
            />
            <div>
              <div className="eyebrow mb-4">Follow</div>
              <div className="flex gap-3">
                <a
                  href="https://www.instagram.com/strivesoccerfc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/70 transition-colors hover:border-white/25 hover:text-white"
                  aria-label="Instagram"
                >
                  <Instagram className="h-[18px] w-[18px]" />
                </a>
                <a
                  href="mailto:strivesoccerdevelope@gmail.com"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/70 transition-colors hover:border-white/25 hover:text-white"
                  aria-label="Email"
                >
                  <Mail className="h-[18px] w-[18px]" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/5 pt-6 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} Strive Soccer FC. All rights reserved.
          </span>
          <span>DMV · For the Players. By the Players.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  return (
    <div>
      <div className="eyebrow mb-4">{title}</div>
      <ul className="space-y-3">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="text-sm text-white/55 transition-colors hover:text-white"
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
