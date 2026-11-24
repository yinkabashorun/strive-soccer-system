import { appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { appClubsFor, startClubInApp } from "@/lib/elite/club-app-server";
import { COUNTY_MESSAGE, cleanCounty } from "@/lib/elite/club-teams";
import { CLUB_NAME_MESSAGE, cleanClubName } from "@/lib/elite/tracker";
import { nyToday } from "@/lib/elite/time";

// The Clubs tab: the player's own clubs (three at most), each with its
// training this week, who trained today, what is next and this week's
// matchup. A club is only ever read for its own members.
//   GET                     my clubs
//   POST { name, county? }  start a club (I am its captain and first member)
export const dynamic = "force-dynamic";

export const GET = appRoute({ name: "free-clubs", access: "free_app" }, async ({ viewer }) => appClubsFor(viewer, nyToday()));

// The name goes through the website's own rule and word filter, the county
// is one from the list or none, and the captain's one-time organizer
// acceptance has to be on file first (answered with needs: "organizer").
export const POST = appRoute({ name: "free-clubs", access: "free_app", limit: 10 }, async ({ req, viewer }) => {
  const body = await readJson(req);
  const name = cleanClubName(body?.name);
  if (!name) return appJson({ ok: false, error: CLUB_NAME_MESSAGE }, 400);
  const blank = body?.county === undefined || body?.county === null || body?.county === "";
  const county = blank ? null : cleanCounty(body?.county);
  if (!blank && !county) return appJson({ ok: false, error: COUNTY_MESSAGE }, 400);
  const res = await startClubInApp(viewer, name, county);
  if (res.ok) return { ok: true, id: res.id, code: res.code };
  if (res.needs) return { ok: false, needs: res.needs };
  return appJson({ ok: false, error: res.error }, 400);
});
