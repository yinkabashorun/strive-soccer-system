"use client";

import { useState, useTransition } from "react";
import { Brain, Check, Loader2 } from "lucide-react";
import { updatePlayerFields } from "@/lib/elite/coach-actions";

// The coach's freeform memory note on a player. Always fed to the AI when
// building a week, so it steers every plan. Saves on blur / button.
export function EditableMemory({
  playerId,
  initial,
}: {
  playerId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const dirty = value !== initial && !saved;

  function save() {
    setSaved(false);
    start(async () => {
      await updatePlayerFields(playerId, { coach_memory: value.trim() });
      setSaved(true);
    });
  }

  return (
    <div className="elite-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          <Brain className="h-3.5 w-3.5" /> AI memory note
        </div>
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
        ) : saved ? (
          <span className="flex items-center gap-1 text-[11px] text-accent">
            <Check className="h-3 w-3" /> Saved
          </span>
        ) : null}
      </div>
      <p className="mb-3 text-xs text-white/40">
        Your read on this player — how they respond, what to push, what to
        avoid. Fed to the AI every time you build a week.
      </p>
      <textarea
        rows={4}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={() => dirty && save()}
        placeholder="e.g. Responds to challenges, not repetition. Tight hamstrings — keep plyos controlled. Weak-foot block is mental."
        className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
      />
      {dirty && (
        <button onClick={save} className="btn mt-2 w-full py-2 text-sm">
          Save memory note
        </button>
      )}
    </div>
  );
}
