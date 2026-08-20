import Link from "next/link";
/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

// Strive Elite wordmark — the round Strive Soccer badge next to Barlow
// Condensed display type. The badge is white-circle artwork, so it reads
// as a clean coin on the dark ground.
export function Wordmark({
  className,
  href = "/",
  size = "md",
}: {
  className?: string;
  href?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: { text: "text-lg", logo: 24 },
    md: { text: "text-xl", logo: 28 },
    lg: { text: "text-2xl", logo: 44 },
  };
  const s = sizes[size];
  const inner = (
    <span className="inline-flex items-center gap-2.5">
      <img
        src="/strive-logo-512.png"
        alt="Strive Soccer"
        width={s.logo}
        height={s.logo}
        className="rounded-full"
      />
      <span
        className={cn(
          "font-display font-black uppercase tracking-[0.02em] leading-none",
          s.text,
          className
        )}
      >
        Strive<span className="text-accent">&nbsp;Elite</span>
      </span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center">
      {inner}
    </Link>
  );
}
