import { redirect } from "next/navigation";
import { FriendsFeed } from "@/components/elite/FriendsFeed";
import { getViewer } from "@/lib/elite/session";
import { APP_URL } from "@/lib/elite/app-url";
import { nyToday } from "@/lib/elite/time";
import { clubAskFor, feedFor, friendAskFor, quizDone, trackerFor, weekLogsFor } from "@/lib/elite/tracker-server";
import {
  FREE_HOME,
  FREE_QUIZ,
  cleanClubCode,
  cleanReferralCode,
  initialsOf,
  joinLink,
  longDayLabel,
  shortName,
  weekProgress,
} from "@/lib/elite/tracker";

export const metadata = { title: "Today · Strive Elite" };
export const dynamic = "force-dynamic";

// The Friends tab (mock screens 1 and 3): who trained today, and the last
// seven days of posts from the friends this player added and from the
// player. Today's posts from friends stay locked until the player posts a
// photo of their own today; a locked post is never sent its photo.
export default async function FriendsPage({
  searchParams,
}: {
  searchParams?: { friend?: string; club?: string };
}) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_HOME}`);
  const tracker = await trackerFor(viewer);
  if (!tracker) redirect("/dashboard");
  // The set-up comes first: it gives the week its target and its days.
  if (!quizDone(tracker) || !tracker.target_minutes) redirect(FREE_QUIZ);

  const today = nyToday();
  const [feed, logs, friendAsk, clubAsk] = await Promise.all([
    feedFor(viewer, today),
    weekLogsFor(viewer, tracker, today),
    // a teammate's link, opened while signed in: asked about once
    friendAskFor(viewer, cleanReferralCode(searchParams?.friend)),
    // a club's link, opened while signed in: asked about once
    clubAskFor(viewer, cleanClubCode(searchParams?.club)),
  ]);
  const week = weekProgress(logs, tracker.target_minutes, today);

  return (
    <FriendsFeed
      date={longDayLabel(today)}
      feed={feed}
      week={{ minutes: week.minutes, target: week.target, percent: week.percent }}
      me={{
        id: viewer.profile.id,
        initials: initialsOf(shortName(viewer.profile.full_name)),
        photo: feed.faces.find((f) => f.you)?.photo ?? null,
      }}
      friendAsk={friendAsk}
      clubAsk={clubAsk}
      inviteLink={joinLink(APP_URL, tracker.referral_code)}
    />
  );
}
