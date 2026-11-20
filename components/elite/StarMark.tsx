import { STAR_LABEL } from "@/lib/elite/tracker";

// The coaches' star: a small gold mark beside a player's name wherever the
// name shows. Only a coach gives it (lib/elite/tracker-actions.ts setStar);
// the screen reader hears what it means.
export function StarMark({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      role="img"
      aria-label={STAR_LABEL}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={"inline-block shrink-0 align-[-0.1em] text-accent " + className}
    >
      <title>{STAR_LABEL}</title>
      <path
        fill="currentColor"
        d="M12 2.2l2.92 6.06 6.66.84-4.9 4.6 1.25 6.6L12 17.08 6.07 20.3l1.25-6.6-4.9-4.6 6.66-.84z"
      />
    </svg>
  );
}
