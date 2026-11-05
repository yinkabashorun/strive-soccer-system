import { describe, expect, it } from "vitest";
import {
  cleanExternalUrl,
  isInternalHref,
  courseIsUsable,
  courseNotice,
  externalHref,
  levelsOf,
  libraryCourses,
  slugify,
  stepIsUsable,
  stepTitle,
  stepVideo,
  stripLabel,
  validateStepInput,
  visibleCourses,
} from "@/lib/elite/courses";
import type { Course, CourseStep, Drill } from "@/lib/elite/types";

// Courses (offer stack item 9, Oct 26 2026): the Courses tab is a library
// every member sees; a course is drill steps (bank rows by id) or lesson
// steps (pages), never both in one step.
function drill(title: string, extra: Partial<Drill> = {}): Drill {
  return {
    id: title.toLowerCase().replace(/\W+/g, "-"),
    pillar: "Ball Mastery",
    title,
    how: "x",
    reps: "x",
    minutes: 5,
    cues: "",
    needs_wall: false,
    active: true,
    video_url: `https://thestriveapp.com/drills/${title.toLowerCase().replace(/\W+/g, "-")}.mp4`,
    sort: 0,
    ...extra,
  } as Drill;
}

function step(partial: Partial<CourseStep>): CourseStep {
  return {
    id: Math.random().toString(36).slice(2),
    course_id: "c",
    level_no: 1,
    level_name: null,
    tag: null,
    drill_id: null,
    drill: null,
    title: null,
    body: null,
    video_url: null,
    download_url: null,
    cue: null,
    pass_mark: null,
    sort: 0,
    ...partial,
  };
}

describe("titles", () => {
  it("strips the bank's label prefix and capitalises the drill's own name", () => {
    expect(stripLabel("Juggling: one touch, catch")).toBe("One touch, catch");
    expect(stripLabel("Strength: Front plank")).toBe("Front plank");
    expect(stripLabel("Plyo warm-up: Pogo jumps")).toBe("Pogo jumps");
    expect(stripLabel("Ronaldinho drill")).toBe("Ronaldinho drill");
  });
  it("a drill step shows the drill, a lesson step shows its own title", () => {
    const d = drill("Juggling: head it up");
    expect(stepTitle(step({ drill_id: d.id, drill: d }))).toBe("Head it up");
    expect(stepTitle(step({ title: "The highlight tape", body: "x" }))).toBe("The highlight tape");
    expect(stepVideo(step({ drill_id: d.id, drill: d }))).toBe(d.video_url);
    expect(stepVideo(step({ title: "t", body: "b", video_url: "https://v/x.mp4" }))).toBe("https://v/x.mp4");
  });
  it("slugs are url-safe", () => {
    expect(slugify("Keep It Up")).toBe("keep-it-up");
    expect(slugify("General Nutrition Guide")).toBe("general-nutrition-guide");
    expect(slugify("  Coach's Weak Foot!! ")).toBe("coachs-weak-foot");
  });
});

describe("levels", () => {
  it("groups steps by level in ladder order, steps in the coach's order", () => {
    const steps = [
      step({ level_no: 2, level_name: "Two", sort: 20, title: "b2", body: "x" }),
      step({ level_no: 1, level_name: "One", sort: 20, title: "a2", body: "x" }),
      step({ level_no: 1, level_name: null, sort: 10, title: "a1", body: "x" }),
      step({ level_no: 2, level_name: "Two", sort: 10, title: "b1", body: "x" }),
    ];
    const levels = levelsOf(steps);
    expect(levels.map((l) => l.no)).toEqual([1, 2]);
    expect(levels[0].name).toBe("One"); // the first named step names the level
    expect(levels[0].steps.map((s) => s.title)).toEqual(["a1", "a2"]);
    expect(levels[1].steps.map((s) => s.title)).toEqual(["b1", "b2"]);
  });
});

