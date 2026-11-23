"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { DAY_NAMES, DAY_SHORT, splitLine } from "@/lib/elite/tracker";

// "Which days will you train?" Seven big buttons, pick any, and the
// weekly target is spread over the days picked as a guide for each one.
// Used at the end of the set-up and again from Account to change the days.
export function DaysPicker({
  target,
  initial,
  submitLabel,
  saving,
  error,
  onSubmit,
}: {
  target: number; // the weekly target, in minutes
  initial: number[];
  submitLabel: string;
  saving: boolean;
  error: string | null;
  onSubmit: (days: number[]) => void;
}) {
  const [days, setDays] = useState<number[]>(initial);
  const toggle = (d: number) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((x, y) => x - y)));

  return (
    <div className="flex flex-1 flex-col pt-6">
      <h1 className="font-display text-4xl font-black uppercase leading-[0.95]">
        Which days will you train?
      </h1>
      <div className="mt-6 grid grid-cols-4 gap-2.5">
        {DAY_SHORT.map((label, d) => {
          const on = days.includes(d);
          return (
            <button
              key={d}
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-label={DAY_NAMES[d]}
              onClick={() => toggle(d)}
              className={
                "flex h-16 items-center justify-center rounded-2xl border text-[17px] font-semibold " +
                (on ? "border-white bg-white text-black" : "border-white/15 bg-white/[0.03] text-bone")
              }
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-5 min-h-[28px] text-[17px] leading-relaxed text-bone" aria-live="polite">
        {splitLine(target, days.length) ?? <span className="text-white/60">Pick at least one day.</span>}
      </p>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-auto pt-8">
        <button
          type="button"
          disabled={saving || days.length === 0}
          onClick={() => onSubmit(days)}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : submitLabel}
        </button>
      </div>
    </div>
  );
}
