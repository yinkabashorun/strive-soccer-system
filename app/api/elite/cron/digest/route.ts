import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/elite/supabase/server";
import { sendCoachDigest } from "@/lib/elite/email";
import { liveWeekNumber } from "@/lib/elite/time";

export const runtime = "nodejs";
export const maxDuration = 60;

// The coach's daily accountability digest (Vercel cron, evenings VA time).
// One text: who is owed a training week, what needs a reply, and which
// players have gone quiet. Sent only when something is actionable - a
// quiet day sends nothing, so the ping always means "act".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createServiceClient();
  if (!admin) return NextResponse.json({ ok: false, reason: "no service client" });

  const [{ data: players }, { data: homework }, { data: checkins }, { data: messages }] =
    await Promise.all([
      admin
        .from("elite_players")
        .select("id, full_name, week1_monday, current_week, subscription_status"),
      admin.from("elite_homework").select("player_id, week, completed, completed_at"),
      admin
        .from("elite_checkins")
        .select("player_id, coach_feedback")
        .or("coach_feedback.is.null,coach_feedback.eq."),
      admin
        .from("elite_messages")
        .select("player_id, from_role, read")
        .eq("from_role", "player")
        .eq("read", false),
    ]);

  type Row = { id: string; full_name: string; week1_monday: string | null; current_week: number; subscription_status: string };
  const roster = ((players as Row[] | null) ?? []).filter(
    (p) => p.subscription_status !== "canceled"
  );
  const hw = (homework as { player_id: string; week: number; completed: boolean; completed_at: string | null }[] | null) ?? [];

  const builtThrough = new Map<string, number>();
  const lastActive = new Map<string, number>();
  for (const h of hw) {
    builtThrough.set(h.player_id, Math.max(builtThrough.get(h.player_id) ?? 0, h.week ?? 0));
    if (h.completed && h.completed_at) {
      lastActive.set(
        h.player_id,
        Math.max(lastActive.get(h.player_id) ?? 0, new Date(h.completed_at).getTime())
      );
    }
  }

  const first = (name: string) => name.split(" ")[0];
  const listNames = (names: string[]) =>
    names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} +${names.length - 3}`;

  // Owed a week: nothing built beyond the week they are living in.
  const toBuild = roster.filter((p) => {
    const live = p.week1_monday ? liveWeekNumber(p.week1_monday) : p.current_week;
    return (builtThrough.get(p.id) ?? 0) <= live;
  });
  // Quiet: has homework but nothing completed in 5+ days.
  const FIVE_DAYS = 5 * 864e5;
  const quiet = roster.filter((p) => {
    if (!builtThrough.has(p.id)) return false; // nothing assigned yet
    const last = lastActive.get(p.id);
    return !last || Date.now() - last > FIVE_DAYS;
  });
  const toAnswer = (checkins?.length ?? 0) + (messages?.length ?? 0);

  const lines: string[] = [];
  if (toBuild.length > 0)
    lines.push(`${toBuild.length} plan${toBuild.length === 1 ? "" : "s"} to build: ${listNames(toBuild.map((p) => first(p.full_name)))}`);
  if (toAnswer > 0) lines.push(`${toAnswer} check-in${toAnswer === 1 ? "" : "s"}/message${toAnswer === 1 ? "" : "s"} to answer`);
  if (quiet.length > 0)
    lines.push(`Quiet 5+ days: ${listNames(quiet.map((p) => first(p.full_name)))}`);

  if (lines.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "all clear" });
  }

  const body = `Strive daily: ${lines.join(" · ")}. thestriveapp.com/coach`;
  const sent = await sendCoachDigest(body);
  return NextResponse.json({ ok: true, sent, body });
}
