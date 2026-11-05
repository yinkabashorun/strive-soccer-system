import { getCheckinDaysForCoach, getFilmRoomsForCoach } from "@/lib/elite/film-room-data";
import { defaultFilmRoom } from "@/lib/elite/film-room";
import { nyToday } from "@/lib/elite/time";
import { FilmRoomAdmin } from "@/components/elite/FilmRoomAdmin";
import { CheckinDaysAdmin } from "@/components/elite/CheckinDaysAdmin";

export const metadata = { title: "Calls · Strive Elite" };

// The Zoom side of Strive Elite (062, Coach Yinka Nov 5 2026): the weekly
// Film Room with Coach Gary and the monthly 1:1 check-in calls. Dates and
// times are Virginia time.
export default async function CoachCallsPage() {
  const [rooms, days] = await Promise.all([getFilmRoomsForCoach(), getCheckinDaysForCoach()]);
  const film = defaultFilmRoom(nyToday());
  return (
    <div className="space-y-10">
      <header className="animate-fade-up">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Zoom</div>
        <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">Calls</h1>
        <p className="mt-2 text-white/50">
          The weekly Film Room and the monthly check-ins. Announce one and every active member and parent
          gets a text, a push and a note in the app.
        </p>
      </header>
      <FilmRoomAdmin rooms={rooms} defaultDay={film.day} defaultTime={film.time} />
      <CheckinDaysAdmin days={days} defaultDay={nyToday()} />
    </div>
  );
}
