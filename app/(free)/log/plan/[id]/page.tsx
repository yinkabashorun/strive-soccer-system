import { notFound, redirect } from "next/navigation";
import { PlanDetail } from "@/components/elite/PlanDetail";
import { getViewer } from "@/lib/elite/session";
import { trackerFor } from "@/lib/elite/tracker-server";
import { planPageFor } from "@/lib/elite/club-teams-server";
import { FREE_WEEK } from "@/lib/elite/tracker";

export const metadata = { title: "Club game · Strive Elite" };
export const dynamic = "force-dynamic";

// One session or game (the mock, screen 18). Only the members of the clubs
// involved get it back from the server (planPageFor, mayViewPlan); anyone
// else gets a not found.
export default async function PlanPage({ params }: { params: { id: string } }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_WEEK}`);
  if (!(await trackerFor(viewer))) redirect("/dashboard");
  const page = await planPageFor(viewer, params.id);
  if (!page) notFound();
  return <PlanDetail {...page} />;
}
