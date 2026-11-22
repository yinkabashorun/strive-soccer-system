"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "./supabase/server";
import { getViewer } from "./session";
import { getDrillBank, normalizeTitle } from "./data";
import { liveWeekFor } from "./time";
import {
  composeExtraSession,
  EXTRA_SHELVES,
  extraFinisher,
  extraWarmUp,
  fromBank,
  strengthRequired,
  type ExtraShelf,
  type PlayerEnv,
  type StrengthMode,
} from "./bank-conform";
import { composePickedSession, pickGroups, type PickGroup } from "./extra-pick";
import { DEMO_PLAYERS } from "./demo";
import type { Drill, Player } from "./types";

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
//   - the player can also pick their own drills (addPickedExtraSession,
//     lib/elite/extra-pick.ts): the same warm-up first and finisher last,
//     their picks in tap order, every id re-checked here
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
  drill_id: string | null;
};

type Fail = { ok: false; error: string };

// Everything both ways in (the shelves and the picker) need, read once
// with the same rules: the player, the week they are training, whether an
// extra is already open, what they have done, and the filmed bank.
type ExtraContext = {
  admin: NonNullable<ReturnType<typeof createServiceClient>>;
  player: Player;
  env: PlayerEnv;
  week: number;
  nextSession: number;
  doneTitles: string[];
  doneDrillIds: Set<string>;
  weekTitles: string[];
  bank: Drill[];
  strength: StrengthMode;
};

// playerId is always the signed-in viewer's own (getViewer), which is the
// ownership check.
async function loadExtraContext(playerId: string): Promise<{ ok: true; ctx: ExtraContext } | Fail> {
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: "Not available right now." };

  const { data: playerRow } = await admin
    .from("elite_players")
    .select("*")
    .eq("id", playerId)
    .maybeSingle();
  const player = playerRow as Player | null;
  if (!player) return { ok: false, error: "Player not found." };

  const { data: hwData } = await admin
    .from("elite_homework")
    .select("id, week, session, title, completed, completed_at, is_extra, drill_id")
    .eq("player_id", player.id);
  const rows = (hwData as HwRow[] | null) ?? [];

  const live = liveWeekFor(player.week1_monday, player.current_week);
  const maxBuilt = rows.reduce((m, r) => Math.max(m, r.week), 0);
  const week = Math.max(1, Math.min(live, maxBuilt || 1));
  const thisWeek = rows.filter((r) => r.week === week);
  if (thisWeek.length === 0) {
    return { ok: false, error: "Your week isn't built yet. Extra Work lands once it is." };
  }
  if (thisWeek.some((r) => r.is_extra && !r.completed)) {
    return { ok: false, error: "Finish the extra session you already have, then add another." };
  }

  const done = rows.filter((r) => r.completed);
  const doneTitles = done
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .map((r) => r.title);

  const { drills: bank } = await getDrillBank({ onlyWithVideo: true, client: admin });
  if (bank.length === 0) return { ok: false, error: "The drill bank isn't reachable right now." };

  return {
    ok: true,
    ctx: {
      admin,
      player,
      env: {
        has_wall: player.has_wall ?? null,
        has_goal: player.has_goal ?? null,
        space: player.space ?? null,
        offer_opt_in: player.offer_opt_in ?? null,
        opt_in_drill_ids: player.opt_in_drill_ids ?? null,
      },
      week,
      nextSession: thisWeek.reduce((m, r) => Math.max(m, r.session ?? 1), 0) + 1,
      doneTitles,
      doneDrillIds: new Set(done.map((r) => r.drill_id).filter((x): x is string => Boolean(x))),
      weekTitles: thisWeek.map((r) => r.title),
      bank,
      strength: strengthRequired(player.coach_memory) ? "required" : "optional",
    },
  };
}

