import { cn } from "@/lib/utils";

// Horizontal progress meter for a single development pillar. Shows the
// rating and an optional trend delta vs. the previous rating.
export function ProgressBar({
  label,
  value,
  prev,
  color = "#F5C518",
  className,
}: {
  label: string;
  value: number;
  prev?: number;
  color?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const delta = prev !== undefined ? value - prev : 0;
  return (
    <div className={cn("", className)}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium text-bone">{label}</span>
        <span className="flex items-baseline gap-2">
          <span className="font-display text-lg font-bold tabular-nums">
            {Math.round(clamped)}
          </span>
          {delta > 0 && (
            <span className="text-[11px] font-semibold text-accent">
              +{delta}
            </span>
          )}
          {delta < 0 && (
            <span className="text-[11px] font-semibold text-red-400">
              {delta}
            </span>
          )}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamped}%`,
            background: color,
            transition: "width 900ms cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </div>
    </div>
  );
}
