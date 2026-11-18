import { redirect } from "next/navigation";
import { TrackerHome } from "@/components/elite/TrackerHome";
import { getViewer } from "@/lib/elite/session";
import { inNativeApp } from "@/lib/elite/native-request";
import { APP_URL } from "@/lib/elite/app-url";
import { nyToday } from "@/lib/elite/time";
import { referralCount, trackerFor, weekLogsFor } from "@/lib/elite/tracker-server";
import { FREE_HOME, joinLink, joinedLine, tracksGym, weekLabel } from "@/lib/elite/tracker";

export const metadata = { title: "Your week · Strive Elite" };
export const dynamic = "force-dynamic";

// The whole free training log: the week, the five buttons that log, what
// was logged, share it, invite a teammate. Nothing else lives here.
export default async function LogPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_HOME}`);
  const tracker = await trackerFor(viewer);
  if (!tracker) redirect("/dashboard");
  // The three questions come first: they set the weekly target.
  if (!tracker.quiz_done_at || !tracker.target_minutes) redirect(`${FREE_HOME}/quiz`);

  const today = nyToday();
  const [logs, joined] = await Promise.all([
    weekLogsFor(viewer, today),
    viewer.demo ? Promise.resolve(1) : referralCount(viewer.profile.id),
  ]);

  return (
    <TrackerHome
      logs={logs}
      target={tracker.target_minutes}
      gym={tracksGym(tracker.level)}
      week={weekLabel(today)}
      inviteLink={joinLink(APP_URL, tracker.referral_code)}
      joined={joinedLine(joined)}
      showProgramLine={!inNativeApp()}
    />
  );
}
