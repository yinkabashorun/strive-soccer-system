"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { updatePlayerArrays } from "@/lib/elite/coach-actions";

type Field = "goals" | "strengths" | "weaknesses";

// Instantly-saving editable list of short strings (goals / strengths /
// weaknesses) for the coach's player profile.
export function EditableChips({
  playerId,
  field,
  label,
  initial,
  accent = false,
}: {
  playerId: string;
  field: Field;
  label: string;
  initial: string[];
  accent?: boolean;
}) {
  const [items, setItems] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [, start] = useTransition();

  function persist(next: string[]) {
    setItems(next);
    start(() => {
      updatePlayerArrays(playerId, { [field]: next });
    });
  }

  function add() {
    const v = draft.trim();
    if (!v) return;
    persist([...items, v]);
    setDraft("");
  }

  return (
    <div className="elite-card p-5">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <span
            key={i}
            className={
              "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm " +
              (accent
                ? "border-accent/25 bg-accent/[0.06] text-bone"
                : "border-white/10 bg-white/[0.03] text-white/75")
            }
          >
            {it}
            <button
              onClick={() => persist(items.filter((_, idx) => idx !== i))}
              className="text-white/30 transition-colors hover:text-red-400"
              aria-label={`Remove ${it}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-sm text-white/30">Nothing added yet.</span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={`Add to ${label.toLowerCase()}…`}
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
        />
        <button onClick={add} className="btn px-3 py-2" aria-label="Add">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
