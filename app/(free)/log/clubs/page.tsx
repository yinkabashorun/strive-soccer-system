import { redirect } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
import { nyToday } from "@/lib/elite/time";
import { fmtDuration } from "@/lib/elite/time-trained";
import { trackerFor } from "@/lib/elite/tracker-server";
import { clubRankingFor } from "@/lib/elite/tracker-ranking";
import { FREE_WEEK, RANKING_MIN_MEMBERS, type RankingRow } from "@/lib/elite/tracker";
import { Crest } from "@/components/elite/FreeAvatar";
import { FreeTopBar } from "@/components/elite/FreeTopBar";

export const metadata = { title: "Top clubs · Strive Elite" };
export const dynamic = "force-dynamic";

// Top clubs (the mock, screen 8): every club of three or more across the
// app, by the average training a member logged this week. Club names
// only, never a player's. The top three side by side, first in the
// middle; your own clubs in gold.
export default async function TopClubsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_WEEK}`);
  if (!(await trackerFor(viewer))) redirect("/dashboard");
  const { rows } = await clubRankingFor(viewer, nyToday());
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const firstThree = [top[1], top[0], top[2]].filter((r): r is RankingRow => Boolean(r));

  return (
    <div>
      <FreeTopBar back={FREE_WEEK} />
      <div className="px-[18px] pt-2">
        <h1 className="font-display text-[44px] font-black uppercase leading-[0.9]">Top clubs</h1>
        <p className="mt-1.5 text-[13px] text-white/60">This week, by training per player. Starts again Monday.</p>
      </div>

      {rows.length === 0 ? (
        <p className="px-8 py-12 text-center text-[14px] text-white/60">
          No club has {RANKING_MIN_MEMBERS} players yet. Start one from My week and send its link.
        </p>
      ) : (
        <>
          <ol className="flex items-end gap-2 px-[18px] pb-1 pt-[18px]">
            {firstThree.map((r) => (
              <li
                key={r.id}
                className={
                  "flex-1 rounded-[20px] px-2 pb-3.5 text-center " +
                  (r.place === 1 ? "bg-gradient-to-b from-[#26210f] to-[#141414] pt-6" : "bg-[#141414] pt-4") +
                  (r.mine ? " shadow-[inset_0_0_0_1.5px_#d4af37]" : "")
                }
              >
                <Crest club={r} size={58} className="mx-auto mb-2.5" />
                <span className={"block font-display text-[15px] font-black " + (r.place === 1 ? "text-accent" : "text-white/60")}>
                  {r.place}
                </span>
                <span className="mt-0.5 block min-h-[32px] text-[13px] font-bold leading-[1.2]">
                  {r.name}
                  {r.mine && <span className="block text-[11px] text-accent">Your club</span>}
                </span>
                <b className="mt-1.5 block font-display text-[25px] font-black leading-none">{fmtDuration(r.average)}</b>
                <span className="text-[11px] text-white/60">per player</span>
              </li>
            ))}
          </ol>
          <ol className="pt-2">
            {rest.map((r) => (
              <li key={r.id} className="flex h-[62px] items-center gap-3 border-b border-white/[0.08] px-[18px]">
                <span className="w-5 font-display text-[20px] font-black text-white/60">{r.place}</span>
                <Crest club={r} size={40} />
                <span className="min-w-0">
                  <span className={"block truncate text-[15px] font-semibold " + (r.mine ? "text-accent" : "")}>{r.name}</span>
                  <span className="mt-0.5 block text-[12px] text-white/60">
                    {r.members} players{r.mine ? ". Your club" : ""}
                  </span>
                </span>
                <span className="ml-auto text-right font-display text-[22px] font-black leading-none">
                  {fmtDuration(r.average)}
                  <span className="block font-sans text-[11px] font-medium normal-case text-white/60">per player</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="px-[30px] pt-4 text-center text-[12.5px] text-white/50">Clubs with {RANKING_MIN_MEMBERS} or more players.</p>
        </>
      )}
    </div>
  );
}
