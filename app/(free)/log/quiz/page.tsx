import { redirect } from "next/navigation";
import { TrackerQuiz } from "@/components/elite/TrackerQuiz";
import { getViewer } from "@/lib/elite/session";
import { getTargetTable, trackerFor } from "@/lib/elite/tracker-server";
import { FREE_HOME } from "@/lib/elite/tracker";

export const metadata = { title: "Your weekly target · Strive Elite" };
export const dynamic = "force-dynamic";

// Four questions, the weekly target, then the days to train. First run lands here; after
// that it is reached from Account, to change the target or the season.
export default async function QuizPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_HOME}`);
  const tracker = await trackerFor(viewer);
  if (!tracker) redirect("/dashboard");

  return (
    <div className="px-4 pt-4">
      <TrackerQuiz
        targets={await getTargetTable()}
        initial={{
          grade: tracker.grade,
          level: tracker.level,
          season: tracker.season,
          goal: tracker.goal,
        }}
        initialDays={tracker.plan_days}
        currentTarget={tracker.quiz_done_at ? tracker.target_minutes : null}
      />
    </div>
  );
}
