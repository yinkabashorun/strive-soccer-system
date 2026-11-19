import { crestOf } from "@/lib/elite/tracker";

// A player's face in the free app: their profile photo when the server
// handed one over (a short-lived signed address, only to people who may
// see it), else their initials. "You" is gold, the way the mock draws it.
export function FreeAvatar({
  photo,
  initials,
  size,
  you = false,
  className = "",
}: {
  photo?: string | null;
  initials: string;
  size: number;
  you?: boolean;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.33)) };
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" aria-hidden width={size} height={size} style={style} className={"shrink-0 rounded-full object-cover " + className} />;
  }
  return (
    <span
      aria-hidden
      style={style}
      className={
        "grid shrink-0 place-items-center rounded-full font-bold " +
        (you ? "bg-accent text-black" : "bg-gradient-to-br from-[#2c2c2c] to-[#1a1a1a] text-[#ddd]") +
        " " +
        className
      }
    >
      {initials}
    </span>
  );
}

// A club's crest: a shield with two characters on one of six colour pairs
// picked from the club's id (lib/elite/tracker.ts crestOf).
export function Crest({ club, size, className = "" }: { club: { id: string; name: string }; size: number; className?: string }) {
  const c = crestOf(club);
  const shield = Math.round(size * 0.53);
  return (
    <span
      aria-hidden
      className={"grid shrink-0 place-items-center rounded-full " + className}
      style={{ width: size, height: size, background: `linear-gradient(150deg, ${c.from}, ${c.to})` }}
    >
      <svg viewBox="0 0 34 38" width={shield} height={Math.round(shield * 1.12)}>
        <path d="M17 1l15 5v12c0 9.5-6.4 16.2-15 19C8.4 34.2 2 27.5 2 18V6z" fill={c.shield} />
        <text x="17" y="24" textAnchor="middle" fontFamily="'Barlow Condensed', sans-serif" fontWeight={900} fontSize={15} fill={c.ink}>
          {c.letters}
        </text>
      </svg>
    </span>
  );
}

// The aura ring around a profile photo, with the level badge under it.
export function AuraRing({
  progress,
  level,
  size,
  label,
  children,
}: {
  progress: number;
  level: number;
  size: number;
  label?: string; // what a screen reader says for the badge ("Aura Level 3")
  children: React.ReactNode;
}) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#262626" strokeWidth={3} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#d4af37"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.02, Math.min(1, progress)) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute grid place-items-center" style={{ inset: Math.round(size * 0.073) }}>
        {children}
      </div>
      <span
        aria-label={label}
        className={
          "absolute bottom-[-7px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[9px] border-[2.5px] border-black bg-accent pb-px pt-[2px] font-display font-black leading-none text-black " +
          (size >= 80 ? "px-[9px] text-[15px]" : "px-[7px] text-[12px]")
        }
      >
        LVL {level}
      </span>
    </div>
  );
}
