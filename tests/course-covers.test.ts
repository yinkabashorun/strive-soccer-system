import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanCoverUrl, courseCover } from "@/lib/elite/courses";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

// Course covers (080, Nov 22 2026): every course card carries a picture.
describe("course cover pictures", () => {
  it("only a path to an image on our own site is accepted", () => {
    expect(cleanCoverUrl("/courses/speed.jpg")).toBe("/courses/speed.jpg");
    expect(cleanCoverUrl(" /drills/posters/plyo-pogo-jumps.jpg ")).toBe("/drills/posters/plyo-pogo-jumps.jpg");
    for (const bad of [
      "https://example.com/a.jpg",
      "//example.com/a.jpg",
      "/courses/../secret.jpg",
      "/courses/a.svg",
      "javascript:alert(1)",
      "/courses/a b.jpg",
      "",
      null,
    ]) {
      expect(cleanCoverUrl(bad as string | null)).toBeNull();
    }
  });

  it("the picked picture wins over the first drill's still", () => {
    expect(courseCover({ cover_url: "/courses/strength.jpg", steps: [] })).toBe("/courses/strength.jpg");
    expect(courseCover({ cover_url: "https://x.com/a.jpg", steps: [] })).toBeNull();
    expect(courseCover({ steps: [] })).toBeNull();
  });

  it("every cover the migration sets is a real file in public/", () => {
    const sql = read("supabase/migrations/080_course_covers.sql");
    const paths = [...sql.matchAll(/cover_url = '(\/courses\/[a-z0-9-]+\.jpg)'/g)].map((m) => m[1]);
    expect(paths.length).toBe(5);
    for (const p of paths) {
      expect(cleanCoverUrl(p)).toBe(p);
      expect(existsSync(resolve(root, "public" + p)), p).toBe(true);
    }
  });

  it("the server and the database hold the same rule", () => {
    expect(read("lib/elite/course-actions.ts")).toContain("cleanCoverUrl(coverRaw)");
    expect(read("supabase/migrations/080_course_covers.sql")).toContain("elite_courses_cover_url_check");
  });
});