// One insert for the whole session: nothing partial is ever written. The
// 031 guard refusing an unfilmed row lands in the error branch.
async function insertExtra(
  ctx: ExtraContext,
  drills: { title: string; exercise: string; reps: string; minutes?: number; notes?: string; drill_id: string | null; video_url: string | null }[]
): Promise<{ ok: true; session: number } | Fail> {
  const inserts = drills.map((d, di) => ({
    player_id: ctx.player.id,
    week: ctx.week,
    session: ctx.nextSession,
    title: d.title,
    exercise: d.exercise,
    reps: d.reps,
    duration_min: d.minutes ?? 10,
    notes: d.notes ?? null,
    video_url: d.video_url,
    drill_id: d.drill_id,
    sort: di,
    is_extra: true,
  }));
  const { error } = await ctx.admin.from("elite_homework").insert(inserts);
  if (error) {
    return { ok: false, error: "Couldn't add that session. Your coach has been flagged." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/homework");
  return { ok: true, session: ctx.nextSession };
}

export async function addExtraSession(shelf: ExtraShelf) {
  if (!(shelf in EXTRA_SHELVES)) return { ok: false as const, error: "Pick a shelf." };
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const, error: "Sign in first." };
  if (viewer.demo) return { ok: true as const, session: null, example: true as const }; // demo: nothing to persist

  const loaded = await loadExtraContext(viewer.playerId);
  if (!loaded.ok) return loaded;
  const ctx = loaded.ctx;

  const session = composeExtraSession({
    bank: ctx.bank,
    player: ctx.env,
    shelf,
    doneTitles: ctx.doneTitles,
    weekTitles: ctx.weekTitles,
    strength: ctx.strength,
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
  for (const b of ctx.bank) byTitle.set(normalizeTitle(b.title), { id: b.id, video_url: b.video_url || null });
  return insertExtra(
    ctx,
    session.drills.map((d) => {
      const match = byTitle.get(normalizeTitle(d.title));
      return { ...d, drill_id: match?.id ?? null, video_url: match?.video_url ?? null };
    })
  );
}

// The picker's list: every filmed drill this player can pick, grouped,
// plus what we add around their picks. Read with the service client
// because players cannot read elite_drills under RLS; the same rule the
// server checks picks with (lib/elite/extra-pick.ts).
export async function getExtraPicker(): Promise<
  | { ok: true; groups: PickGroup[]; warmUpMinutes: number; finisherMinutes: number; example: boolean }
  | Fail
> {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false, error: "Sign in first." };

  if (viewer.demo) {
    // The example player sees the real list (when the bank is reachable)
    // against the example profile; nothing is ever written for it.
    const player = DEMO_PLAYERS.find((p) => p.id === viewer.playerId) ?? null;
    const { drills: bank } = await getDrillBank({ onlyWithVideo: true });
    const env: PlayerEnv = { has_wall: player?.has_wall ?? null, has_goal: player?.has_goal ?? null, space: player?.space ?? null };
    const warmUp = extraWarmUp(bank, []);
    return { ok: true, groups: pickGroups(bank, env), warmUpMinutes: warmUp?.minutes ?? 0, finisherMinutes: 0, example: true };
  }

  const loaded = await loadExtraContext(viewer.playerId);
  if (!loaded.ok) return loaded;
  const ctx = loaded.ctx;
  const warmUp = extraWarmUp(ctx.bank, ctx.weekTitles);
  const finisher =
    ctx.strength === "required" ? extraFinisher(ctx.bank, ctx.env, ctx.doneTitles, ctx.weekTitles) : null;
  return {
    ok: true,
    groups: pickGroups(ctx.bank, ctx.env, ctx.doneDrillIds),
    warmUpMinutes: warmUp?.minutes ?? 0,
    finisherMinutes: finisher?.minutes ?? 0,
    example: false,
  };
}

// The player's own picks, in the order they tapped them. Everything is
// checked again here: the list the browser sends is never trusted.
export async function addPickedExtraSession(drillIds: unknown) {
  const viewer = await getViewer();
  if (!viewer?.playerId) return { ok: false as const, error: "Sign in first." };
  if (viewer.demo) return { ok: true as const, session: null, example: true as const }; // demo: nothing to persist

  const loaded = await loadExtraContext(viewer.playerId);
  if (!loaded.ok) return loaded;
  const ctx = loaded.ctx;

  const picked = composePickedSession({
    bank: ctx.bank,
    player: ctx.env,
    picks: drillIds,
    doneTitles: ctx.doneTitles,
    weekTitles: ctx.weekTitles,
    strength: ctx.strength,
  });
  if (!picked.ok) return picked;
  return insertExtra(
    ctx,
    picked.drills.map((d) => ({ ...fromBank(d), drill_id: d.id, video_url: d.video_url || null }))
  );
}
