"use client";

import { useState, useTransition } from "react";
import { setTrainingEnvironment } from "@/lib/elite/coach-actions";
import { cn } from "@/lib/utils";

// Coach-side Yes/No switch for a player's wall or goal access. The next
// generated plan uses the new value (wall days appear or disappear).
export function EnvToggle({
  playerId,
  field,
  value,
}: {
  playerId: string;
  field: "has_wall" | "has_goal";
  value: boolean | null;
}) {
  const [current, setCurrent] = useState<boolean | null>(value);
  const [pending, start] = useTransition();

  function set(next: boolean) {
    setCurrent(next);
    start(() => {
      setTrainingEnvironment(playerId, { [field]: next });
    });
  }

  return (
    <span className={cn("inline-flex gap-1", pending && "opacity-60")}>
      {([true, false] as const).map((v) => (
        <button
          key={String(v)}
          onClick={() => set(v)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
            current === v
              ? "border-accent/60 bg-accent/15 text-accent"
              : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/70"
          )}
        >
          {v ? "Yes" : "No"}
        </button>
      ))}
    </span>
  );
}
