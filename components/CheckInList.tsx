"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Avatar } from "./Avatar";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CheckInList({ players }: { players: Player[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {players.map((p) => {
        const isIn = checked.has(p.id);
        return (
          <motion.div
            layout
            key={p.id}
            className={cn(
              "rounded-2xl border p-4 transition-colors",
              isIn
                ? "border-accent/30 bg-accent/[0.05]"
                : "border-white/5 bg-ink-200/40"
            )}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggle(p.id)}
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-all",
                  isIn
                    ? "border-accent bg-accent text-black shadow-glow"
                    : "border-white/10 bg-white/[0.03] text-muted hover:text-bone"
                )}
              >
                {isIn ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Avatar
                    name={p.name}
                    color={p.avatarColor}
                    size={36}
                    className="ring-0"
                  />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-semibold">{p.name}</div>
                  <span className="chip text-[10px]">{p.level}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  Age {p.age} · {p.sessionsRemaining} sessions left ·{" "}
                  <span
                    className={
                      p.paymentStatus === "Paid"
                        ? "text-accent"
                        : "text-red-300"
                    }
                  >
                    {p.paymentStatus}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2">
              <Sparkles className="mt-2 h-3.5 w-3.5 shrink-0 text-muted" />
              <textarea
                value={notes[p.id] ?? ""}
                onChange={(e) =>
                  setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))
                }
                placeholder="Progress note · e.g. cleaner first touch, scanning before receiving…"
                className="w-full resize-none rounded-lg border border-white/5 bg-black/30 p-2 text-xs text-bone placeholder:text-muted focus:border-white/10 focus:outline-none"
                rows={2}
              />
            </div>
          </motion.div>
        );
      })}
      {players.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted">
          No players enrolled yet. Add players to begin check-in.
        </div>
      )}
    </div>
  );
}
