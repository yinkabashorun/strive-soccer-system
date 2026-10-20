// App error log, server half: write a row, read recent rows. Pure
// helpers live in app-errors.ts. Every function here is best-effort and
// never throws: recording an error must not be a second error.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ErrorReport } from "./app-errors";
import type { AppError, Role } from "./types";

export async function recordAppError(
  admin: SupabaseClient,
  report: ErrorReport,
  ctx: { viewerRole: Role | null; playerId: string | null; userAgent: string | null }
): Promise<boolean> {
  try {
    const { error } = await admin.from("elite_app_errors").insert({
      side: report.side,
      route: report.route,
      digest: report.digest,
      message: report.message,
      stack: report.stack,
      viewer_role: ctx.viewerRole,
      player_id: ctx.playerId,
      user_agent: ctx.userAgent ? ctx.userAgent.slice(0, 300) : null,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function countAppErrorsSince(
  admin: SupabaseClient,
  sinceIso: string
): Promise<number> {
  try {
    const { count } = await admin
      .from("elite_app_errors")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", sinceIso);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function recentAppErrors(
  client: SupabaseClient,
  sinceIso: string,
  limit = 20
): Promise<AppError[]> {
  try {
    const { data } = await client
      .from("elite_app_errors")
      .select("*")
      .gte("occurred_at", sinceIso)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    return (data as AppError[] | null) ?? [];
  } catch {
    return [];
  }
}
