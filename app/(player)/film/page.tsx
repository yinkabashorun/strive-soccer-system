import { Clapperboard } from "lucide-react";
import { redirect } from "next/navigation";
import { featureOn } from "@/lib/elite/tiers";
import { getViewer } from "@/lib/elite/session";
import { getFilm, getGames, getPlayer } from "@/lib/elite/data";
import { liveWeekFor, monthFromWeek, nyToday } from "@/lib/elite/time";
import { getNextFilmRoom, getPlayerFilmRoomClips } from "@/lib/elite/film-room-data";
import { FilmRoomCard } from "@/components/elite/FilmRoomCard";
import { FilmTimeline } from "@/components/elite/FilmTimeline";
import { GameSchedule } from "@/components/elite/GameSchedule";
import { Fold } from "@/components/elite/Fold";
import { TourGuide } from "@/components/elite/TourGuide";

export const metadata = { title: "Film · Strive Elite" };

// The weekly Film Room (062): when it is, the Zoom link and the place to
// upload three to five clips. For most members that one card is the whole
// page. Below it, the monthly film timeline for a Complete member (retired
// tier, kept as it was), and the game schedule folded into one line.
export default async function FilmPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const [player, films, games, room] = await Promise.all([
    getPlayer(viewer.playerId),
    getFilm(viewer.playerId),
    getGames(viewer.playerId),
    getNextFilmRoom(),
  ]);
  if (!player) return null;
  // Not in every offer (Strive Pro, 074): the tab is not drawn, and an
  // old link lands on Home instead of a page they cannot use.
  if (!featureOn(player.tier, "filmRoom")) redirect("/dashboard");
  const roomClips = room && !viewer.demo ? await getPlayerFilmRoomClips(viewer.playerId, room.id) : [];

  const currentMonth = monthFromWeek(liveWeekFor(player.week1_monday, player.current_week));
  const firstName = player.full_name.split(" ")[0];
  const comingUp = games.filter((g) => g.game_date >= nyToday()).length;
  const gamesHint = comingUp === 0 ? "Add a game" : comingUp === 1 ? "1 coming up" : `${comingUp} coming up`;

  return (
    <div className="space-y-5">
      {viewer.demo && <TourGuide page="film" />}

      <header className="animate-fade-up">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
          <Clapperboard className="h-3.5 w-3.5 text-accent" /> Every week
        </div>
        <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
          Film Room
        </h1>
      </header>

      <FilmRoomCard
        room={room}
        clips={roomClips}
        playerId={viewer.playerId}
        firstName={firstName}
      />

      {featureOn(player.tier, "filmTimeline") && (
        <FilmTimeline
          films={films}
          currentMonth={currentMonth}
          firstName={firstName}
        />
      )}

      {/* Game schedule - Coach shows up to NoVA games. One line until
          opened, so the Film Room card is the page. */}
      <Fold title="Your games" hint={gamesHint}>
        <GameSchedule games={games} />
      </Fold>
    </div>
  );
}
