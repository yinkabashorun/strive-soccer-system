import { UUID, appJson, appRoute, readJson } from "@/lib/elite/app-api";
import { planGame, planTraining } from "@/lib/elite/club-teams-actions";
import { NEEDS_ORGANIZER_OK } from "@/lib/elite/club-teams";

// The captain plans for the club, through the website's own actions: a
// training session (members only), or a game sent to another club, which
// that club's captain accepts or passes. Organized by the club, never by
// Strive: the captain's one-time organizer acceptance has to be on file
// (answered with needs: "organizer"). The day and time are New York wall
// time; the place is a typed public field or park, and anything that looks
// like a street address is refused there (cleanPlace).
//   POST { club, kind: "training", day, time, minutes, place, title? }
//   POST { club, kind: "game", opponent, day, time, minutes, place }
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "free-plans", access: "free_app", limit: 20 }, async ({ req }) => {
  const body = await readJson(req);
  const bad = (error: string) => appJson({ ok: false, error }, 400);
  if (typeof body?.club !== "string" || !UUID.test(body.club)) return bad("That club is not there any more.");
  if (body.kind !== "training" && body.kind !== "game") return bad("Pick club training or a game.");
  const input = { day: body.day, time: body.time, minutes: body.minutes, place: body.place, title: body.title };
  let res: Awaited<ReturnType<typeof planTraining>>;
  if (body.kind === "game") {
    if (typeof body.opponent !== "string" || !UUID.test(body.opponent)) return bad("Pick the club you want to play.");
    res = await planGame(body.club, body.opponent, input);
  } else res = await planTraining(body.club, input);
  if (res.ok) return { ok: true, id: res.id };
  if (res.error === NEEDS_ORGANIZER_OK) return { ok: false, needs: "organizer" };
  return bad(res.error);
});
