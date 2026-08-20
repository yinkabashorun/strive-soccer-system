"use client";

import { useState, useTransition } from "react";
import { Loader2, MapPin, Star } from "lucide-react";
import type { Game } from "@/lib/elite/types";
import { setGameAttendance } from "@/lib/elite/coach-actions";
import { cn } from "@/lib/utils";

// Coach view of a player's upcoming games with an "I'll be there" toggle.
// Marking attendance notifies the player.
export function CoachGamesPanel({
  playerId,
  games,
}: {
  playerId: string;
  games: Game[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = games.filter((g) => g.game_date >= today);

  if (upcoming.length === 0) {
    return (
      <div className="elite-card p-5 text-center text-sm text-white/40">
        No upcoming games posted. When they add one, decide here if
        you&apos;re pulling up.
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {upcoming.map((g) => (
        <GameRow key={g.id} playerId={playerId} game={g} />
      ))}
    </div>
  );
}

function GameRow({ playerId, game }: { playerId: string; game: Game }) {
  const [attending, setAttending] = useState(game.coach_attending);
  const [pending, start] = useTransition();

  const d = new Date(game.game_date + "T12:00:00Z");
  const dateLabel = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });

  function toggle() {
    const next = !attending;
    setAttending(next);
    start(async () => {
      await setGameAttendance(game.id, playerId, next, dateLabel);
    });
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border p-3.5",
        attending
          ? "border-accent/35 bg-accent/[0.06]"
          : "border-white/10 bg-white/[0.02]"
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-bone">
          {dateLabel}
          {game.kickoff ? ` · ${game.kickoff}` : ""}
          {game.opponent ? ` · vs ${game.opponent}` : ""}
        </div>
        {game.location && (
          <div className="mt-0.5 flex items-center gap-1 text-xs text-white/45">
            <MapPin className="h-3 w-3" /> {game.location}
          </div>
        )}
      </div>
      <button
        onClick={toggle}
        disabled={pending}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all",
          attending
            ? "border-accent bg-accent text-black"
            : "border-white/15 text-white/50 hover:border-accent/40 hover:text-accent"
        )}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Star className="h-3.5 w-3.5" />
        )}
        {attending ? "I'm going" : "I'll be there"}
      </button>
    </div>
  );
}
