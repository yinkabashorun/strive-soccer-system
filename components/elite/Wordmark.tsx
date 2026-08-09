import Link from "next/link";
import { cn } from "@/lib/utils";

// Strive Elite wordmark — Barlow Condensed, uppercase, with the ELITE
// tag in the Strive accent. Matches the brand's bold display type.
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
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };
  const inner = (
    <span
      className={cn(
        "font-display font-black uppercase tracking-[0.02em] leading-none",
        sizes[size],
        className
      )}
    >
      Strive<span className="text-accent">&nbsp;Elite</span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex items-center">
      {inner}
    </Link>
  );
}
