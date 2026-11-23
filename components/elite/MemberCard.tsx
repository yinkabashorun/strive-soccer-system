import { cn } from "@/lib/utils";

// The member card (Nov 21 2026, the door and the top of You): the Strive
// Elite wordmark, the member's name, member since and the tier. Earned by
// joining, nothing to pass. No member number on purpose: it would be a
// number we have to keep true (experience.md, Open).
//
// rise: the door's entrance, the card coming up with the light sweeping
// across it once. On You it simply sits there.
export function MemberCard({
  name,
  since,
  tier,
  rise = false,
  className,
  photo = null,
  handle = null,
}: {
  name: string;
  since: string | null;
  tier: string;
  rise?: boolean;
  className?: string;
  // the member's own photo and @username (081), when they have them
  photo?: string | null;
  handle?: string | null;
}) {
  const left = photo ? "left-[76px]" : "left-[22px]";
  return (
    <div className={cn("[perspective:900px]", className)}>
      <div
        className={cn(
          "relative h-[204px] overflow-hidden rounded-[22px] bg-[linear-gradient(150deg,#1d1d1d_0%,#0c0c0c_55%,#050505_100%)]",
          "shadow-[inset_0_0_0_1px_rgba(200,168,88,0.32),0_30px_60px_rgba(0,0,0,0.6)]",
          rise && "animate-card-rise [animation-delay:700ms]"
        )}
        role="img"
        aria-label={`Strive Elite member card. ${name}.${handle ? ` ${handle}.` : ""} ${since ?? ""}. ${tier}.`}
      >
        <div className="member-card-lines absolute inset-0" aria-hidden />
        <div className="absolute left-[22px] top-[22px] m-head text-[22px] tracking-[0.06em]" aria-hidden>
          Strive <span className="metal-text">Elite</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/strive-logo-512.png"
          alt=""
          aria-hidden
          className="absolute right-5 top-[18px] h-[38px] w-[38px] opacity-90 invert"
        />
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            aria-hidden
            className="absolute bottom-[22px] left-[22px] h-[42px] w-[42px] rounded-full object-cover shadow-[0_0_0_1.5px_rgba(200,168,88,0.55)]"
          />
        )}
        <div className={cn("absolute bottom-[44px] m-head text-[19px] tracking-[0.07em]", left)} aria-hidden>
          {name}
        </div>
        {(since || handle) && (
          <div className={cn("absolute bottom-[22px] text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60", left)} aria-hidden>
            {handle && <span className="normal-case tracking-normal text-white/75">{handle}</span>}
            {handle && since ? " · " : ""}
            {since}
          </div>
        )}
        <div className="metal-text absolute bottom-[20px] right-[22px] m-head text-[14px] tracking-[0.2em]" aria-hidden>
          {tier}
        </div>
        {rise && (
          <div
            className="member-card-sheen pointer-events-none absolute -bottom-[40%] -top-[40%] left-0 w-[90px] animate-sheen [animation-delay:1500ms]"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
