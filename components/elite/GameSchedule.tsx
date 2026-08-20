"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Loader2, MapPin, Star } from "lucide-react";
import type { Game } from "@/lib/elite/types";
import { addGame } from "@/lib/elite/player-actions";
import { cn } from "@/lib/utils";

// Player posts upcoming games. When Coach marks one, the card goes gold:
// "Coach is coming."
export function GameSchedule({ games }: { games: Game[] }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [opponent, setOpponent] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [pending, start] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = games.filter((g) => g.game_date >= today);
  const past = games.filter((g) => g.game_date < today);

  function submit() {
    setError(null);
    start(async () => {
      const res = await addGame({
        game_date: date,
        kickoff,
        opponent,
        location,
        notes: "",
      });
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      setAdded(true);
      setOpen(false);
    });
  }

  return (
    <div className="space-y-3">
      {upcoming.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
      {added && (
        <p className="text-sm text-white/50">
          Game added — Coach has been notified.
        </p>
      )}

      {!open ? (
        <button onClick={() => setOpen(true)} className="btn w-full py-3">
          <CalendarPlus className="h-4 w-4" /> Add a game
        </button>
      ) : (
        <div className="elite-card space-y-2 p-4">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-bone focus:border-accent/40 focus:outline-none"
            />
            <input
              value={kickoff}
              onChange={(e) => setKickoff(e.target.value)}
              placeholder="Kickoff (e.g. 10:30 AM)"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
            />
          </div>
          <input
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="Opponent"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Field / city (NoVA games especially)"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={pending || !date}
              className="btn-accent flex-1 py-2.5"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add game"}
            </button>
            <button onClick={() => setOpen(false)} className="btn px-4 py-2.5">
              Cancel
            </button>
          </div>
        </div>
      )}

      {upcoming.length === 0 && !open && !added && (
        <p className="text-sm text-white/40">
          Drop your game schedule — if it&apos;s in Northern Virginia, Coach
          might pull up.
        </p>
      )}

      {past.length > 0 && (
        <p className="text-xs text-white/30">{past.length} past game{past.length === 1 ? "" : "s"}</p>
      )}
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  const d = new Date(game.game_date + "T12:00:00Z");
  const dateLabel = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
  return (
    <div
      className={cn(
        "rounded-3xl border p-4",
        game.coach_attending
          ? "border-accent/40 bg-accent/[0.07]"
          : "border-white/10 bg-white/[0.02]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-lg font-black uppercase leading-tight">
            {dateLabel}
            {game.kickoff ? ` · ${game.kickoff}` : ""}
          </div>
          <div className="mt-0.5 truncate text-sm text-white/60">
            {game.opponent ? `vs ${game.opponent}` : "Game"}
            {game.location && (
              <span className="text-white/40">
                {" "}
                · <MapPin className="inline h-3 w-3" /> {game.location}
              </span>
            )}
          </div>
        </div>
        {game.coach_attending && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-black">
            <Star className="h-3.5 w-3.5" /> Coach is coming
          </span>
        )}
      </div>
    </div>
  );
}