describe("step shape", () => {
  it("a drill course step needs a drill and carries no lesson text", () => {
    const bad = validateStepInput("drill", { course_id: "c", level_no: 1 });
    expect(bad.ok).toBe(false);
    const ok = validateStepInput("drill", { course_id: "c", level_no: 3, drill_id: "d1", tag: "beginner", cue: " Toe up. ", pass_mark: "10 in a row", title: "ignored", body: "ignored" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.row.drill_id).toBe("d1");
      expect(ok.row.title).toBeNull();
      expect(ok.row.body).toBeNull();
      expect(ok.row.cue).toBe("Toe up.");
      expect(ok.row.level_no).toBe(3);
    }
  });
  it("a lesson course step needs a title and a body and carries no drill", () => {
    const bad = validateStepInput("lesson", { course_id: "c", level_no: 1, title: "CV" });
    expect(bad.ok).toBe(false);
    const ok = validateStepInput("lesson", { course_id: "c", level_no: 1, title: "The CV", body: "One page.", drill_id: "ignored", video_url: "https://v/x.mp4" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.row.drill_id).toBeNull();
      expect(ok.row.title).toBe("The CV");
      expect(ok.row.video_url).toBe("https://v/x.mp4");
    }
  });
  it("refuses a bad level or a link that is not a link, and drops an unknown tag", () => {
    expect(validateStepInput("drill", { course_id: "c", level_no: 0, drill_id: "d" }).ok).toBe(false);
    expect(validateStepInput("lesson", { course_id: "c", level_no: 1, title: "t", body: "b", video_url: "not a link" }).ok).toBe(false);
    const r = validateStepInput("drill", { course_id: "c", level_no: 1, drill_id: "d", tag: "expert" as never });
    expect(r.ok && r.row.tag).toBeNull();
  });
});

describe("what members see", () => {
  const filmed = drill("Juggling: one touch, catch");
  const unfilmed = drill("Juggling: head it up", { video_url: "" });
  const paused = drill("Juggling: laces, inside, catch", { active: false });
  const course = (over: Partial<Course>): Course => ({
    id: "c",
    slug: "keep-it-up",
    name: "Keep It Up",
    subtitle: null,
    intro: null,
    kind: "drill",
    active: true,
    sort: 10,
    steps: [],
    ...over,
  });
  it("an unfilmed or paused drill step is never shown; a lesson step needs its text", () => {
    expect(stepIsUsable(step({ drill_id: filmed.id, drill: filmed }))).toBe(true);
    expect(stepIsUsable(step({ drill_id: unfilmed.id, drill: unfilmed }))).toBe(false);
    expect(stepIsUsable(step({ drill_id: paused.id, drill: paused }))).toBe(false);
    expect(stepIsUsable(step({ title: "t", body: "b" }))).toBe(true);
    expect(stepIsUsable(step({ title: "t", body: null }))).toBe(false);
  });
  it("only active courses with at least one usable step reach the tab, in sort order", () => {
    const list = visibleCourses([
      course({ id: "b", slug: "b", name: "B", sort: 20, steps: [step({ drill_id: filmed.id, drill: filmed })] }),
      course({ id: "off", slug: "off", name: "Off", active: false, steps: [step({ drill_id: filmed.id, drill: filmed })] }),
      course({ id: "empty", slug: "empty", name: "Empty", steps: [step({ drill_id: unfilmed.id, drill: unfilmed })] }),
      course({ id: "a", slug: "a", name: "A", sort: 10, steps: [step({ title: "t", body: "b" }), step({ drill_id: unfilmed.id, drill: unfilmed })] }),
    ]);
    expect(list.map((c) => c.id)).toEqual(["a", "b"]);
    expect(list[0].steps).toHaveLength(1);
  });
  // Oct 29 2026: the coach shell shows the same library, plus what a
  // member cannot see yet, each with the reason.
  it("staff see every course in order, members only the visible ones", () => {
    const all = [
      course({ id: "b", slug: "b", name: "B", sort: 20, steps: [step({ drill_id: filmed.id, drill: filmed })] }),
      course({ id: "off", slug: "off", name: "Off", sort: 30, active: false, steps: [step({ drill_id: filmed.id, drill: filmed })] }),
      course({ id: "empty", slug: "empty", name: "Empty", sort: 40, steps: [step({ drill_id: unfilmed.id, drill: unfilmed })] }),
      course({ id: "a", slug: "a", name: "A", sort: 10, steps: [step({ title: "t", body: "b" })] }),
    ];
    expect(libraryCourses(all, { staff: false }).map((c) => c.id)).toEqual(["a", "b"]);
    const staff = libraryCourses(all, { staff: true });
    expect(staff.map((c) => c.id)).toEqual(["a", "b", "off", "empty"]);
    expect(staff.find((c) => c.id === "empty")?.steps).toHaveLength(0);
  });
  it("names why a member would not see a course", () => {
    expect(courseNotice(course({ steps: [step({ title: "t", body: "b" })] }))).toBeNull();
    expect(courseNotice(course({ active: false, steps: [step({ title: "t", body: "b" })] }))).toMatch(/^Off\./);
    expect(courseNotice(course({ steps: [step({ drill_id: unfilmed.id, drill: unfilmed })] }))).toMatch(/^Nothing to show yet/);
  });
});

