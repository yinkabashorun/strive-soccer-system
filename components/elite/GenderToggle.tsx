"use client";

import { useState, useTransition } from "react";
import { updatePlayerFields } from "@/lib/elite/coach-actions";
import { cn } from "@/lib/utils";

// Coach-side Boy/Girl switch. Required at onboarding for new players, but
// existing players never got asked - this is the only way to add it for
// them. Lets AI-generated copy (parent weekly report) use correct
// pronouns instead of avoiding them entirely.
export function GenderToggle({
  playerId,
  value,
}: {
  playerId: string;
  value: "boy" | "girl" | null;
}) {
  const [current, setCurrent] = useState<"boy" | "girl" | null>(value);
  const [pending, start] = useTransition();

  function set(next: "boy" | "girl") {
    setCurrent(next);
    start(() => {
      updatePlayerFields(playerId, { gender: next });
    });
  }

  return (
    <span className={cn("inline-flex gap-1", pending && "opacity-60")}>
      {(["boy", "girl"] as const).map((v) => (
        <button
          key={v}
          onClick={() => set(v)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize transition-colors",
            current === v
              ? "border-accent/60 bg-accent/15 text-accent"
              : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/70"
          )}
        >
          {v}
        </button>
      ))}
    </span>
  );
}
