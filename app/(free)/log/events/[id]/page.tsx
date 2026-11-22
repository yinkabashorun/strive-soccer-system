import { notFound, redirect } from "next/navigation";
import { EventEntry } from "@/components/elite/EventEntry";
import { getViewer } from "@/lib/elite/session";
import { trackerFor } from "@/lib/elite/tracker-server";
import { entryFor } from "@/lib/elite/club-teams-server";
import { FREE_WEEK } from "@/lib/elite/tracker";

export const metadata = { title: "Enter the event · Strive Elite" };
export const dynamic = "force-dynamic";

// One club's entry in one Strive event (the mock, screen 15): who's
// playing, picked from the club's members by its captain. Only the club's
// members and coaches get it back from the server (entryFor).
export default async function EventEntryPage({ params, searchParams }: { params: { id: string }; searchParams?: { club?: string } }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_WEEK}`);
  if (!(await trackerFor(viewer))) redirect("/dashboard");
  const club = typeof searchParams?.club === "string" ? searchParams.club : "";
  const view = club ? await entryFor(viewer, params.id, club) : null;
  if (!view) notFound();
  return <EventEntry view={view} />;
}
