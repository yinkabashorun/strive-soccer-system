"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "./supabase/server";
import { getViewer } from "./session";
import { nyToday } from "./time";
import { daysBetween, MAX_BREAK_DAYS, settleBreaks, shiftDays } from "./breaks";
import type { TrainingBreak } from "./types";

// Breaks from training (offer stack item 8, Oct 12 2026). A family sets
// the day they are back; the coach can set or end one for them. Every
// write goes through the service client after the role / ownership
// check, the same pattern as Extra Work and onboarding (players cannot
// write their own rows under RLS). The program clock is moved by
// settleBreaks (lib/elite/breaks.ts), never here.

type Ok = { ok: true };
type Err = { ok: false; error: string };

function validUntil(until: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return "Pick the day you're back.";
  if (until < today) return "That day has already passed.";
  if (daysBetween(today, until) > MAX_BREAK_DAYS) return `A break can run up to ${MAX_BREAK_DAYS} days. Set another one later if you need to.`;
  return null;
}

async function openBreak(admin: NonNullable<ReturnType<typeof createServiceClient>>, playerId: string, today: string) {
  const { data } = await admin
    .from("elite_training_breaks")
    .select("*")
    .eq("player_id", playerId)
    .gte("until", today)
    .order("since", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as TrainingBreak | null) ?? null;
}

// Set (or move the end of) a break starting today. One open break at a time.
async function setBreak(playerId: string, until: string, createdBy: "player" | "coach", note = "") {
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: "Not available right now." } as Err;
  const today = nyToday();
  const bad = validUntil(until, today);
  if (bad) return { ok: false, error: bad } as Err;

  const existing = await openBreak(admin, playerId, today);
  const { error } = existing
    ? await admin
        .from("elite_training_breaks")
        .update({ until, note: note || existing.note, created_by: createdBy, resumed_at: null })
        .eq("id", existing.id)
    : await admin.from("elite_training_breaks").insert({
        player_id: playerId,
        since: today,
        until,
        note,
        created_by: createdBy,
      });
  if (error) return { ok: false, error: "Couldn't save the break. Try again." } as Err;
  return { ok: true } as Ok;
}

// End the open break today: a break that never started is removed, one in
// progress ends yesterday, then the program clock is settled right away so
// the player sees the right week on the next screen.
async function endBreak(playerId: string, week1Monday: string | null | undefined) {
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: "Not available right now." } as Err;
  const today = nyToday();
  const existing = await openBreak(admin, playerId, today);
  if (!existing) return { ok: true } as Ok;
  if (existing.since >= today) {
    await admin.from("elite_training_breaks").delete().eq("id", existing.id);
  } else {
    await admin
      .from("elite_training_breaks")
      .update({ until: shiftDays(today, -1) })
      .eq("id", existing.id);
    await settleBreaks(admin, { id: playerId, week1_monday: week1Monday }, today);
  }
  return { ok: true } as Ok;
}

async function ownPlayer() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  return viewer;
}

async function requireCoach() {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") return null;
  return viewer;
}

async function week1MondayOf(playerId: string): Promise<string | null | undefined> {
  const admin = createServiceClient();
  if (!admin) return undefined;
  const { data } = await admin.from("elite_players").select("week1_monday").eq("id", playerId).maybeSingle();
  return (data as { week1_monday?: string | null } | null)?.week1_monday;
}

// --- player ---------------------------------------------------------------

export async function startBreak(until: string): Promise<Ok | Err> {
  const viewer = await ownPlayer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  if (viewer.demo) return { ok: true };
  const res = await setBreak(viewer.playerId!, until, "player");
  if (res.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/homework");
  }
  return res;
}

export async function endBreakNow(): Promise<Ok | Err> {
  const viewer = await ownPlayer();
  if (!viewer) return { ok: false, error: "Sign in first." };
  if (viewer.demo) return { ok: true };
  const res = await endBreak(viewer.playerId!, await week1MondayOf(viewer.playerId!));
  if (res.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/homework");
  }
  return res;
}

// --- coach ----------------------------------------------------------------

export async function coachSetBreak(playerId: string, until: string, note = ""): Promise<Ok | Err> {
  if (!(await requireCoach())) return { ok: false, error: "Not authorized." };
  const res = await setBreak(playerId, until, "coach", note.trim().slice(0, 200));
  if (res.ok) {
    revalidatePath(`/coach/players/${playerId}`);
    revalidatePath("/coach");
  }
  return res;
}

export async function coachEndBreak(playerId: string): Promise<Ok | Err> {
  if (!(await requireCoach())) return { ok: false, error: "Not authorized." };
  const res = await endBreak(playerId, await week1MondayOf(playerId));
  if (res.ok) {
    revalidatePath(`/coach/players/${playerId}`);
    revalidatePath("/coach");
  }
  return res;
}
