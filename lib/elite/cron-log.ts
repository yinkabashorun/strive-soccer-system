// The plan builder's run log + coach alert. A silent no-op is the failure
// mode that bit this app three times (Sept 19-26: plans attributed to a
// role nobody had; Sept 27: caught up the dying week on Sundays; Oct 2:
// the cron couldn't read the drill bank and built from the unfilmed
// starter library). All were invisible until a parent said something.
//
// A run row (elite_cron_runs, migrations 030/031) is written when a run
// STARTS and updated as it goes, so a crash or a Vercel timeout shows up
// as "started, never finished" instead of nothing. The coach dashboard
// shows the latest row; the digest cron watches the builder's heartbeat
// independently; and a run that errors, finds a live-week problem, or
// cannot run at all texts the coach - once per new problem, not hourly.
import { createServiceClient } from "./supabase/server";
import { sendSms } from "./sms";
import { sendCoachDigest } from "./email";
import type { CronRun } from "./types";

export const PLAN_BUILDER_JOB = "weekly-plans";

// Where the alert text goes. The coach has no phone column on their
// profile; this is the same number the SMS system was verified against.
function coachAlertPhone(): string {
  return process.env.COACH_ALERT_PHONE || "+15712856635";
}

export type CronRunPatch = Partial<
  Pick<CronRun, "authed" | "built" | "skipped" | "errors" | "issues" | "summary" | "finished">
>;

export async function startCronRun(input: {
  job: string;
  trigger: CronRun["trigger"];
  authed: boolean;
}): Promise<string | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  const { data } = await admin
    .from("elite_cron_runs")
    .insert({ ...input, summary: "running", finished: false })
    .select("id")
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function updateCronRun(id: string | null, patch: CronRunPatch): Promise<void> {
  if (!id) return;
  const admin = createServiceClient();
  if (!admin) return;
  await admin.from("elite_cron_runs").update(patch).eq("id", id);
}

export async function latestCronRun(job: string, excludeId?: string | null): Promise<CronRun | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  let q = admin.from("elite_cron_runs").select("*").eq("job", job).order("ran_at", { ascending: false }).limit(1);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q.maybeSingle();
  return (data as CronRun | null) ?? null;
}

// Text + email the coach. Best-effort on every channel; never throws.
export async function alertCoach(message: string): Promise<void> {
  await Promise.all([
    sendSms(coachAlertPhone(), "Coach", message).catch(() => false),
    sendCoachDigest(message).catch(() => false),
  ]);
}
