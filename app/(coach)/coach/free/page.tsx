import { redirect } from "next/navigation";
import { FreeAdmin } from "@/components/elite/FreeAdmin";
import { getViewer } from "@/lib/elite/session";
import { APP_URL } from "@/lib/elite/app-url";
import { nyToday } from "@/lib/elite/time";
import { fmtDuration } from "@/lib/elite/time-trained";
import { demoOverview, getFreeOverview } from "@/lib/elite/tracker-server";
import { GOALS, GRADES, LEVELS, labelOf } from "@/lib/elite/tracker";

export const metadata = { title: "Free training log · Strive Elite" };
export const dynamic = "force-dynamic";

// The coach's view of the free training log (migration 069): the switch
// that opens or closes free sign-up, the link to hand out, the two
// recommended targets, and everyone who has a free account.
export default async function CoachFreePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/coach/free");
  if (viewer.role === "player") redirect("/dashboard");

  const data = viewer.demo ? demoOverview(nyToday()) : await getFreeOverview();
  const joinedOn = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    });

  return (
    <div>
      <h1 className="font-display text-4xl font-black uppercase tracking-tight">Free training log</h1>
      <p className="mt-1 max-w-2xl text-sm text-white/60">
        A free account logs the training a player does on their own against a weekly target. No
        drills, no courses, no plan. Free accounts never appear on the roster.
      </p>

      <FreeAdmin open={data.open} joinUrl={`${APP_URL}/join`} targets={data.targets} />

      <div className="mt-8 grid max-w-md grid-cols-2 gap-3">
        <div className="elite-card p-4">
          <div className="font-display text-3xl font-black tabular-nums">{data.accounts.length}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/50">Accounts</div>
        </div>
        <div className="elite-card p-4">
          <div className="font-display text-3xl font-black tabular-nums">{fmtDuration(data.week_minutes)}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/50">Trained this week</div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.08]">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-white/50">
            <tr className="border-b border-white/[0.08]">
              {["Name", "Phone", "Grade", "Level", "Goal", "This week", "Gym this week", "All time", "Joined", "Referrals"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.accounts.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-white/60">
                  Nobody has a free account yet.
                </td>
              </tr>
            )}
            {data.accounts.map((a) => (
              <tr key={a.profile_id} className="border-b border-white/[0.05] last:border-0">
                <td className="px-4 py-3 font-semibold text-bone">{a.name || "No name"}</td>
                <td className="px-4 py-3 text-white/70">{a.phone || ""}</td>
                <td className="px-4 py-3 text-white/70">{labelOf(GRADES, a.grade)}</td>
                <td className="px-4 py-3 text-white/70">{labelOf(LEVELS, a.level)}</td>
                <td className="px-4 py-3 text-white/70">{labelOf(GOALS, a.goal)}</td>
                <td className="px-4 py-3 tabular-nums text-bone">{fmtDuration(a.week_minutes)}</td>
                <td className="px-4 py-3 tabular-nums text-white/70">
                  {a.gym_week_minutes ? fmtDuration(a.gym_week_minutes) : ""}
                </td>
                <td className="px-4 py-3 tabular-nums text-white/70">{fmtDuration(a.all_minutes)}</td>
                <td className="px-4 py-3 text-white/70">{joinedOn(a.joined)}</td>
                <td className="px-4 py-3 tabular-nums text-white/70">{a.referrals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
