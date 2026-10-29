"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { getViewer } from "./session";
import { inviteRoleOf, type InviteRole } from "./invite-link";

export type InviteCode = {
  id: string;
  code: string;
  note: string;
  role: InviteRole;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
};

function newCode(): string {
  // Human-friendly single-use code, e.g. STRIVE-7F3K9Q
  const raw = randomUUID().replace(/-/g, "").toUpperCase();
  return `STRIVE-${raw.slice(0, 6)}`;
}

async function requireCoach() {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") return null;
  return viewer;
}

// Generate a new single-use invite code (coach only). A player code is
// the default; a COACH code (054) redeems as a coach profile and only an
// admin can make one, so a coach cannot mint more coaches.
export async function generateInviteCode(note: string, roleInput: InviteRole = "player") {
  const viewer = await requireCoach();
  if (!viewer) return { ok: false as const, error: "unauthorized" };
  const role = inviteRoleOf(roleInput);
  if (role === "coach" && viewer.role !== "admin") {
    return { ok: false as const, error: "Only the head coach can invite a coach." };
  }
  const supabase = createClient();
  if (!supabase) {
    // demo mode: hand back a code without persisting
    return { ok: true as const, code: newCode(), demo: true };
  }
  const code = newCode();
  const { error } = await supabase.from("elite_invite_codes").insert({
    code,
    note: note?.trim() || "",
    role,
    created_by: viewer.profile.id,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/coach");
  return { ok: true as const, code };
}

export async function listInviteCodes(): Promise<InviteCode[]> {
  const viewer = await requireCoach();
  if (!viewer) return [];
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("elite_invite_codes")
    .select("id, code, note, role, used_by, used_at, created_at")
    .order("created_at", { ascending: false });
  return ((data as InviteCode[] | null) ?? []).map((c) => ({ ...c, role: inviteRoleOf(c.role) }));
}
