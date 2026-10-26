// Courses (offer stack item 9, Oct 26 2026): the pure rules behind the
// Courses tab and the coach's course editor. No I/O here; data.ts reads
// the rows and course-actions.ts writes them.
//
// A course is a named, ordered ladder of steps grouped into levels. A
// DRILL course's steps are bank drills by id (the video, the bank title
// and the reps live on the drill row and follow it); a LESSON course's
// steps are pages. The tab is a library: every member sees every active
// course, nothing is ticked or tracked (Coach Yinka, Oct 23 2026).

import type { Course, CourseKind, CourseStep, CourseTag } from "./types";

export const COURSE_TAGS: CourseTag[] = ["beginner", "advanced"];

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Bank titles carry a label prefix so the player app can badge them from
// the title alone ("Juggling: one touch, catch", "Strength: Front plank",
// "Plyo warm-up: Pogo jumps"). Inside a course the course IS the label,
// so a step shows the drill's own name, capitalised.
export function stripLabel(title: string): string {
  const rest = title.replace(/^[^:]{1,40}:\s*/, "").trim();
  if (!rest) return title.trim();
  return rest[0].toUpperCase() + rest.slice(1);
}

export function stepTitle(step: Pick<CourseStep, "drill" | "title">): string {
  if (step.drill?.title) return stripLabel(step.drill.title);
  return (step.title ?? "").trim();
}

export function stepVideo(step: Pick<CourseStep, "drill" | "video_url">): string | null {
  return step.drill?.video_url || step.video_url || null;
}

export type CourseLevel = { no: number; name: string | null; steps: CourseStep[] };

// Levels in ladder order, each with its steps in the coach's order.
export function levelsOf(steps: CourseStep[]): CourseLevel[] {
  const sorted = [...steps].sort((a, b) => a.level_no - b.level_no || a.sort - b.sort);
  const out: CourseLevel[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.no === s.level_no) {
      last.steps.push(s);
      if (!last.name && s.level_name) last.name = s.level_name;
    } else {
      out.push({ no: s.level_no, name: s.level_name ?? null, steps: [s] });
    }
  }
  return out;
}

// What the coach editor sends for one step. Validated here so the
// database's shape constraint (drill XOR lesson) is never the first thing
// to say no.
export type StepInput = {
  id?: string;
  course_id: string;
  level_no: number;
  level_name?: string | null;
  tag?: CourseTag | null;
  drill_id?: string | null;
  title?: string | null;
  body?: string | null;
  video_url?: string | null;
  download_url?: string | null;
  cue?: string | null;
  pass_mark?: string | null;
};

export type StepRow = {
  course_id: string;
  level_no: number;
  level_name: string | null;
  tag: CourseTag | null;
  drill_id: string | null;
  title: string | null;
  body: string | null;
  video_url: string | null;
  download_url: string | null;
  cue: string | null;
  pass_mark: string | null;
};

const clean = (s: string | null | undefined, max: number) => {
  const t = (s ?? "").trim().slice(0, max);
  return t ? t : null;
};

const isHttp = (s: string) => /^https?:\/\/\S+$/i.test(s) || s.startsWith("/");

export function validateStepInput(
  kind: CourseKind,
  input: StepInput
): { ok: true; row: StepRow } | { ok: false; error: string } {
  const level_no = Math.floor(Number(input.level_no));
  if (!Number.isFinite(level_no) || level_no < 1 || level_no > 99) {
    return { ok: false, error: "Level must be a number from 1 to 99." };
  }
  const tag = input.tag && COURSE_TAGS.includes(input.tag) ? input.tag : null;
  const video_url = clean(input.video_url, 500);
  const download_url = clean(input.download_url, 500);
  if (video_url && !isHttp(video_url)) return { ok: false, error: "The video link must start with https://." };
  if (download_url && !isHttp(download_url)) return { ok: false, error: "The download link must start with https://." };

  const base = {
    course_id: input.course_id,
    level_no,
    level_name: clean(input.level_name, 80),
    tag,
    cue: clean(input.cue, 400),
    pass_mark: clean(input.pass_mark, 80),
    download_url,
  };

  if (kind === "drill") {
    const drill_id = clean(input.drill_id, 64);
    if (!drill_id) return { ok: false, error: "Pick a drill from the bank." };
    return {
      ok: true,
      row: { ...base, drill_id, title: null, body: null, video_url: null },
    };
  }
  const title = clean(input.title, 120);
  const body = clean(input.body, 8000);
  if (!title) return { ok: false, error: "Give the lesson a title." };
  if (!body) return { ok: false, error: "Write the lesson." };
  return {
    ok: true,
    row: { ...base, drill_id: null, title, body, video_url },
  };
}

// A course is shown on the tab when it is active and has at least one
// step a member can use: a filmed, active drill, or a lesson.
export function stepIsUsable(step: CourseStep): boolean {
  if (step.drill_id) return Boolean(step.drill && step.drill.active !== false && step.drill.video_url);
  return Boolean(step.title && step.body);
}

export function visibleCourses(courses: Course[]): Course[] {
  return courses
    .filter((c) => c.active)
    .map((c) => ({ ...c, steps: c.steps.filter(stepIsUsable) }))
    .filter((c) => c.steps.length > 0)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}
