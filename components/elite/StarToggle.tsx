"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setStar } from "@/lib/elite/tracker-actions";
import { STAR_LABEL } from "@/lib/elite/tracker";
import { StarMark } from "./StarMark";

// The coach's star for one free player, with the coaches' private note.
// The player sees the star next to their name; they never see the note.
export function StarToggle({ profileId, name, starred, note }: { profileId: string; name: string; starred: boolean; note: string }) {
  const router = useRouter();
  const [on, setOn] = useState(starred);
  const [text, setText] = useState(note);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function save(nextOn: boolean, nextNote: string) {
    setError(null);
    start(async () => {
      const res = await setStar(profileId, nextOn, nextNote);
      if (!res.ok) return setError(res.error);
      setOn(nextOn);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="min-w-[180px]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          aria-pressed={on}
          aria-label={on ? `Take the star back from ${name}` : `Star ${name}`}
          onClick={() => (on ? save(false, "") : setEditing(true))}
          className={
            "grid h-11 w-11 place-items-center rounded-full border disabled:opacity-60 " +
            (on ? "border-accent/60" : "border-white/15 text-white/40")
          }
        >
          {on ? <StarMark size={18} /> : <span className="text-[18px] leading-none">☆</span>}
        </button>
        {on && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="min-h-[44px] text-left text-[13px] text-white/70 underline">
            {text ? text : "Add a note"}
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-2">
          <textarea
            value={text}
            maxLength={280}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Why the star (coaches only)"
            className="w-full rounded-lg border border-white/15 bg-black p-2 text-[14px] text-bone placeholder:text-white/50"
          />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => save(true, text)}
              className="h-11 rounded-lg border border-white/15 px-3 text-[13px] font-semibold text-bone disabled:opacity-60"
            >
              {on ? "Save note" : "Give the star"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="h-11 px-3 text-[13px] text-white/70">
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      <span className="sr-only">{on ? STAR_LABEL : ""}</span>
    </div>
  );
}
