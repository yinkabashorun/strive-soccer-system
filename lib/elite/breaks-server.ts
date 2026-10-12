// Server-only half of breaks (034): the family opening the app is the
// other moment a return is noticed (the hourly builder is the first).
// Lives apart from lib/elite/breaks.ts because that file's pure helpers
// are also used by client components, and this one needs the service
// client (players cannot update their own elite_players row).
import { createServiceClient } from "./supabase/server";
import { settleBreaks, type SettleResult } from "./breaks";

export async function settleBreaksForPlayer(
  player: { id: string; week1_monday?: string | null }
): Promise<SettleResult> {
  const admin = createServiceClient();
  if (!admin) return { settled: 0, week1Monday: player.week1_monday };
  try {
    return await settleBreaks(admin, player);
  } catch {
    return { settled: 0, week1Monday: player.week1_monday };
  }
}
