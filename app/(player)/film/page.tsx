import { CalendarDays, Clapperboard } from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import { getFilm, getGames, getPlayer } from "@/lib/elite/data";
import { liveWeekFor, monthFromWeek } from "@/lib/elite/time";
import { getNextFilmRoom, getPlayerFilmRoomClips } from "@/lib/elite/film-room-data";
import { FilmRoomCard } from "@/components/elite/FilmRoomCard";
import { FilmTimeline } from "@/components/elite/FilmTimeline";
import { GameSchedule } from "@/components/elite/GameSchedule";
import { TourGuide } from "@/components/elite/TourGuide";

export const metadata = { title: "Film · Strive Elite" };

// The weekly Film Room (062): when it is, the Zoom link and the place to
// upload three to five clips. Below it, the monthly film timeline for a
// Complete member (retired tier, kept as it was) and the game schedule.
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
  const roomClips = room && !viewer.demo ? await getPlayerFilmRoomClips(viewer.playerId, room.id) : [];

  const currentMonth = monthFromWeek(liveWeekFor(player.week1_monday, player.current_week));
  const firstName = player.full_name.split(" ")[0];

  return (
    <div className="space-y-5">
      {viewer.demo && <TourGuide page="film" />}

      <header className="animate-fade-up">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          <Clapperboard className="h-3.5 w-3.5 text-accent" /> Every week
        </div>
        <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
          Film Room
        </h1>
        <p className="mt-2 text-white/50">
          Coach Yinka and Coach Gary go through your clips on Zoom: what&apos;s
          working, what&apos;s next.
        </p>
      </header>

      <FilmRoomCard
        room={room}
        clips={roomClips}
        playerId={viewer.playerId}
        firstName={firstName}
      />

      {player.tier !== "elite" && (
        <FilmTimeline
          films={films}
          currentMonth={currentMonth}
          firstName={firstName}
        />
      )}

      {/* Game schedule - Coach shows up to NoVA games */}
      <section className="pt-2">
        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
          <CalendarDays className="h-4 w-4 text-accent" /> Your games
        </h2>
        <GameSchedule games={games} />
      </section>
    </div>
  );
}
