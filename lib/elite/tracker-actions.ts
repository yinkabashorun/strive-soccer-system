"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "./supabase/server";
import { getViewer } from "./session";
import { nyToday } from "./time";
import { getTracker } from "./tracker-server";
import {
  FREE_HOME,
  cleanKind,
  cleanTarget,
  mayLog,
  validateMinutes,
  validateQuiz,
  type Kind,
  type Season,
} from "./tracker";

// The free training log: writing it (migration 069). Every write goes
// through here: the signed-in viewer is resolved first, the row touched is
// always their own (the profile id comes from the session, never from the
// browser), and only then is the service client used. The example account
// (no database) answers ok and saves nothing.

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const OFFLINE = "We could not reach the server. Try again in a minute.";

// The signed-in free account, or why not.
type Owner =
  | { kind: "no"; error: string }
  | { kind: "demo" }
  | {
      kind: "ok";
      admin: NonNullable<ReturnType<typeof createServiceClient>>;
      profileId: string;
      level: string | null;
    };

async function owner(): Promise<Owner> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "player") return { kind: "no", error: "Sign in first." };
  if (viewer.demo) return { kind: "demo" };
  const admin = createServiceClient();
  if (!admin) return { kind: "demo" };
  const tracker = await getTracker(viewer.profile.id);
  if (!tracker) return { kind: "no", error: "Sign in first." };
  return { kind: "ok", admin, profileId: viewer.profile.id, level: tracker.level };
}

// Save the three quiz answers and the weekly target the player chose.
export async function saveQuiz(input: {
  level: string;
  season: string;
  goal: string;
  target: number;
}): Promise<{ ok: true } | Fail> {
  const answers = validateQuiz(input);
  const target = cleanTarget(input.target);
  if (!answers || target === null) return fail("Answer all three questions, then pick a target.");
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") return { ok: true };
  const { error } = await o.admin
    .from("elite_trackers")
    .update({
      level: answers.level,
      season: answers.season,
      goal: answers.goal,
      target_minutes: target,
      quiz: answers,
      quiz_done_at: new Date().toISOString(),
    })
    .eq("profile_id", o.profileId);
  if (error) return fail(OFFLINE);
  revalidatePath(FREE_HOME);
  return { ok: true };
}

// One tap: log minutes for today (New York date), as training or as gym
// work. Gym is for a high school or college player only (mayLog); anyone
// else asking to log gym is refused before anything is written.
export async function logTraining(
  minutesInput: number,
  kindInput: string = "training"
): Promise<{ ok: true; id: string; trained_on: string; minutes: number; kind: Kind } | Fail> {
  const minutes = validateMinutes(minutesInput);
  const kind = cleanKind(kindInput);
  if (minutes === null || kind === null) return fail("That is not something we can log.");
  const trained_on = nyToday();
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") return { ok: true, id: `demo-${Date.now()}`, trained_on, minutes, kind };
  if (!mayLog(kind, o.level)) return fail("Gym work is logged by high school and college players.");
  const { data, error } = await o.admin
    .from("elite_training_logs")
    .insert({ profile_id: o.profileId, trained_on, minutes, kind })
    .select("id")
    .single();
  if (error || !data) return fail(OFFLINE);
  revalidatePath(FREE_HOME);
  return { ok: true, id: data.id as string, trained_on, minutes, kind };
}

// Undo, or the delete on an entry: only ever the player's own row.
export async function deleteLog(id: string): Promise<{ ok: true } | Fail> {
  if (typeof id !== "string" || !id) return fail("Nothing to delete.");
  const o = await owner();
  if (o.kind === "no") return fail(o.error);
  if (o.kind === "demo") return { ok: true };
  const { error } = await o.admin
    .from("elite_training_logs")
    .delete()
    .eq("id", id)
    .eq("profile_id", o.profileId);
  if (error) return fail(OFFLINE);
  revalidatePath(FREE_HOME);
  return { ok: true };
}

// ---- Coach side (/coach/free) -----------------------------------------

type Coach =
  | { kind: "no" }
  | { kind: "demo" }
  | { kind: "ok"; admin: NonNullable<ReturnType<typeof createServiceClient>> };

async function coach(): Promise<Coach> {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") return { kind: "no" };
  if (viewer.demo) return { kind: "demo" };
  const admin = createServiceClient();
  if (!admin) return { kind: "demo" };
  return { kind: "ok", admin };
}

// Open or close free sign-up for everyone.
export async function setFreeSignupOpen(open: boolean): Promise<{ ok: true } | Fail> {
  const c = await coach();
  if (c.kind === "no") return fail("Only a coach can change this.");
  if (c.kind === "demo") return { ok: true };
  const { error } = await c.admin
    .from("elite_settings")
    .upsert(
      { key: "free_signup_open", value: open === true, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) return fail(OFFLINE);
  revalidatePath("/coach/free");
  revalidatePath("/join");
  return { ok: true };
}

// Change the recommended weekly target for a season. `max` makes it a
// range ("6 to 12 hours"); null makes it a single number.
export async function saveTargetRow(input: {
  season: Season;
  minutes: number;
  max: number | null;
}): Promise<{ ok: true } | Fail> {
  if (input.season !== "in_season" && input.season !== "off_season") return fail("Pick a season.");
  const minutes = cleanTarget(input.minutes);
  const max = input.max === null ? null : cleanTarget(input.max);
  if (minutes === null) return fail("Enter the hours in half-hour steps, from 0.5 to 40.");
  if (input.max !== null && (max === null || max <= minutes)) {
    return fail("The top of the range has to be more than the bottom, in half-hour steps.");
  }
  const c = await coach();
  if (c.kind === "no") return fail("Only a coach can change this.");
  if (c.kind === "demo") return { ok: true };
  const { error } = await c.admin
    .from("elite_target_table")
    .upsert(
      { season: input.season, minutes, minutes_max: max, updated_at: new Date().toISOString() },
      { onConflict: "season" }
    );
  if (error) return fail(OFFLINE);
  revalidatePath("/coach/free");
  return { ok: true };
}