// LINK courses (058, Nov 4 2026): a card that opens a page outside the
// app. https only; no steps; shown when active with a good address.
function course(partial: Partial<Course>): Course {
  return {
    id: "c1",
    slug: "c1",
    name: "C",
    subtitle: null,
    intro: null,
    kind: "drill",
    active: true,
    sort: 0,
    steps: [],
    ...partial,
  };
}

describe("link courses", () => {
  it("only an https address ever becomes a link", () => {
    expect(cleanExternalUrl("https://totalballmastery.netlify.app/")).toBe("https://totalballmastery.netlify.app/");
    expect(cleanExternalUrl("  https://example.com/a?b=1  ")).toBe("https://example.com/a?b=1");
    expect(cleanExternalUrl("http://example.com")).toBeNull();
    expect(cleanExternalUrl("javascript:alert(1)")).toBeNull();
    expect(cleanExternalUrl("data:text/html,x")).toBeNull();
    expect(cleanExternalUrl("//example.com")).toBeNull();
    expect(cleanExternalUrl("/\\evil.com")).toBeNull();
    expect(cleanExternalUrl("https://exa mple.com")).toBeNull();
    expect(cleanExternalUrl("")).toBeNull();
    expect(cleanExternalUrl(null)).toBeNull();
  });

  it("a path on our own site is a good address (059), a doubled slash is not", () => {
    expect(cleanExternalUrl("/learn/dribbling-transformation/index.html")).toBe("/learn/dribbling-transformation/index.html");
    expect(cleanExternalUrl("/ x")).toBeNull();
    expect(cleanExternalUrl("/")).toBeNull();
    expect(isInternalHref("/learn/x/index.html")).toBe(true);
    expect(isInternalHref("https://example.com/")).toBe(false);
  });

  it("externalHref is set for a link course only", () => {
    const url = "https://totalballmastery.netlify.app/";
    expect(externalHref({ kind: "link", external_url: url })).toBe(url);
    expect(externalHref({ kind: "link", external_url: "http://x.com" })).toBeNull();
    expect(externalHref({ kind: "drill", external_url: url })).toBeNull();
  });

  it("a link course is on the tab when active with a good address, no steps needed", () => {
    const url = "https://totalballmastery.netlify.app/";
    const ok = course({ slug: "dribbling", kind: "link", external_url: url });
    expect(courseIsUsable(ok)).toBe(true);
    expect(visibleCourses([ok]).map((c) => c.slug)).toEqual(["dribbling"]);
    expect(visibleCourses([{ ...ok, active: false }])).toEqual([]);
    expect(visibleCourses([{ ...ok, external_url: null }])).toEqual([]);
    expect(visibleCourses([{ ...ok, external_url: "http://x.com" }])).toEqual([]);
  });

  it("a drill or lesson course still needs a usable step", () => {
    expect(visibleCourses([course({ kind: "lesson", steps: [] })])).toEqual([]);
    const lesson = step({ title: "T", body: "B" });
    expect(visibleCourses([course({ kind: "lesson", steps: [lesson] })])).toHaveLength(1);
  });

  it("staff see why a link course is hidden", () => {
    const url = "https://totalballmastery.netlify.app/";
    expect(courseNotice(course({ kind: "link", external_url: url }))).toBeNull();
    expect(courseNotice(course({ kind: "link", external_url: null }))).toMatch(/good address/);
    expect(courseNotice(course({ kind: "link", external_url: url, active: false }))).toMatch(/^Off/);
  });

  it("a link course takes no steps", () => {
    const v = validateStepInput("link", { course_id: "c", level_no: 1, title: "T", body: "B" });
    expect(v.ok).toBe(false);
  });
});
