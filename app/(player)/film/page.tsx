import { CalendarDays, Clapperboard } from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import { getFilm, getGames, getPlayer } from "@/lib/elite/data";
import { monthFromWeek } from "@/lib/elite/time";
import { FilmTimeline } from "@/components/elite/FilmTimeline";
import { GameSchedule } from "@/components/elite/GameSchedule";

export const metadata = { title: "Film · Strive Elite" };

// Monthly film review — Month 1, Month 2, Month 3. One link per month,
// one coach breakdown per month.
export default async function FilmPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const [player, films, games] = await Promise.all([
    getPlayer(viewer.playerId),
    getFilm(viewer.playerId),
    getGames(viewer.playerId),
  ]);
  if (!player) return null;

  const currentMonth = monthFromWeek(player.current_week);
  const firstName = player.full_name.split(" ")[0];

  return (
    <div className="space-y-5">
      <header className="animate-fade-up">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          <Clapperboard className="h-3.5 w-3.5 text-accent" /> Month {currentMonth}
        </div>
        <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
          Film review
        </h1>
        <p className="mt-2 text-white/50">
          Once a month, Coach breaks down your real footage — what&apos;s
          working, what&apos;s next.
        </p>
      </header>

      <FilmTimeline
        films={films}
        currentMonth={currentMonth}
        firstName={firstName}
      />

      {/* Game schedule — Coach shows up to NoVA games */}
      <section className="pt-2">
        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
          <CalendarDays className="h-4 w-4 text-accent" /> Your games
        </h2>
        <GameSchedule games={games} />
      </section>
    </div>
  );
}
