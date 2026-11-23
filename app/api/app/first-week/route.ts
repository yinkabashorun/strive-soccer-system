import { appRoute } from "@/lib/elite/app-api";
import { buildMyFirstWeek } from "@/lib/elite/first-week-actions";
import { FIRST_WEEK_LINE } from "@/lib/elite/experience";

// The building screen after the quiz: the website's own first-week build
// (the same claim as migration 079, so the hourly builder and this can
// never build the week twice), answered with where the week really is.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const POST = appRoute({ name: "first-week", access: "player", limit: 6 }, async () => {
  const { status } = await buildMyFirstWeek();
  return { status, line: status === "live" ? null : FIRST_WEEK_LINE[status] };
});
