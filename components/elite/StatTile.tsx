import { cn } from "@/lib/utils";

// Compact statistic tile used on the dashboards and player profile.
export function StatTile({
  label,
  value,
  sub,
  accent = false,
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "elite-card p-4 sm:p-5",
        accent && "border-accent/20 bg-accent/[0.04]",
        className
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 font-display text-3xl font-black leading-none tabular-nums sm:text-4xl",
          accent ? "text-accent" : "text-bone"
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-xs text-white/45">{sub}</div>}
    </div>
  );
}
