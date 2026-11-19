"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// One quiet line that opens in place. For the parts of a screen a member
// reaches for now and then, so the thing the screen is for stays first
// and the screen stays short. A full-width, 56 px target.
export function Fold({
  title,
  hint,
  children,
  defaultOpen = false,
}: {
  title: string;
  hint?: string; // a few words on the right, e.g. "2 coming up"
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 text-left"
      >
        <span className="text-[15px] font-semibold text-bone">{title}</span>
        <span className="flex items-center gap-2 text-[13px] text-white/60">
          {hint}
          <ChevronDown className={cn("h-4 w-4 text-white/50 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div id={id} className="mt-3 animate-fade-up">
          {children}
        </div>
      )}
    </section>
  );
}
