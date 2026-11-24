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
//
// The phone sends a tick until it gets an answer (mobile/src/outbox.ts), so
// the same tick can arrive twice: the second changes nothing and gets the
// same answer.
export const dynamic = "force-dynamic";

export const POST = appRoute({ name: "drill", access: "member" }, async ({ req, player }) => {
  const body = await readJson(req);
  const id = typeof body?.id === "string" && UUID.test(body.id) ? body.id : null;
  if (!id || typeof body?.completed !== "boolean") return appJson({ error: "bad_request" }, 400);
  const completed = body.completed;

  // The row must be this member's own before anything is written.
  const supabase = createClient();
  if (!supabase) return appJson({ error: "unavailable" }, 503);
  const mine = await supabase.from("elite_homework").select("id").eq("id", id).eq("player_id", player!.id).maybeSingle();
  if (mine.error) return appJson({ error: "unavailable" }, 503);
  if (!mine.data) return appJson({ error: "not_found" }, 404);

  // 503 = "not saved, ask again" (the phone keeps the tick and resends);
  // 409 = "not saved, and asking again will not change that".
  const wrote = await toggleHomework(id, completed);
  if (!wrote.ok) return appJson({ error: "not_saved" }, wrote.again ? 503 : 409);

  // Read back, so the phone is told what the database holds, not what was asked.
  const { data: row, error } = await supabase
    .from("elite_homework")
    .select("id, completed")
    .eq("id", id)
    .eq("player_id", player!.id)
    .maybeSingle();
  if (error) return appJson({ error: "unavailable" }, 503);
  if (!row || Boolean(row.completed) !== completed) return appJson({ error: "not_saved" }, 409);

  const homework = await getHomework(player!.id);
  const live = liveWeekFor(player!.week1_monday, player!.current_week);
  return { ok: true, id, completed, totalMinutes: timeTrained(homework.filter((h) => h.week <= live)).minutes };
});
