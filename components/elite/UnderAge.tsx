import { SUPPORT_EMAIL } from "@/lib/elite/support";
import { UNDER_AGE_LINE, UNDER_AGE_TITLE } from "@/lib/elite/tracker";

// What a player under 13 sees on the free app's sign-up: one plain screen,
// nothing stored. A parent can reach us about coaching.
export function UnderAge() {
  return (
    <div className="elite-card p-7 sm:p-8">
      <h1 className="font-display text-3xl font-black uppercase tracking-tight">{UNDER_AGE_TITLE}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-white/70">{UNDER_AGE_LINE}</p>
      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Coaching for a younger player")}`}
        className="btn-accent mt-6 flex min-h-[48px] w-full items-center px-6 text-base"
      >
        {SUPPORT_EMAIL}
      </a>
    </div>
  );
}
