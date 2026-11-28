import { redirect } from "next/navigation";
import { MyWeek } from "@/components/elite/MyWeek";
import { getViewer } from "@/lib/elite/session";
import { inNativeApp } from "@/lib/elite/native-request";
import { APP_URL } from "@/lib/elite/app-url";
import { nyToday } from "@/lib/elite/time";
import {
  friendsWeekFor,
  myClubsFor,
  myLatestPhotoFor,
  myPhotoFor,
  quizDone,
  trackerFor,
  weekLogsFor,
  weekCardFor,
} from "@/lib/elite/tracker-server";
import { clubRankingFor } from "@/lib/elite/tracker-ranking";
import { shareLinkFor } from "@/lib/elite/share-link-server";
import {
  FREE_WEEK,
  FREE_QUIZ,
  initialsOf,
  joinLink,
  programLink,
  shortName,
  tracksGym,
  weekLabel,
} from "@/lib/elite/tracker";

export const metadata = { title: "My week · Strive Elite" };
export const dynamic = "force-dynamic";

// The My week tab: the accountability piece of the free app.
export default async function MyWeekPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_WEEK}`);
  const tracker = await trackerFor(viewer);
  if (!tracker) redirect("/dashboard");
  if (!quizDone(tracker) || !tracker.target_minutes) redirect(FREE_QUIZ);

  const today = nyToday();
  const [logs, friends, clubs, ranking, card] = await Promise.all([
    weekLogsFor(viewer, tracker, today),
    friendsWeekFor(viewer, today),
    myClubsFor(viewer, today),
    clubRankingFor(viewer, today),
    weekCardFor(viewer, tracker).catch(() => null),
  ]);
  const [photo, preview] = await Promise.all([myPhotoFor(viewer), myLatestPhotoFor(viewer, today)]);
  const name = shortName(viewer.profile.full_name);

  return (
    <MyWeek
      logs={logs}
      target={tracker.target_minutes}
      planDays={tracker.plan_days}
      today={today}
      gym={tracksGym(tracker.grade)}
      week={weekLabel(today)}
      me={{ id: viewer.profile.id, name, initials: initialsOf(name), photo }}
      friends={friends}
      clubs={clubs}
      ranking={ranking}
      preview={preview}
      appUrl={APP_URL}
      inviteLink={joinLink(APP_URL, tracker.referral_code)}
      programHref={programLink(inNativeApp())}
      shareLink={await shareLinkFor(tracker, viewer.demo)}
      card={card}
    />
  );
}
