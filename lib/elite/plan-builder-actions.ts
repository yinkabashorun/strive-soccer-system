"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "./session";
import { runPlanBuilder } from "./auto-plan";

// The coach's "Build missing weeks now" button on the dashboard. Same
// code path as the hourly cron, logged the same way, just triggered by a
// person - so a player who is behind never has to wait for the next
// hourly run, and a coach never has to go studio by studio to catch
// people up.
export async function runPlanBuilderNow() {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") return { ok: false as const, error: "unauthorized" };
  const outcome = await runPlanBuilder({ trigger: "coach", authed: true });
  revalidatePath("/coach");
  return { ok: true as const, built: outcome.built, errors: outcome.errors.length, reason: outcome.reason ?? null };
}
