import { cn } from "@/lib/utils";

// Circular progress ring used for weekly progress / completion. SVG-based,
// theme-agnostic, animates the stroke on mount via CSS transition.
export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  label,
  sublabel,
  color = "#F5C518",
  className,
}: {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <div className="font-display text-3xl font-black leading-none">
          {label ?? `${Math.round(clamped)}%`}
        </div>
        {sublabel && (
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}
