// The free account's quiz on the server (migration 082): reading it,
// storing it, and the week's set-up that follows it. The rules themselves
// are pure, in lib/elite/free-intake.ts and lib/elite/tracker.ts.
//
// Every write happens after the caller has established who is signed in
// (the app API's own gate, lib/elite/app-api.ts), on that account's own
// row, with the service client: no browser or phone writes this table.
import { createServiceClient } from "./supabase/server";
import {
  cleanFreeAnswers,
  firstUnansweredFree,
  freeStage,
  trackerQuizFrom,
  type FreeAnswers,
  type FreeStage,
} from "./free-intake";
import { cleanPlanDays, cleanTarget, recommendation, setUpDone, type TargetRow } from "./tracker";
import { profileSetupDue, SETUP_REFUSED, type ProfileSetup } from "./account-profile";

export type StoredIntake = {
  // false while migration 082 is not applied (or the row could not be
  // read): nothing new is asked of a free account, exactly as before
  available: boolean;
  answers: FreeAnswers | null;
  // the Stripe checkout this account last opened, if any (a pointer only)
  checkout: string | null;
};

const NONE: StoredIntake = { available: false, answers: null, checkout: null };

// Read apart from the rest of the row, so a database without the columns
// yet never takes the free account itself away (lib/elite/tracker-server.ts
// getTracker reads only what 069 created).
export async function readIntake(profileId: string): Promise<StoredIntake> {
  const admin = createServiceClient();
  if (!admin) return NONE;
  const { data, error } = await admin
    .from("elite_trackers")
    .select("intake, upgrade_checkout")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error || !data) return NONE;
  const row = data as { intake: unknown; upgrade_checkout: string | null };
  const answers = row.intake && typeof row.intake === "object" ? cleanFreeAnswers(row.intake) : null;
  // an answer set that is not whole is no answer set: the quiz is asked
  const whole = answers && firstUnansweredFree(answers) === -1 ? answers : null;
  return { available: true, answers: whole, checkout: row.upgrade_checkout ?? null };
}

// Can the database store a free account's quiz yet (migration 082)?
export async function intakeColumnsReady(): Promise<boolean> {
  const admin = createServiceClient();
  if (!admin) return false;
  const { error } = await admin.from("elite_trackers").select("intake", { head: true, count: "exact" }).limit(1);
  return !error;
}

export function stageOf(
  tracker: { quiz_done_at?: string | null; target_minutes?: number | null; plan_days?: readonly number[] | null },
  intake: StoredIntake
): FreeStage {
  return freeStage({ available: intake.available, hasIntake: intake.answers !== null, planned: setUpDone(tracker) });
}

export type SaveResult = { ok: true } | { ok: false; error: string; step?: number; status: number };

// The quiz, finished. Stored whole, with the free app's own four answers
// worked out from it. A target the season recommends is set the first
// time, so the week has one from the start; the days are picked on the
// week's own set-up screen (saveFreePlan), which is what finishes it.
export async function saveFreeIntake(profileId: string, raw: unknown, targets: TargetRow[]): Promise<SaveResult> {
  const answers = cleanFreeAnswers(raw);
  const missing = firstUnansweredFree(answers);
  if (missing !== -1) return { ok: false, error: "unanswered", step: missing, status: 400 };
  const four = trackerQuizFrom(answers);
  if (!four) return { ok: false, error: "unanswered", status: 400 };
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: "not_saved", status: 500 };
  const { data: row } = await admin.from("elite_trackers").select("target_minutes").eq("profile_id", profileId).maybeSingle();
  const hasTarget = Boolean((row as { target_minutes: number | null } | null)?.target_minutes);
  const { error } = await admin
    .from("elite_trackers")
    .update({
      intake: answers,
      intake_at: new Date().toISOString(),
      grade: four.grade,
      level: four.level,
      season: four.season,
      goal: four.goal,
      quiz: four,
      ...(hasTarget ? {} : { target_minutes: recommendation(targets, four.season).minutes }),
    })
    .eq("profile_id", profileId);
  return error ? { ok: false, error: "not_saved", status: 500 } : { ok: true };
}

// The week's set-up: the target and the days the player trains. This is
// what opens the free app, so the profile photo and the @username (081,
// both required) come first, as they do on the website.
export async function saveFreePlan(input: {
  profileId: string;
  setup: ProfileSetup;
  target: unknown;
  days: unknown;
}): Promise<SaveResult> {
  const target = cleanTarget(input.target);
  const days = cleanPlanDays(input.days);
  if (target === null) return { ok: false, error: "Pick a weekly target.", status: 400 };
  if (!days) return { ok: false, error: "Pick at least one day.", status: 400 };
  if (profileSetupDue(input.setup)) return { ok: false, error: SETUP_REFUSED, status: 409 };
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: "not_saved", status: 500 };
  const { data: row } = await admin
    .from("elite_trackers")
    .select("quiz_done_at, season")
    .eq("profile_id", input.profileId)
    .maybeSingle();
  const now = row as { quiz_done_at: string | null; season: string | null } | null;
  if (!now?.season) return { ok: false, error: "Answer the quiz first.", status: 409 };
  const { error } = await admin
    .from("elite_trackers")
    .update({
      target_minutes: target,
      plan_days: days,
      quiz_done_at: now.quiz_done_at ?? new Date().toISOString(),
    })
    .eq("profile_id", input.profileId);
  return error ? { ok: false, error: "not_saved", status: 500 } : { ok: true };
}

export async function setUpgradeCheckout(profileId: string, sessionId: string): Promise<void> {
  const admin = createServiceClient();
  if (!admin) return;
  await admin.from("elite_trackers").update({ upgrade_checkout: sessionId }).eq("profile_id", profileId);
}
