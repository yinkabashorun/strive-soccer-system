"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { getViewer } from "./session";
import { slugify, validateStepInput, type StepInput } from "./courses";
import type { CourseKind } from "./types";

// Courses (offer stack item 9, Oct 26 2026). Coach-only writes through
// the cookie client (RLS: elite_is_coach), the same as the drill bank and
// the few-yards templates. A course is a name plus ordered steps; a step
// is a bank drill by id or a lesson page (lib/elite/courses.ts validates
// the shape before the database's own constraint does). Demo mode
// returns ok without persisting.

async function coachClient() {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") return { error: "unauthorized" as const };
  if (viewer.demo) return { demo: true as const };
  const supabase = createClient();
  if (!supabase) return { demo: true as const };
  return { supabase };
}

const paths = () => {
  revalidatePath("/coach/drills");
  revalidatePath("/courses");
};

export type CourseInput = {
  id?: string;
  name: string;
  subtitle?: string | null;
  intro?: string | null;
  kind: CourseKind;
};

export async function saveCourse(input: CourseInput) {
  const c = await coachClient();
  if ("error" in c) return { ok: false as const, error: c.error };
  if ("demo" in c) return { ok: true as const };

  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false as const, error: "Give the course a name." };
  const kind: CourseKind = input.kind === "lesson" ? "lesson" : "drill";
  const subtitle = (input.subtitle ?? "").trim().slice(0, 120) || null;
  const intro = (input.intro ?? "").trim().slice(0, 2000) || null;

  if (input.id) {
    // The kind is fixed once steps exist: a drill step cannot become a lesson.
    const { error } = await c.supabase
      .from("elite_courses")
      .update({ name, subtitle, intro })
      .eq("id", input.id);
    if (error) return { ok: false as const, error: "Couldn't save the course." };
    paths();
    return { ok: true as const, id: input.id };
  }

  const base = slugify(name) || "course";
  const { data: taken } = await c.supabase.from("elite_courses").select("slug").like("slug", `${base}%`);
  const slugs = new Set(((taken as { slug: string }[] | null) ?? []).map((r) => r.slug));
  let slug = base;
  for (let i = 2; slugs.has(slug); i++) slug = `${base}-${i}`;
  const { data: last } = await c.supabase
    .from("elite_courses")
    .select("sort")
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await c.supabase
    .from("elite_courses")
    .insert({ slug, name, subtitle, intro, kind, active: false, sort: ((last?.sort as number | undefined) ?? 0) + 10 })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: "Couldn't create the course. Run database migration 041 first." };
  paths();
  return { ok: true as const, id: data.id as string };
}

export async function setCourseActive(id: string, active: boolean) {
  const c = await coachClient();
  if ("error" in c) return { ok: false as const, error: c.error };
  if ("demo" in c) return { ok: true as const };
  const { error } = await c.supabase.from("elite_courses").update({ active }).eq("id", id);
  if (error) return { ok: false as const, error: "Couldn't update the course." };
  paths();
  return { ok: true as const };
}

// Hard delete; the steps go with it (on delete cascade). Bank drills are
// untouched: a course only points at them.
export async function deleteCourse(id: string) {
  const c = await coachClient();
  if ("error" in c) return { ok: false as const, error: c.error };
  if ("demo" in c) return { ok: true as const };
  const { error } = await c.supabase.from("elite_courses").delete().eq("id", id);
  if (error) return { ok: false as const, error: "Couldn't delete the course." };
  paths();
  return { ok: true as const };
}

export async function saveCourseStep(input: StepInput) {
  const c = await coachClient();
  if ("error" in c) return { ok: false as const, error: c.error };
  if ("demo" in c) return { ok: true as const };

  const { data: course } = await c.supabase
    .from("elite_courses")
    .select("id, kind")
    .eq("id", input.course_id)
    .maybeSingle();
  if (!course) return { ok: false as const, error: "Course not found." };
  const v = validateStepInput((course as { kind: CourseKind }).kind, input);
  if (!v.ok) return { ok: false as const, error: v.error };

  if (input.id) {
    const { error } = await c.supabase.from("elite_course_steps").update(v.row).eq("id", input.id);
    if (error) return { ok: false as const, error: "Couldn't save the step." };
    paths();
    return { ok: true as const, id: input.id };
  }
  const { data: last } = await c.supabase
    .from("elite_course_steps")
    .select("sort")
    .eq("course_id", input.course_id)
    .eq("level_no", v.row.level_no)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await c.supabase
    .from("elite_course_steps")
    .insert({ ...v.row, sort: ((last?.sort as number | undefined) ?? 0) + 10 })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: "Couldn't add the step." };
  paths();
  return { ok: true as const, id: data.id as string };
}

export async function deleteCourseStep(id: string) {
  const c = await coachClient();
  if ("error" in c) return { ok: false as const, error: c.error };
  if ("demo" in c) return { ok: true as const };
  const { error } = await c.supabase.from("elite_course_steps").delete().eq("id", id);
  if (error) return { ok: false as const, error: "Couldn't remove the step." };
  paths();
  return { ok: true as const };
}

// Move a step up or down within its level. Sorts are renumbered by tens
// first so two steps saved with the same sort can still trade places.
export async function moveCourseStep(id: string, dir: -1 | 1) {
  const c = await coachClient();
  if ("error" in c) return { ok: false as const, error: c.error };
  if ("demo" in c) return { ok: true as const };
  const { data: me } = await c.supabase
    .from("elite_course_steps")
    .select("id, course_id, level_no")
    .eq("id", id)
    .maybeSingle();
  if (!me) return { ok: false as const, error: "Step not found." };
  const row = me as { id: string; course_id: string; level_no: number };
  const { data: sib } = await c.supabase
    .from("elite_course_steps")
    .select("id, sort")
    .eq("course_id", row.course_id)
    .eq("level_no", row.level_no)
    .order("sort");
  const steps = ((sib as { id: string; sort: number }[] | null) ?? []).map((s, i) => ({ id: s.id, sort: (i + 1) * 10 }));
  const i = steps.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= steps.length) return { ok: true as const };
  [steps[i].sort, steps[j].sort] = [steps[j].sort, steps[i].sort];
  for (const s of steps) {
    const { error } = await c.supabase.from("elite_course_steps").update({ sort: s.sort }).eq("id", s.id);
    if (error) return { ok: false as const, error: "Couldn't reorder." };
  }
  paths();
  return { ok: true as const };
}
