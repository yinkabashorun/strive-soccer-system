import { notFound, redirect } from "next/navigation";
import { ClubScreen } from "@/components/elite/ClubScreen";
import { getViewer } from "@/lib/elite/session";
import { APP_URL } from "@/lib/elite/app-url";
import { nyToday } from "@/lib/elite/time";
import { clubPageFor, trackerFor } from "@/lib/elite/tracker-server";
import { FREE_WEEK } from "@/lib/elite/tracker";

export const metadata = { title: "Club · Strive Elite" };
export const dynamic = "force-dynamic";

// One club's page (the mock, screen 7). Only its members and the coaches
// ever get one back from the server (clubPageFor).
export default async function ClubPage({ params }: { params: { id: string } }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_WEEK}`);
  if (!(await trackerFor(viewer))) redirect("/dashboard");
  const today = nyToday();
  const page = await clubPageFor(viewer, params.id, today);
  if (!page) notFound();
  return <ClubScreen {...page} appUrl={APP_URL} today={today} />;
}
