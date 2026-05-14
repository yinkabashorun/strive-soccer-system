import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({
  name,
  color,
  size = 36,
  className,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      style={{ width: size, height: size, background: color ?? "#222226" }}
      className={cn(
        "grid place-items-center rounded-full text-[11px] font-bold tracking-wide text-black ring-1 ring-white/10",
        className
      )}
    >
      {initials(name)}
    </div>
  );
}
