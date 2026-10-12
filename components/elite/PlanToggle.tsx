"use client";

import { useState, useTransition } from "react";
import { setTrainingPlan } from "@/lib/elite/coach-actions";
import type { TrainingLoad, TrainingSpace } from "@/lib/elite/types";
import { cn } from "@/lib/utils";

// Coach-side switch for a player's training load and space (033). The
// family picks both at onboarding; this overrides. Takes effect on the
// next generated plan, never on the week already built.
type Opt<T extends string> = { value: T; label: string };

function Toggle<T extends string>({
  options,
  value,
  onPick,
}: {
  options: Opt<T>[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <span className="inline-flex gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onPick(o.value)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
            value === o.value
              ? "border-accent/60 bg-accent/15 text-accent"
              : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/70"
          )}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export function LoadToggle({ playerId, value }: { playerId: string; value: TrainingLoad | null | undefined }) {
  const [current, setCurrent] = useState<TrainingLoad>(value ?? "in_season");
  const [pending, start] = useTransition();
  return (
    <span className={cn(pending && "opacity-60")}>
      <Toggle<TrainingLoad>
        options={[
          { value: "in_season", label: "In-Season · 4" },
          { value: "off_season", label: "Off-Season · 6" },
        ]}
        value={current}
        onPick={(v) => {
          setCurrent(v);
          start(() => {
            setTrainingPlan(playerId, { training_load: v });
          });
        }}
      />
    </span>
  );
}

export function SpaceToggle({ playerId, value }: { playerId: string; value: TrainingSpace | null | undefined }) {
  const [current, setCurrent] = useState<TrainingSpace>(value ?? "open");
  const [pending, start] = useTransition();
  return (
    <span className={cn(pending && "opacity-60")}>
      <Toggle<TrainingSpace>
        options={[
          { value: "open", label: "Open" },
          { value: "tight", label: "A few yards" },
        ]}
        value={current}
        onPick={(v) => {
          setCurrent(v);
          start(() => {
            setTrainingPlan(playerId, { space: v });
          });
        }}
      />
    </span>
  );
}
