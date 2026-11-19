import { redirect } from "next/navigation";
import { FreeAdmin } from "@/components/elite/FreeAdmin";
import { ReportsQueue } from "@/components/elite/ReportsQueue";
import { ClubsAdmin } from "@/components/elite/ClubsAdmin";
import { getViewer } from "@/lib/elite/session";
import { APP_URL } from "@/lib/elite/app-url";
import { nyToday } from "@/lib/elite/time";
import { fmtDuration } from "@/lib/elite/time-trained";
import { demoOverview, getFreeOverview } from "@/lib/elite/tracker-coach";
import { GOALS, GRADES, LEVELS, labelOf } from "@/lib/elite/tracker";

export const metadata = { title: "Free app · Strive Elite" };
export const dynamic = "force-dynamic";

// The coach's view of the free app (migration 069): reported posts first
// (remove or no action), then the switch that opens or closes free
// sign-up, the link to hand out, the two recommended targets, and
// everyone who has a free account.
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
      <h1 className="font-display text-4xl font-black uppercase tracking-tight">Free app</h1>
      <p className="mt-1 max-w-2xl text-sm text-white/60">
        A free account posts a photo of the training a player does on their own, sees the friends
        it added by link do the same, and keeps a week against a target on the days it planned.
        No drills, no courses, no plan from us. 13 and older. Free accounts never appear on the
        roster.
      </p>

      <ReportsQueue reports={data.reports} />

      <ClubsAdmin clubs={data.clubs} reports={data.clubReports} appUrl={APP_URL} />

      <FreeAdmin open={data.open} joinUrl={`${APP_URL}/join`} targets={data.targets} />

      <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="elite-card p-4">
          <div className="font-display text-3xl font-black tabular-nums">{data.accounts.length}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/50">Accounts</div>
        </div>
        <div className="elite-card p-4">
          <div className="font-display text-3xl font-black tabular-nums">{fmtDuration(data.week_minutes)}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/50">Trained this week</div>
        </div>
        <div className="elite-card p-4">
          <div className="font-display text-3xl font-black tabular-nums">{data.posts_week}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/50">Posts this week</div>
        </div>
        <div className="elite-card p-4">
          <div
            className={
              "font-display text-3xl font-black tabular-nums" +
              (data.reports.length + data.clubReports.length ? " text-red-400" : "")
            }
          >
            {data.reports.length + data.clubReports.length}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/50">Open reports</div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.08]">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-white/50">
            <tr className="border-b border-white/[0.08]">
              {["Name", "Phone", "Grade", "Level", "Goal", "This week", "Gym this week", "Posts this week", "All time", "Joined", "Referrals", "Friends"].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.accounts.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-6 text-white/60">
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
                <td className="px-4 py-3 tabular-nums text-white/70">{a.posts_week}</td>
                <td className="px-4 py-3 tabular-nums text-white/70">{fmtDuration(a.all_minutes)}</td>
                <td className="px-4 py-3 text-white/70">{joinedOn(a.joined)}</td>
                <td className="px-4 py-3 tabular-nums text-white/70">{a.referrals}</td>
                <td className="px-4 py-3 tabular-nums text-white/70">{a.friends}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
