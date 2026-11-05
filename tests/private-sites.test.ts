import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PRIVATE_SITES, resolveSiteRequest } from "@/lib/elite/private-sites";

// Private course sites (Nov 5 2026): the only thing a request can name is
// one plain .html file inside a registered site's folder.
describe("private course sites", () => {
  const slug = "dribbling-transformation";

  it("the bare folder goes to the explicit index so relative links resolve", () => {
    expect(resolveSiteRequest(slug, undefined)).toEqual({ kind: "redirect-entry", to: `/learn/${slug}/index.html` });
    expect(resolveSiteRequest(slug, [])).toEqual({ kind: "redirect-entry", to: `/learn/${slug}/index.html` });
  });

  it("serves a plain html file of a registered site", () => {
    expect(resolveSiteRequest(slug, ["slide_01_hero.html"])).toEqual({
      kind: "file",
      dir: PRIVATE_SITES[slug].dir,
      file: "slide_01_hero.html",
    });
  });

  it("refuses anything else", () => {
    for (const bad of [
      ["..", "..", "package.json"],
      ["../package.json"],
      ["serve.py"],
      ["slide.html", "extra"],
      ["a b.html"],
      [".html"],
      ["slide.HTML.exe"],
      ["%2e%2e%2fpackage.json"],
      ["index.html/"],
    ]) {
      expect(resolveSiteRequest(slug, bad).kind).toBe("none");
    }
    expect(resolveSiteRequest("nope", ["index.html"]).kind).toBe("none");
    expect(resolveSiteRequest("__proto__", ["index.html"]).kind).toBe("none");
    expect(resolveSiteRequest("constructor", ["index.html"]).kind).toBe("none");
  });

  it("every registered site has its entry file on disk, and every page link inside it resolves", async () => {
    for (const [, site] of Object.entries(PRIVATE_SITES)) {
      const dir = path.join(process.cwd(), site.dir);
      const files = new Set((await fs.readdir(dir)).filter((f) => f.endsWith(".html")));
      expect(files.has(site.entry)).toBe(true);
      for (const f of files) {
        const html = await fs.readFile(path.join(dir, f), "utf8");
        for (const m of html.matchAll(/href="([^"#?]+\.html)"/g)) {
          expect(files.has(m[1]), `${f} links to ${m[1]}`).toBe(true);
        }
      }
    }
  });
});
