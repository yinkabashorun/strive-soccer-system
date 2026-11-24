import { notFound, redirect } from "next/navigation";
import { ClubScreen } from "@/components/elite/ClubScreen";
import { getViewer } from "@/lib/elite/session";
import { APP_URL } from "@/lib/elite/app-url";
import { nyToday } from "@/lib/elite/time";
import { clubPageFor, trackerFor } from "@/lib/elite/tracker-server";
import { clubTeamFor } from "@/lib/elite/club-teams-server";
import { clubMatchupFor } from "@/lib/elite/club-matchups-server";
import { FREE_WEEK } from "@/lib/elite/tracker";

export const metadata = { title: "Club · Strive Elite" };
export const dynamic = "force-dynamic";

// One club's page (the mocks, screens 7 and 13). Only its members and the
// coaches ever get one back from the server (clubPageFor); its sessions and
// games are checked again, one by one (clubTeamFor, mayViewPlan).
export default async function ClubPage({ params }: { params: { id: string } }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_WEEK}`);
  if (!(await trackerFor(viewer))) redirect("/dashboard");
  const today = nyToday();
  const page = await clubPageFor(viewer, params.id, today);
  if (!page) notFound();
  const [play, matchup] = await Promise.all([
    clubTeamFor(viewer, params.id, page.club.captain),
    // the weekly matchup (083): the same server function the iPhone app's
    // club page reads, so the two never disagree; null until 083 is applied
    clubMatchupFor(viewer, { id: page.club.id, name: page.club.name, members: page.club.members.length, ended: page.club.ended }, today),
  ]);
  return (
    <ClubScreen club={page.club} play={play} matchup={matchup} weekTotal={page.weekTotal} heroUrl={page.heroUrl} appUrl={APP_URL} today={today} />
  );
}
