import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
import { trackerFor } from "@/lib/elite/tracker-server";
import { nearYouFor } from "@/lib/elite/club-teams-server";
import { PENDING_GAMES_MAX, PLAN_REFUSED } from "@/lib/elite/club-teams";
import { FREE_WEEK } from "@/lib/elite/tracker";
import { Crest } from "@/components/elite/FreeAvatar";
import { FreeTopBar } from "@/components/elite/FreeTopBar";

export const metadata = { title: "Clubs near you · Strive Elite" };
export const dynamic = "force-dynamic";

// Clubs near you (the mock, screen 16), the captain only: the clubs in the
// club's own county that chose to be open to games, each with its crest,
// name, record and player count, and "Play them", which opens Plan with
// the club picked. Never a player's name. Clubs never message each other.
export default async function ClubsNearYouPage({ params }: { params: { id: string } }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_WEEK}`);
  if (!(await trackerFor(viewer))) redirect("/dashboard");
  const near = await nearYouFor(viewer, params.id);
  if (!near) notFound();

  return (
    <div>
      <FreeTopBar back={`/log/club/${params.id}`} />
      <div className="px-[18px] pt-2">
        <h1 className="font-display text-[44px] font-black uppercase leading-[0.9]">Clubs near you</h1>
        <p className="mt-1.5 text-[13px] text-white/60">
          {near.club.countyName ? `Open to games in ${near.club.countyName}.` : "Set your club's county from the club's menu first."}
        </p>
        {near.club.county && !near.club.open && (
          <p className="mt-2 text-[13px] leading-snug text-white/70">
            Your club is not open to games, so other captains cannot find it. Switch it on from the club&apos;s menu.
          </p>
        )}
        {near.pending >= PENDING_GAMES_MAX && <p className="mt-2 text-[13px] text-accent">{PLAN_REFUSED.too_many}</p>}
      </div>

      {near.rows.length === 0 ? (
        <p className="px-8 py-12 text-center text-[14px] text-white/60">
          No other club in your county is open to games yet. Send your club&apos;s link to captains you know.
        </p>
      ) : (
        <ul className="pt-4">
          {near.rows.map((r) => (
            <li key={r.id} className="flex h-[76px] items-center gap-3 border-b border-white/[0.08] px-[18px]">
              <Crest club={r} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold">{r.name}</span>
                <span className="mt-0.5 block text-[13px] text-white/60">
                  {r.record} · {r.members} {r.members === 1 ? "player" : "players"}
                </span>
              </span>
              {r.refusal ? (
                <span className="text-[12.5px] text-white/60">Not now</span>
              ) : (
                <Link
                  href={`/log/club/${params.id}/plan?vs=${r.id}`}
                  className="inline-flex h-11 items-center rounded-xl bg-bone px-4 text-[14.5px] font-bold text-black"
                >
                  Play them
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="px-[30px] pt-5 text-center text-[12.5px] leading-snug text-white/60">
        Clubs choose to be on this list. Only captains can send a game, and clubs never message each other.
      </p>
    </div>
  );
}
