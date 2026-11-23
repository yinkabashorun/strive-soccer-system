import { notFound, redirect } from "next/navigation";
import { ProfileScreen } from "@/components/elite/ProfileScreen";
import { getViewer } from "@/lib/elite/session";
import { APP_URL } from "@/lib/elite/app-url";
import { nyToday } from "@/lib/elite/time";
import { myClubsFor, profileFor, trackerFor } from "@/lib/elite/tracker-server";
import { FREE_HOME, joinLink } from "@/lib/elite/tracker";

export const metadata = { title: "Profile · Strive Elite" };
export const dynamic = "force-dynamic";

// A player's profile, as a full screen (the mock, screen 5). Only the
// player, their friends and the coaches ever get one back from the
// server (profileFor); anyone else lands on a plain "not there".
export default async function ProfilePage({ params }: { params: { id: string } }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_HOME}`);
  const tracker = await trackerFor(viewer);
  if (!tracker) redirect("/dashboard");
  const today = nyToday();
  const id = params.id === "me" ? viewer.profile.id : params.id;
  const [profile, clubs] = await Promise.all([profileFor(viewer, id, today), myClubsFor(viewer, today)]);
  if (!profile) notFound();
  return (
    <ProfileScreen
      profile={profile}
      myClubIds={clubs.map((c) => c.id)}
      inviteLink={joinLink(APP_URL, tracker.referral_code)}
    />
  );
}
