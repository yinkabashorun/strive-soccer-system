// The plan builder's run log + coach alert. A silent no-op is the failure
// mode that bit this app twice (Sept 19-26: the cron attributed plans to
// a role nobody had; Sept 27: it caught up the week that was ending that
// night and left everyone a week behind). Both were invisible until a
// parent said something. Every run now leaves a row (elite_cron_runs,
// migration 030) that the coach dashboard shows, and a run that errors or
// does nothing when players are waiting texts the coach directly.
import { createServiceClient } from "./supabase/server";
import { sendSms } from "./sms";
import { sendCoachDigest } from "./email";

export const PLAN_BUILDER_JOB = "weekly-plans";

// Where the alert text goes. The coach has no phone column on their
// profile; this is the same number the SMS system was verified against.
function coachAlertPhone(): string {
  return process.env.COACH_ALERT_PHONE || "+15712856635";
}

export type CronRunInput = {
  job: string;
  trigger: "cron" | "coach" | "skipped";
  authed: boolean;
  built: number;
  skipped: number;
  errors: { name: string; error: string }[];
  summary: string;
};

export async function recordCronRun(run: CronRunInput): Promise<void> {
  const admin = createServiceClient();
  if (!admin) return;
  await admin.from("elite_cron_runs").insert(run);
}

// Text + email the coach. Best-effort on every channel; never throws.
export async function alertCoach(message: string): Promise<void> {
  await Promise.all([
    sendSms(coachAlertPhone(), "Coach", message).catch(() => false),
    sendCoachDigest(message).catch(() => false),
  ]);
}
