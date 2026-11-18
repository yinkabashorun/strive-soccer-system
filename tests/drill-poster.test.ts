import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { drillPoster, preloadNextClip } from "@/lib/elite/drill-poster";

const ROOT = resolve(__dirname, "..");
const DRILLS = join(ROOT, "public/drills");
const POSTERS = join(DRILLS, "posters");

// App Store punch list A6: a drill shows its picture at once, never a
// black box while the video loads.
describe("the still picture for a drill clip", () => {
  it("a clip on our own domain has its poster beside it", () => {
    expect(drillPoster("/drills/weak-foot-tap-pull-push.mp4")).toBe(
      "/drills/posters/weak-foot-tap-pull-push.jpg"
    );
    expect(drillPoster("https://thestriveapp.com/drills/speed-the-cross.mp4")).toBe(
      "/drills/posters/speed-the-cross.jpg"
    );
    expect(drillPoster("https://www.thestriveapp.com/drills/speed-the-cross.mp4")).toBe(
      "/drills/posters/speed-the-cross.jpg"
    );
    // The thumbnail's time fragment and a query do not change the answer.
    expect(drillPoster("/drills/neymar-feint.mp4#t=0.5")).toBe("/drills/posters/neymar-feint.jpg");
    expect(drillPoster("/drills/neymar-feint.mp4?v=2")).toBe("/drills/posters/neymar-feint.jpg");
  });

  it("a clip hosted anywhere else has none, and nothing breaks", () => {
    expect(drillPoster("https://files.manuscdn.com/user_upload/abc/clip.mp4")).toBeNull();
    expect(drillPoster("https://thestriveapp.com.evil.example/drills/x.mp4")).toBeNull();
    expect(drillPoster("http://thestriveapp.com/drills/x.mp4")).toBeNull();
    expect(drillPoster("//evil.example/drills/x.mp4")).toBeNull();
    expect(drillPoster("/drills/../secret.mp4")).toBeNull();
    expect(drillPoster("/drills/sub/x.mp4")).toBeNull();
    expect(drillPoster("/drills/clip.mov")).toBeNull();
    expect(drillPoster("/other/x.mp4")).toBeNull();
    expect(drillPoster("")).toBeNull();
    expect(drillPoster(null)).toBeNull();
    expect(drillPoster(undefined)).toBeNull();
    expect(drillPoster("not a url")).toBeNull();
  });

  it("every clip in public/drills has a poster, small enough to load at once", () => {
    const clips = readdirSync(DRILLS).filter((f) => f.endsWith(".mp4"));
    expect(clips.length).toBeGreaterThan(50);
    const missing: string[] = [];
    for (const clip of clips) {
      const poster = drillPoster(`/drills/${clip}`);
      expect(poster, clip).toBeTruthy();
      const file = join(ROOT, "public", poster!);
      if (!existsSync(file)) {
        missing.push(clip);
        continue;
      }
      const size = statSync(file).size;
      expect(size, clip).toBeGreaterThan(2_000);
      expect(size, clip).toBeLessThan(90_000);
      // A JPEG: FF D8 at the start.
      const head = readFileSync(file).subarray(0, 2);
      expect([head[0], head[1]], clip).toEqual([0xff, 0xd8]);
    }
    // Run `bash scripts/make-drill-posters.sh` after adding a clip.
    expect(missing).toEqual([]);
  });

  it("no poster is left behind for a clip that is gone", () => {
    const clips = new Set(readdirSync(DRILLS).filter((f) => f.endsWith(".mp4")).map((f) => f.slice(0, -4)));
    const orphans = readdirSync(POSTERS).filter((f) => !clips.has(f.replace(/\.jpg$/, "")));
    expect(orphans).toEqual([]);
  });

  it("the drill card and the session player both show it", () => {
    const card = readFileSync(join(ROOT, "components/elite/DrillVideo.tsx"), "utf8");
    expect(card).toContain("drillPoster(src)");
    expect(card).toMatch(/poster=\{poster \?\? undefined\}/);
    const player = readFileSync(join(ROOT, "components/elite/SessionPlayer.tsx"), "utf8");
    expect(player).toContain("drillPoster(src)");
    expect(player).toMatch(/poster=\{poster \?\? undefined\}/);
    expect(player).toContain("preloadNextClip(");
  });
});

describe("fetching the next drill ahead", () => {
  it("fetches the next clip unless the member switched demos off", () => {
    expect(preloadNextClip({ autoplay: true, nextSrc: "/drills/a.mp4" })).toBe(true);
    expect(preloadNextClip({ autoplay: false, nextSrc: "/drills/a.mp4" })).toBe(false);
  });

  it("fetches nothing after the last drill", () => {
    expect(preloadNextClip({ autoplay: true, nextSrc: null })).toBe(false);
    expect(preloadNextClip({ autoplay: true, nextSrc: "" })).toBe(false);
  });
});
