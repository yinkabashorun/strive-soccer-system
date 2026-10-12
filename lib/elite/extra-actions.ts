"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "./supabase/server";
import { getViewer } from "./session";
import { getDrillBank, normalizeTitle } from "./data";
import { liveWeekFor } from "./time";
import {
  composeExtraSession,
  EXTRA_SHELVES,
  strengthRequired,
  type ExtraShelf,
} from "./bank-conform";
import type { Player } from "./types";

// Extra Work (offer stack item 1, Oct 12 2026): "I've got more today."
//
// The player adds a structured session on top of the plan: one filmed
// plyo warm-up, three filmed skill drills from one shelf (Ball Mastery,
// Wall Work, 1v1 Skills), a strengthening finisher when their note
// requires one. Rules, all enforced here and in bank-conform.ts:
//   - never a drill the player has already completed, any week; then
//     never one from this week; then the least recently done
//   - the same wall and space rules as the weekly builder
//   - the same filmed-only guard: rows carry drill_id + video_url and
//     the 031 trigger refuses anything else
//   - one open extra at a time: finish it before adding another
//   - only into the week the player is actually training (the live
//     week, or the latest built week if the coach is behind)
// Players cannot write elite_homework rows themselves under RLS; this
// runs through the service client after checking the viewer owns the
// player, the same pattern as completeOnboarding.
type HwRow = {
  id: string;
  week: number;
  session: number | null;
  title: string;
  completed: boolean;
  completed_at: string | null;
  is_extra: boolean | null;
};

export async function addExtraSession(shelf: ExtraShelf) {
  if (!(shelf in EXTRA_SHELVES)) return { ok: false as const, error: "Pick a shelf." };
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const, error: "Sign in first." };
  if (viewer.demo) return { ok: true as const, session: 5 }; // demo: nothing to persist

  const admin = createServiceClient();
  if (!admin) return { ok: false as const, error: "Not available right now." };

  const { data: playerRow } = await admin
    .from("elite_players")
    .select("*")
    .eq("id", viewer.playerId)
    .maybeSingle();
  const player = playerRow as Player | null;
  if (!player) return { ok: false as const, error: "Player not found." };

  const { data: hwData } = await admin
    .from("elite_homework")
    .select("id, week, session, title, completed, completed_at, is_extra")
    .eq("player_id", player.id);
  const rows = ((hwData as HwRow[] | null) ?? []);

  const live = liveWeekFor(player.week1_monday, player.current_week);
  const maxBuilt = rows.reduce((m, r) => Math.max(m, r.week), 0);
  const week = Math.max(1, Math.min(live, maxBuilt || 1));
  const thisWeek = rows.filter((r) => r.week === week);
  if (thisWeek.length === 0) {
    return { ok: false as const, error: "Your week isn't built yet. Extra Work lands once it is." };
  }
  const openExtra = thisWeek.find((r) => r.is_extra && !r.completed);
  if (openExtra) {
    return { ok: false as const, error: "Finish the extra session you already have, then add another." };
  }

  const doneTitles = rows
    .filter((r) => r.completed)
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .map((r) => r.title);
  const weekTitles = thisWeek.map((r) => r.title);

  const { drills: bank } = await getDrillBank({ onlyWithVideo: true, client: admin });
  if (bank.length === 0) return { ok: false as const, error: "The drill bank isn't reachable right now." };

  const session = composeExtraSession({
    bank,
    player: { has_wall: player.has_wall ?? null, space: player.space ?? null },
    shelf,
    doneTitles,
    weekTitles,
    strength: strengthRequired(player.coach_memory) ? "required" : "optional",
  });
  if (!session) {
    return {
      ok: false as const,
      error:
        shelf === "wall_work"
          ? "Wall Work needs a wall on your profile. Ask your coach to switch it on."
          : `No ${EXTRA_SHELVES[shelf].label} drills fit your space yet. Try another shelf.`,
    };
  }

  const byTitle = new Map<string, { id: string; video_url: string | null }>();
  for (const b of bank) byTitle.set(normalizeTitle(b.title), { id: b.id, video_url: b.video_url || null });
  const nextSession = thisWeek.reduce((m, r) => Math.max(m, r.session ?? 1), 0) + 1;
  const inserts = session.drills.map((d, di) => {
    const match = byTitle.get(normalizeTitle(d.title));
    return {
      player_id: player.id,
      week,
      session: nextSession,
      title: d.title,
      exercise: d.exercise,
      reps: d.reps,
      duration_min: d.minutes ?? 10,
      notes: d.notes ?? null,
      video_url: match?.video_url ?? null,
      drill_id: match?.id ?? null,
      sort: di,
      is_extra: true,
    };
  });
  const { error } = await admin.from("elite_homework").insert(inserts);
  if (error) {
    // The 031 guard refusing an unfilmed row lands here. Nothing partial
    // is written; the player sees a plain message, the coach sees it in
    // the next audit.
    return { ok: false as const, error: "Couldn't add that session. Your coach has been flagged." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/homework");
  return { ok: true as const, session: nextSession };
}
