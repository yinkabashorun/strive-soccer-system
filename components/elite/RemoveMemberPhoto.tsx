"use client";

import { useState, useTransition } from "react";
import { removeMemberPhoto } from "@/lib/elite/coach-actions";

// On a member's page: take their profile photo off, when it should not be
// there. The photo is required (081), so the member is asked for a new one
// the next time they open the app. Asks once before it does it.
export function RemoveMemberPhoto({ playerId }: { playerId: string }) {
  const [sure, setSure] = useState(false);
  const [busy, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      {!sure ? (
        <button type="button" onClick={() => setSure(true)} className="tap text-white/55 underline-offset-4 hover:underline">
          Remove photo
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const res = await removeMemberPhoto(playerId);
              setNote(res.ok ? "Removed. They are asked for a new one." : "That did not work. Try again.");
              setSure(false);
            })
          }
          className="tap font-semibold text-red-300 underline-offset-4 hover:underline"
        >
          {busy ? "Removing" : "Remove it, ask for a new one"}
        </button>
      )}
      {note && <span className="text-white/55">{note}</span>}
    </span>
  );
}
