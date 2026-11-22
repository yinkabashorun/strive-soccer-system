import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
import { trackerFor } from "@/lib/elite/tracker-server";
import { eventsFor } from "@/lib/elite/club-teams-server";
import { FREE_WEEK } from "@/lib/elite/tracker";
import { FreeTopBar } from "@/components/elite/FreeTopBar";
import { IconCalendar } from "@/components/elite/FreeIcons";

export const metadata = { title: "Strive events · Strive Elite" };
export const dynamic = "force-dynamic";

// Strive events (the mock, screen 14): the events Strive itself runs, an
// extra on top of everything clubs plan for themselves. A captain enters
// the club with a roster; the spot is held once it is paid.
export default async function StriveEventsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_WEEK}`);
  if (!(await trackerFor(viewer))) redirect("/dashboard");
  const events = await eventsFor(viewer);

  return (
    <div>
      <FreeTopBar back={FREE_WEEK} title="Strive events" />
      <p className="px-[18px] pt-1 text-[13px] text-white/60">Run by Strive. Enter your club. Your spot is held once it is paid.</p>
      {events.length === 0 ? (
        <p className="px-8 py-12 text-center text-[14px] text-white/60">No Strive event is taking entries right now.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {events.map((e) => (
            <li key={e.id} className="mx-[18px] rounded-[24px] bg-[#141414] px-[18px] pb-4 pt-4">
              <span className="block text-[11px] font-bold uppercase tracking-[2.4px] text-accent">Strive event</span>
              <h2 className="mt-1.5 font-display text-[30px] font-black uppercase leading-[0.95]">{e.name}</h2>
              <p className="mt-2 flex items-center gap-1.5 text-[14px] text-white/70">
                <IconCalendar size={15} />
                {e.when} · {e.venue}
              </p>
              <p className="mt-1 text-[14px] text-white/70">
                Up to {e.roster_max} players, all {e.max_age} and under. {e.price_text}.
              </p>
              {e.clubs.length === 0 && (
                <p className="mt-3 text-[13px] text-white/60">Your club&apos;s captain enters the club.</p>
              )}
              <ul className="mt-3 space-y-2">
                {e.clubs.map((c) => (
                  <li key={c.clubId}>
                    {c.entered ? (
                      <Link
                        href={`/log/events/${e.id}?club=${c.clubId}`}
                        className="flex min-h-[48px] items-center justify-between gap-2 rounded-xl bg-[#1f1f1f] px-4 text-[14.5px]"
                      >
                        <span className="font-semibold">{c.clubName}</span>
                        <span className={c.state === "paid" ? "text-accent" : "text-white/70"}>{c.line}</span>
                      </Link>
                    ) : (
                      <Link
                        href={`/log/events/${e.id}?club=${c.clubId}`}
                        className="flex h-12 items-center justify-center rounded-xl bg-bone text-[15px] font-bold text-black"
                      >
                        Enter {c.clubName}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
