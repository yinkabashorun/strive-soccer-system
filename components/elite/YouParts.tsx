import { cn } from "@/lib/utils";
import { fmtDuration } from "@/lib/elite/time-trained";

// The earned pieces of the member app (approved mock v4): the gold ring,
// the hours medals and the weekly bars. Gold, in the metal gradient, only
// ever marks what the player did.

// One gradient for every ring on a page; ids are per size so two rings on
// one page never fight over it.
function GoldDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f0dca0" />
        <stop offset=".45" stopColor="#c8a858" />
        <stop offset="1" stopColor="#8c6d2c" />
      </linearGradient>
    </defs>
  );
}

export function GoldRing({
  size,
  value,
  big,
  small,
  stroke = 10,
  className,
}: {
  size: number;
  value: number; // 0 to 1
  big: string;
  small: string;
  stroke?: number;
  className?: string;
}) {
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  const id = `gold-ring-${size}`;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <GoldDefs id={id} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#161616" strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v)}
            className="ring-draw"
            style={{ ["--ring" as string]: `${c}` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="m-num text-[28px] leading-none">{big}</span>
        <span className="mt-1 text-[11.5px] text-white/60">{small}</span>
      </div>
    </div>
  );
}

// "1H", "3H", "10" ... a disc of metal when earned, a dim one for the next.
export function HoursMedal({ hours, earned }: { hours: number; earned: boolean }) {
  const label = hours < 10 ? `${hours}H` : `${hours}`;
  return (
    <div className="flex-1 text-center">
      <div
        className={cn(
          "mx-auto grid h-[68px] w-[68px] place-items-center rounded-full font-display text-[20px] font-bold",
          earned
            ? "metal-disc shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_0_0_3px_#000,0_0_0_4px_rgba(200,168,88,0.55)]"
            : "bg-fill-2 text-white/50 shadow-[0_0_0_3px_#000,0_0_0_4.5px_rgba(255,255,255,0.07)]"
        )}
        aria-hidden
      >
        {label}
      </div>
      <div className="mt-2 text-[12px] text-white/60">
        {hours === 1 ? "1 hour" : `${hours} hours`}
        <span className="sr-only">{earned ? ", earned" : ", next up"}</span>
      </div>
    </div>
  );
}

// The last weeks as bars, the week being trained in metal. A week with no
// training is a short grey stub, never an empty gap or a red mark.
export function WeeklyChart({ bars, liveWeek }: { bars: { week: number; minutes: number }[]; liveWeek: number }) {
  const max = Math.max(30, ...bars.map((b) => b.minutes));
  return (
    <section aria-label="Minutes trained, week by week" className="flex h-[150px] items-end gap-2">
      {bars.map((b) => {
        const now = b.week === liveWeek;
        const h = Math.max(8, Math.round((b.minutes / max) * 118));
        return (
          <div key={b.week} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div
              className={cn("w-full origin-bottom rounded-[8px_8px_4px_4px] animate-rise", now ? "bg-metal" : "bg-fill-2")}
              style={{ height: h }}
              title={`Week ${b.week}: ${fmtDuration(b.minutes)}`}
            />
            <span className={cn("text-[11px]", now ? "text-bone" : "text-white/50")}>{now ? "Now" : `W${b.week}`}</span>
          </div>
        );
      })}
    </section>
  );
}
