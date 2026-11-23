import { appJson, appRoute, readJson, UUID } from "@/lib/elite/app-api";
import { toggleHomework } from "@/lib/elite/player-actions";
import { createClient } from "@/lib/elite/supabase/server";
import { getHomework } from "@/lib/elite/data";
import { timeTrained } from "@/lib/elite/time-trained";
import { liveWeekFor } from "@/lib/elite/time";

// A drill ticked done (or undone) in the session player: the website's own
// action (toggleHomework: the row as the member under RLS, achievements on
// a completion), then the row is read back so the phone is told the truth,
// and the all-time minutes come back for the finish screen.
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "drill", access: "member" }, async ({ req, player }) => {
  const body = await readJson(req);
  const id = typeof body?.id === "string" && UUID.test(body.id) ? body.id : null;
  if (!id || typeof body?.completed !== "boolean") return appJson({ error: "bad_request" }, 400);
  const completed = body.completed;

  await toggleHomework(id, completed);

  const supabase = createClient();
  const { data: row } = supabase
    ? await supabase.from("elite_homework").select("id, completed").eq("id", id).eq("player_id", player!.id).maybeSingle()
    : { data: null };
  if (!row || Boolean(row.completed) !== completed) return appJson({ error: "not_saved" }, 409);

  const homework = await getHomework(player!.id);
  const live = liveWeekFor(player!.week1_monday, player!.current_week);
  return { ok: true, id, completed, totalMinutes: timeTrained(homework.filter((h) => h.week <= live)).minutes };
});
