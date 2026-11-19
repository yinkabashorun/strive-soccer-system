import { SUPPORT_EMAIL } from "@/lib/elite/support";
import { UNDER_AGE_LINE, UNDER_AGE_TITLE } from "@/lib/elite/tracker";

// What a player under 13 sees on the free app's sign-up: one plain screen,
// nothing stored. A parent can reach us about coaching.
export function UnderAge() {
  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-[22px] pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(96px+env(safe-area-inset-top))]">
      <h1 className="font-display text-[46px] font-black uppercase leading-[0.9]">{UNDER_AGE_TITLE}</h1>
      <p className="mt-3 text-[15.5px] leading-[1.4] text-white/70">{UNDER_AGE_LINE}</p>
      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Coaching for a younger player")}`}
        className="mt-auto flex min-h-[58px] w-full items-center justify-center rounded-[18px] bg-bone px-6 text-[16px] font-bold text-black"
      >
        {SUPPORT_EMAIL}
      </a>
    </div>
  );
}
