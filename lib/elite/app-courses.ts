// The Courses library as the native iPhone app (mobile/) is sent it, as
// pure functions of the same rows the website's Courses pages read
// (app/(player)/courses, components/elite/CourseLibrary.tsx).
//
// Nothing about a course is decided here a second time: what a member
// sees, the order, the cover, a step's name and clip are lib/elite/
// courses.ts, and a clip's still is lib/elite/drill-poster.ts. This file
// only shapes the answer for a phone: whole addresses for clips and
// pictures, a lesson's words cut into the blocks a phone draws, and the
// two ways the library is sent:
//
//   a member (the gate says "ok")   every course, open
//   any other signed-in account     the same shelf, every course locked:
//                                   its name, its line and its picture,
//                                   never a step. (A free account sees
//                                   what membership opens; a single course
//                                   is refused by the member gate.)
//
// The library is a library: nothing here is ticked, counted or tracked.
import type { Course, CourseStep, CourseTag } from "./types";
import { courseCover, courseForApp, levelsOf, linkCourseAsPages, stepIsUsable, stepTitle, stepVideo, visibleCourses } from "./courses";
import { drillPoster } from "./drill-poster";
import { absoluteMedia } from "./app-payload";

export type AppCourseCard = {
  slug: string;
  name: string;
  subtitle: string | null;
  cover: string | null;
  locked: boolean;
};

export type AppCourseList = {
  // True when every course on the shelf is locked for this account.
  locked: boolean;
  courses: AppCourseCard[];
};

// A lesson's words, a block at a time: a short line in capitals that the
// coach wrote above a passage is its heading; the lines under it keep
// their own line breaks (a CV template is one field to a line).
export type AppLessonBlock = { heading: string | null; text: string };

export type AppCourseStep = {
  id: string;
  kind: "drill" | "lesson";
  title: string;
  tag: CourseTag | null;
  cue: string | null;
  passMark: string | null;
  blocks: AppLessonBlock[];
  video: string | null;
  poster: string | null;
  download: string | null;
};

export type AppCourseLevel = {
  no: number;
  // "Level 3" in a course of drills, "Part 3" in a course of pages.
  label: string;
  name: string | null;
  steps: AppCourseStep[];
};

export type AppCourse = {
  slug: string;
  name: string;
  subtitle: string | null;
  kind: "drill" | "lesson";
  intro: string[];
  cover: string | null;
  levels: AppCourseLevel[];
};

// A course address is its slug (lib/elite/courses.ts slugify).
const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;
export function isCourseSlug(raw: unknown): raw is string {
  return typeof raw === "string" && SLUG.test(raw);
}

// The native app has no web page to open, so there a link course is
// always its own pages, or is left out when it has none: the website's
// rule for the App Store app (courseForApp), plus the one case that rule
// leaves to the web view (a link to a path on our own domain).
function forPhone(course: Course): Course | null {
  const shown = courseForApp(course, true);
  if (!shown) return null;
  return shown.kind === "link" ? linkCourseAsPages(shown) : shown;
}

// The shelf, in the website's order: the courses a member sees.
function shelf(courses: Course[]): Course[] {
  return visibleCourses(courses.flatMap((c) => forPhone(c) ?? []));
}

export function courseListPayload(courses: Course[], opts: { member: boolean; base: string }): AppCourseList {
  const locked = !opts.member;
  return {
    locked,
    courses: shelf(courses).map((c) => ({
      slug: c.slug,
      name: c.name,
      subtitle: c.subtitle?.trim() || null,
      cover: absoluteMedia(courseCover(c), opts.base),
      locked,
    })),
  };
}

const HEADING = /^[A-Z0-9][A-Z0-9 ,.'’:;&/()?!-]{0,59}$/;
function isHeading(line: string): boolean {
  return HEADING.test(line) && /[A-Z]/.test(line);
}

export function lessonBlocks(body: string | null | undefined): AppLessonBlock[] {
  return (body ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const lines = p.split("\n").map((l) => l.trim());
      if (isHeading(lines[0])) return { heading: lines[0], text: lines.slice(1).join("\n") };
      return { heading: null, text: lines.join("\n") };
    });
}

function appStep(s: CourseStep, base: string): AppCourseStep {
  const clip = stepVideo(s);
  return {
    id: s.id,
    kind: s.drill_id ? "drill" : "lesson",
    title: stepTitle(s),
    tag: s.tag ?? null,
    cue: s.cue?.trim() || null,
    passMark: s.pass_mark?.trim() || null,
    blocks: lessonBlocks(s.body),
    video: absoluteMedia(clip, base),
    poster: absoluteMedia(drillPoster(clip), base),
    download: absoluteMedia(s.download_url, base),
  };
}

// One course as a member sees it, by the website's own page rule
// (app/(player)/courses/[slug]/page.tsx): active only, usable steps only,
// and null (not found) when that leaves nothing.
export function coursePayload(found: Course | null | undefined, base: string): AppCourse | null {
  if (!found || !found.active) return null;
  const course = forPhone(found);
  if (!course) return null;
  const steps = course.steps.filter(stepIsUsable);
  if (steps.length === 0) return null;
  const kind = course.kind === "drill" ? "drill" : "lesson";
  return {
    slug: course.slug,
    name: course.name,
    subtitle: course.subtitle?.trim() || null,
    kind,
    intro: (course.intro ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
    cover: absoluteMedia(courseCover({ ...course, steps }), base),
    levels: levelsOf(steps).map((lvl) => ({
      no: lvl.no,
      label: `${kind === "drill" ? "Level" : "Part"} ${lvl.no}`,
      name: lvl.name?.trim() || null,
      steps: lvl.steps.map((s) => appStep(s, base)),
    })),
  };
}
