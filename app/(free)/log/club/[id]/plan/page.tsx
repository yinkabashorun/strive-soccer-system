import { notFound, redirect } from "next/navigation";
import { PlanForm } from "@/components/elite/PlanForm";
import { getViewer } from "@/lib/elite/session";
import { nyToday, shiftDay } from "@/lib/elite/time";
import { clubPageFor, trackerFor } from "@/lib/elite/tracker-server";
import { opponentsFor } from "@/lib/elite/club-teams-server";
import { FREE_WEEK, DAY_SHORT, dayIndexOf, shortDate } from "@/lib/elite/tracker";

export const metadata = { title: "Plan · Strive Elite" };
export const dynamic = "force-dynamic";

const DAYS_SHOWN = 14;

// Plan (the mock, screen 17), the captain only: a club training session
// (members only) or a game against another club. About four taps: kind,
// day, time, place. Never a street address; the club organizes it, not
// Strive.
export default async function PlanPage({ params, searchParams }: { params: { id: string }; searchParams?: { vs?: string } }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_WEEK}`);
  if (!(await trackerFor(viewer))) redirect("/dashboard");
  const today = nyToday();
  const page = await clubPageFor(viewer, params.id, today);
  if (!page) notFound();
  if (!page.club.captain) redirect(`/log/club/${params.id}`);
  const opponents = await opponentsFor(viewer, params.id);
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const day = shiftDay(today, i);
    return { value: day, label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${DAY_SHORT[dayIndexOf(day)]} ${shortDate(day).replace(/^\w+ /, "")}` };
  });
  const vs = opponents.find((o) => o.id === searchParams?.vs)?.id ?? null;
  return <PlanForm club={{ id: page.club.id, name: page.club.name }} opponents={opponents} days={days} initialVs={vs} />;
}
