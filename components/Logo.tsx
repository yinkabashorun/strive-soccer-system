import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-gradient-to-br from-accent to-accent-deep">
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-black" fill="none">
            <path
              d="M4 12 L10 4 L20 4 L14 12 L20 20 L10 20 Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>
      <div className="leading-none">
        <div className="text-[15px] font-semibold tracking-tight text-bone">
          STRIVE<span className="text-accent">OS</span>
        </div>
        <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-muted">
          Soccer · Operating System
        </div>
      </div>
    </div>
  );
}
