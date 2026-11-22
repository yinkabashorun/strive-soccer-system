"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "./session";
import { createServiceClient } from "./supabase/server";
import { buildFirstWeekFor } from "./auto-plan";
import { firstWeekStatus, type FirstWeekStatus } from "./experience";
import { nyToday } from "./time";

// The building screen (Nov 21 2026): the moment a member finishes the quiz
// their first week is built through the hourly builder's own body
// (buildFirstWeekFor), and this answers with where the week really is.
// Nothing is faked: a week that is not built, or not open yet, is said so.
//
// It builds only for the signed-in member's own record, only after the
// quiz is saved, only for a membership that is switched on, and only when
// no week exists yet; every other call just reads.
async function readState(playerId: string) {
  const admin = createServiceClient();
  if (!admin) return null;
  const { data: player } = await admin
    .from("elite_players")
    .select("onboarded_at, subscription_status, week1_monday")
    .eq("id", playerId)
    .maybeSingle();
  if (!player) return null;
  const { count } = await admin
    .from("elite_homework")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId);
  return {
    onboarded: Boolean(player.onboarded_at),
    active: player.subscription_status === "active" || player.subscription_status === "trialing",
    built: (count ?? 0) > 0,
    week1Monday: (player.week1_monday as string | null) ?? null,
  };
}

export async function buildMyFirstWeek(): Promise<{ status: FirstWeekStatus }> {
  const viewer = await getViewer();
  if (!viewer?.playerId || viewer.role !== "player") return { status: "waiting" };
  // The example player's week already exists.
  if (viewer.demo) return { status: "live" };

  let state = await readState(viewer.playerId);
  if (!state || !state.onboarded) return { status: "waiting" };
  if (state.active && !state.built) {
    await buildFirstWeekFor(viewer.playerId).catch(() => undefined);
    state = (await readState(viewer.playerId)) ?? state;
  }
  revalidatePath("/dashboard");
  return { status: firstWeekStatus({ ...state, today: nyToday() }) };
}
