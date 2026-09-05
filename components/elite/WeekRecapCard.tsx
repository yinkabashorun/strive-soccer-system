"use client";

import { useState } from "react";
import { Check, ClipboardCopy, MessageCircleHeart } from "lucide-react";
import type { WeekRecap } from "@/lib/elite/recap";
import { cn } from "@/lib/utils";

// The end-of-week parent text, ready to send: the data decides the tone
// (celebrate a full week, name what got skipped). Tap copy, paste, done.
export function WeekRecapCard({ recap }: { recap: WeekRecap }) {
  const [copied, setCopied] = useState(false);
  const all = recap.done === recap.total;

  async function copy() {
    try {
      await navigator.clipboard.writeText(recap.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable: the text is selectable below
    }
  }

  return (
    <section
      className={cn(
        "rounded-3xl border p-5",
        all ? "border-accent/35 bg-accent/[0.05]" : "border-amber-400/30 bg-amber-400/[0.04]"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
          <MessageCircleHeart className="h-4 w-4 text-accent" /> Week {recap.week} parent recap
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "font-display text-lg font-black",
              all ? "text-accent" : "text-amber-300"
            )}
          >
            {recap.done}/{recap.total}
          </span>
          <span className="text-white/40">sessions · {recap.minutes} min</span>
        </div>
      </div>

      <p className="mt-3 select-all whitespace-pre-line rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-white/80">
        {recap.text}
      </p>

      <button
        onClick={copy}
        className="btn-accent mt-3 px-4 py-2.5 text-sm"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" /> Copied
          </>
        ) : (
          <>
            <ClipboardCopy className="h-4 w-4" /> Copy to send to the parent
          </>
        )}
      </button>
    </section>
  );
}
