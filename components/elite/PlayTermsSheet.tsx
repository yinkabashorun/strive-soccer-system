"use client";

import { useState, useTransition } from "react";
import { acceptPlayTerms } from "@/lib/elite/club-teams-actions";
import { ORGANIZER_SHEET_LINE, ORGANIZER_SHEET_TITLE, PLAYER_SHEET_LINE, PLAYER_SHEET_TITLE } from "@/lib/elite/club-teams";
import { ActionSheet } from "./ActionSheet";

// The two one-time sheets (077), one tap each, recorded with the wording's
// version: the organizer sheet before a captain plans anything, the player
// sheet before a player's first "I'm in". After the tap, `then` runs the
// thing that was asked for.
export function PlayTermsSheet({
  kind,
  onClose,
  then,
}: {
  kind: "organizer" | "player";
  onClose: () => void;
  then: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const organizer = kind === "organizer";
  return (
    <ActionSheet label={organizer ? ORGANIZER_SHEET_TITLE : PLAYER_SHEET_TITLE} title={organizer ? ORGANIZER_SHEET_TITLE : PLAYER_SHEET_TITLE} onClose={onClose}>
      <div className="px-[22px] pb-2">
        <p className="text-[15px] leading-relaxed text-white/80">{organizer ? ORGANIZER_SHEET_LINE : PLAYER_SHEET_LINE}</p>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await acceptPlayTerms(kind).catch(() => ({ ok: false as const, error: "We could not reach the server. Try again in a minute." }));
              if (!res.ok) return setError(res.error);
              then();
            })
          }
          className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-bone text-[15px] font-bold text-black disabled:opacity-50"
        >
          {organizer ? "Got it, I'm organizing" : "Got it"}
        </button>
      </div>
    </ActionSheet>
  );
}
