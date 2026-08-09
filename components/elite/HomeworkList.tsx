"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, PlayCircle, StickyNote } from "lucide-react";
import type { Homework } from "@/lib/elite/types";
import { toggleHomework } from "@/lib/elite/player-actions";
import { cn } from "@/lib/utils";

// Interactive homework checklist. Optimistic completion with a live
// progress meter — works in demo mode and persists in real mode.
export function HomeworkList({
  items,
  readOnly = false,
}: {
  items: Homework[];
  readOnly?: boolean;
}) {
  const [state, setState] = useState<Record<string, boolean>>(
    () => Object.fromEntries(items.map((h) => [h.id, h.completed]))
  );
  const [, startTransition] = useTransition();

  const pct = useMemo(() => {
    const vals = Object.values(state);
    if (!vals.length) return 0;
    return Math.round((vals.filter(Boolean).length / vals.length) * 100);
  }, [state]);

  function toggle(id: string) {
    if (readOnly) return;
    const nextVal = !state[id];
    setState((s) => ({ ...s, [id]: nextVal }));
    startTransition(() => {
      toggleHomework(id, nextVal);
    });
  }

  if (!items.length) {
    return (
      <div className="elite-card p-8 text-center text-white/45">
        No homework assigned yet. Your coach will add this week&apos;s plan soon.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-accent"
            style={{
              width: `${pct}%`,
              transition: "width 500ms cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        </div>
        <span className="font-display text-lg font-bold tabular-nums">
          {pct}%
        </span>
      </div>

      <ul className="space-y-3">
        {items.map((h) => {
          const done = state[h.id];
          return (
            <li
              key={h.id}
              className={cn(
                "elite-card flex gap-4 p-4 transition-colors",
                done && "border-accent/20 bg-accent/[0.03]"
              )}
            >
              <button
                onClick={() => toggle(h.id)}
                disabled={readOnly}
                aria-label={done ? "Mark incomplete" : "Mark complete"}
                className={cn(
                  "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all",
                  done
                    ? "border-accent bg-accent text-black"
                    : "border-white/20 text-transparent hover:border-white/40",
                  readOnly && "cursor-default"
                )}
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h4
                    className={cn(
                      "font-semibold leading-snug",
                      done ? "text-white/50 line-through" : "text-bone"
                    )}
                  >
                    {h.title}
                  </h4>
                  <span className="chip shrink-0 whitespace-nowrap">
                    {h.reps}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-white/55">
                  {h.exercise}
                </p>
                {h.notes && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-white/45">
                    <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {h.notes}
                  </p>
                )}
                {h.video_url && (
                  <a
                    href={h.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                  >
                    <PlayCircle className="h-4 w-4" /> Watch reference
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
