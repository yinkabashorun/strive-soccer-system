import { redirect } from "next/navigation";
import { TrackerHome } from "@/components/elite/TrackerHome";
import { getViewer } from "@/lib/elite/session";
import { inNativeApp } from "@/lib/elite/native-request";
import { APP_URL } from "@/lib/elite/app-url";
import { nyToday } from "@/lib/elite/time";
import {
  friendAskFor,
  friendsWeekFor,
  quizDone,
  trackerFor,
  weekLogsFor,
} from "@/lib/elite/tracker-server";
import {
  FREE_HOME,
  FREE_QUIZ,
  cleanReferralCode,
  joinLink,
  programLink,
  shortName,
  tracksGym,
  weekLabel,
} from "@/lib/elite/tracker";

export const metadata = { title: "Your week · Strive Elite" };
export const dynamic = "force-dynamic";

// The whole free training log: the week, the days, the five buttons that
// log, share it, and the week next to your friends. Nothing else lives
// here.
export default async function LogPage({
  searchParams,
}: {
  searchParams?: { friend?: string };
}) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_HOME}`);
  const tracker = await trackerFor(viewer);
  if (!tracker) redirect("/dashboard");
  // The set-up comes first: it gives the week its target and its days.
  if (!quizDone(tracker) || !tracker.target_minutes) redirect(FREE_QUIZ);

  const today = nyToday();
  const [logs, friends, friendAsk] = await Promise.all([
    weekLogsFor(viewer, tracker, today),
    friendsWeekFor(viewer, today),
    // a teammate's link, opened while signed in: asked about once
    friendAskFor(viewer, cleanReferralCode(searchParams?.friend)),
  ]);

  return (
    <TrackerHome
      logs={logs}
      target={tracker.target_minutes}
      planDays={tracker.plan_days}
      today={today}
      gym={tracksGym(tracker.grade)}
      week={weekLabel(today)}
      me={{ id: viewer.profile.id, name: shortName(viewer.profile.full_name) }}
      friends={friends}
      friendAsk={friendAsk}
      inviteLink={joinLink(APP_URL, tracker.referral_code)}
      programHref={programLink(inNativeApp())}
    />
  );
}
