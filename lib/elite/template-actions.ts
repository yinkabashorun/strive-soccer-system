"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { getViewer } from "./session";

// Few-yards template sessions (offer stack item 3b, Oct 12 2026). Coach-
// only writes through the cookie client (RLS: elite_is_coach), the same
// as the drill bank. A template is a title plus an ordered list of filmed
// skill drills; the database marks each placed drill "works in a few
// yards" (migration 035 trigger). Demo mode returns ok without persisting.

export type TemplateInput = {
  id?: string; // present = update, absent = create
  title: string;
  drill_ids: string[]; // ordered
};

async function coachClient() {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") return { error: "unauthorized" as const };
  if (viewer.demo) return { demo: true as const };
  const supabase = createClient();
  if (!supabase) return { demo: true as const };
  return { supabase };
}

export async function saveSessionTemplate(input: TemplateInput) {
  const c = await coachClient();
  if ("error" in c) return { ok: false as const, error: c.error };
  if ("demo" in c) return { ok: true as const };

  const title = input.title.trim().slice(0, 120);
  const drillIds = [...new Set(input.drill_ids.filter(Boolean))].slice(0, 6);
  if (!title) return { ok: false as const, error: "Give the session a name." };
  if (drillIds.length === 0) return { ok: false as const, error: "Pick at least one drill." };

  let id = input.id;
  if (id) {
    const { error } = await c.supabase.from("elite_session_templates").update({ title }).eq("id", id);
    if (error) return { ok: false as const, error: "Couldn't save the session." };
    await c.supabase.from("elite_session_template_drills").delete().eq("template_id", id);
  } else {
    const { data: last } = await c.supabase
      .from("elite_session_templates")
      .select("sort")
      .order("sort", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await c.supabase
      .from("elite_session_templates")
      .insert({ title, space: "tight", sort: ((last?.sort as number | undefined) ?? 0) + 10 })
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false as const, error: "Couldn't save. Run database migration 035 first." };
    }
    id = data.id as string;
  }
  const { error: dErr } = await c.supabase
    .from("elite_session_template_drills")
    .insert(drillIds.map((drill_id, sort) => ({ template_id: id, drill_id, sort })));
  if (dErr) return { ok: false as const, error: "Couldn't save the drills for this session." };

  revalidatePath("/coach/drills");
  return { ok: true as const, id };
}

export async function setSessionTemplateActive(id: string, active: boolean) {
  const c = await coachClient();
  if ("error" in c) return { ok: false as const, error: c.error };
  if ("demo" in c) return { ok: true as const };
  const { error } = await c.supabase.from("elite_session_templates").update({ active }).eq("id", id);
  if (error) return { ok: false as const, error: "Couldn't update the session." };
  revalidatePath("/coach/drills");
  return { ok: true as const };
}

// Hard delete. Homework rows that came from this template keep their
// drills; their template_id goes null (on delete set null).
export async function deleteSessionTemplate(id: string) {
  const c = await coachClient();
  if ("error" in c) return { ok: false as const, error: c.error };
  if ("demo" in c) return { ok: true as const };
  const { error } = await c.supabase.from("elite_session_templates").delete().eq("id", id);
  if (error) return { ok: false as const, error: "Couldn't delete the session." };
  revalidatePath("/coach/drills");
  return { ok: true as const };
}
