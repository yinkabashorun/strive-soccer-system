import { redirect } from "next/navigation";
import { TrackerDays } from "@/components/elite/TrackerDays";
import { getViewer } from "@/lib/elite/session";
import { quizDone, trackerFor } from "@/lib/elite/tracker-server";
import { FREE_HOME, FREE_QUIZ } from "@/lib/elite/tracker";

export const metadata = { title: "Your training days · Strive Elite" };
export const dynamic = "force-dynamic";

// Change the days of the week you train. Reached from Account; the first
// time, the days are picked at the end of the set-up instead.
export default async function DaysPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_HOME}`);
  const tracker = await trackerFor(viewer);
  if (!tracker) redirect("/dashboard");
  if (!quizDone(tracker) || !tracker.target_minutes) redirect(FREE_QUIZ);

  return (
    <div className="px-4 pt-4">
      <TrackerDays target={tracker.target_minutes} initial={tracker.plan_days} />
    </div>
  );
}
