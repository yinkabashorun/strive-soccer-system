"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deletePlayer } from "@/lib/elite/coach-actions";

// Two-tap permanent delete: first tap arms it, second tap (with the
// player's name spelled out) actually removes the player and all their
// data, then returns to the roster.
export function DeletePlayerButton({
  playerId,
  playerName,
}: {
  playerId: string;
  playerName: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onClick() {
    if (!armed) {
      setArmed(true);
      return;
    }
    start(async () => {
      const res = await deletePlayer(playerId);
      if (res.ok) router.replace("/coach");
    });
  }

  return (
    <div className="rounded-3xl border border-red-500/15 p-5">
      <button
        onClick={onClick}
        onBlur={() => setArmed(false)}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/10"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        {armed
          ? `Tap again to permanently delete ${playerName}`
          : "Remove player"}
      </button>
      {armed && !pending && (
        <p className="mt-2 text-center text-xs text-red-300/70">
          Deletes their plans, progress, messages, and film. No undo.
        </p>
      )}
    </div>
  );
}
