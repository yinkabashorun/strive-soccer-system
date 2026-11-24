import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { courseListPayload, coursePayload, isCourseSlug, lessonBlocks } from "@/lib/elite/app-courses";
import { courseForApp, linkCourseAsPages, visibleCourses } from "@/lib/elite/courses";
import type { Course, CourseStep } from "@/lib/elite/types";

// The Courses library as the native iPhone app is sent it
// (lib/elite/app-courses.ts). The route-level checks (who gets what) are
// in tests/app-api.test.ts; the rules themselves are held here.

const BASE = "https://thestriveapp.com";

function step(over: Partial<CourseStep>): CourseStep {
  return {
    id: "s1",
    course_id: "c1",
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
    sort: 10,
    ...over,
  };
}
function lesson(id: string, title: string, body: string, over: Partial<CourseStep> = {}): CourseStep {
  return step({ id, title, body, ...over });
}
function course(over: Partial<Course>): Course {
  return { id: "c1", slug: "a-course", name: "A Course", subtitle: null, intro: null, kind: "lesson", external_url: null, cover_url: null, active: true, sort: 10, steps: [], ...over };
}

describe("a lesson's words on a phone", () => {
  it("are cut at blank lines, and a line in capitals is the heading of what follows", () => {
    const body = "Train on a full tank, never a full stomach.\n\nTWO TO THREE HOURS BEFORE\nA normal meal from the plate.\n\nRULES OF THUMB\n\nNothing new close to a session.";
    expect(lessonBlocks(body)).toEqual([
      { heading: null, text: "Train on a full tank, never a full stomach." },
      { heading: "TWO TO THREE HOURS BEFORE", text: "A normal meal from the plate." },
      { heading: "RULES OF THUMB", text: "" },
      { heading: null, text: "Nothing new close to a session." },
    ]);
  });

  it("keep a template one field to a line", () => {
    const blocks = lessonBlocks("TEMPLATE\n\n[Full name]\n[Graduation year] | [Position]\nTape: [link]\n\nCLUB\n[Club name], [team and league, e.g. U15 MLS NEXT]");
    expect(blocks).toEqual([
      { heading: "TEMPLATE", text: "" },
      { heading: null, text: "[Full name]\n[Graduation year] | [Position]\nTape: [link]" },
      { heading: "CLUB", text: "[Club name], [team and league, e.g. U15 MLS NEXT]" },
    ]);
  });

  it("never lose or change a word", () => {
    const body = "GRADE 9\nGrades count from day one.\r\n\r\nWHAT WE NEVER PROMISE\nA roster spot.\n\n\n\nA sentence that only STARTS in capitals.\n[BRACKETS] are a field, not a heading\nNo.";
    const words = (t: string) => t.split(/\s+/).filter(Boolean);
    const out = lessonBlocks(body);
    expect(out.flatMap((b) => [...words(b.heading ?? ""), ...words(b.text)])).toEqual(words(body));
    expect(out.map((b) => b.heading)).toEqual(["GRADE 9", "WHAT WE NEVER PROMISE", null]);
    expect(lessonBlocks("")).toEqual([]);
    expect(lessonBlocks(null)).toEqual([]);
    // a very long line in capitals is a sentence, not a heading; neither is a number
    expect(lessonBlocks("A".repeat(61))[0].heading).toBeNull();
    expect(lessonBlocks("2026\nThe year.")[0].heading).toBeNull();
  });
});

describe("a link course in the native app", () => {
  const pages = [lesson("p1", "Welcome", "Train five days a week.")];

  it("is its own pages, wherever its address points", () => {
    const outside = course({ kind: "link", external_url: "https://course.example.com/", intro: "the site's password", steps: pages });
    const own = course({ kind: "link", external_url: "/learn/dribbling", intro: "the site's password", steps: pages });
    // the website inside the App Store shell leaves a path on our own domain alone
    expect(courseForApp(own, true)?.kind).toBe("link");
    for (const c of [outside, own]) {
      const sent = coursePayload(c, BASE)!;
      expect(sent.kind).toBe("lesson");
      expect(sent.intro).toEqual([]);
      expect(JSON.stringify(sent)).not.toMatch(/password|example\.com|\/learn/);
      expect(courseListPayload([c], { member: true, base: BASE }).courses.map((x) => x.slug)).toEqual(["a-course"]);
    }
  });

  it("is left out when it has no pages of its own", () => {
    for (const external_url of ["https://course.example.com/", "/learn/dribbling"]) {
      const c = course({ kind: "link", external_url, steps: [] });
      expect(linkCourseAsPages(c)).toBeNull();
      expect(coursePayload(c, BASE)).toBeNull();
      expect(courseListPayload([c], { member: true, base: BASE }).courses).toEqual([]);
    }
  });
});

describe("the shelf", () => {
  const drill = (id: string, file: string | null) => ({ id, title: `Speed: ${id}`, video_url: file, active: true }) as unknown as CourseStep["drill"];
  const library = [
    course({ id: "b", slug: "b", name: "B", sort: 20, steps: [lesson("b1", "Page", "Words.")] }),
    course({ id: "a", slug: "a", name: "A", sort: 10, kind: "drill", steps: [step({ id: "a1", drill_id: "d1", drill: drill("d1", "/drills/speed-the-cross.mp4") })] }),
    course({ id: "off", slug: "off", name: "Off", active: false, steps: [lesson("o1", "Page", "Words.")] }),
    course({ id: "empty", slug: "empty", name: "Empty", kind: "drill", steps: [step({ id: "e1", drill_id: "d9", drill: drill("d9", null) })] }),
  ];

  it("is the website's: the same courses in the same order", () => {
    const sent = courseListPayload(library, { member: true, base: BASE });
    expect(sent.courses.map((c) => c.slug)).toEqual(visibleCourses(library).map((c) => c.slug));
    expect(sent.courses.map((c) => c.slug)).toEqual(["a", "b"]);
    expect(sent.courses[0].cover).toBe(`${BASE}/drills/posters/speed-the-cross.jpg`);
    expect(sent.courses[1].cover).toBeNull();
  });

  it("locked is the same shelf with nothing but the card", () => {
    const open = courseListPayload(library, { member: true, base: BASE });
    const locked = courseListPayload(library, { member: false, base: BASE });
    expect(locked.locked).toBe(true);
    expect(locked.courses).toEqual(open.courses.map((c) => ({ ...c, locked: true })));
  });

  it("a course off the shelf is not found, as on the website's page", () => {
    expect(coursePayload(null, BASE)).toBeNull();
    expect(coursePayload(library[2], BASE)).toBeNull(); // off
    expect(coursePayload(library[3], BASE)).toBeNull(); // nothing filmed
    expect(coursePayload(library[1], BASE)?.levels[0]).toMatchObject({ no: 1, label: "Level 1", name: null });
  });

  it("a course address is a slug and nothing else", () => {
    for (const ok of ["keep-it-up", "speed", "general-nutrition-guide", "a1"]) expect(isCourseSlug(ok), ok).toBe(true);
    for (const bad of ["", "Keep-It-Up", "../week", "a/b", "a b", "-a", "a".repeat(61), null, undefined, 7]) expect(isCourseSlug(bad), String(bad)).toBe(false);
  });

  it("is a library: nothing is ticked, counted or tracked", () => {
    const src = readFileSync(path.resolve(__dirname, "../lib/elite/app-courses.ts"), "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(src).not.toMatch(/completed|progress|percent|streak|done/i);
  });
});
