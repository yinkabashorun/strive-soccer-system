import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  COMPOSITE,
  DRILLS_PER_PLAYER,
  DRILL_NAME_MAX,
  REEL_LAST_SECONDS,
  REEL_MAX_TAKES,
  REEL_TAKE_SECONDS,
  TAKES_PER_DRILL,
  TAKE_SECONDS,
  VIDEO_PRIVATE_LINE,
  canAddDrill,
  canAddTake,
  canComposeVideo,
  cleanCount,
  countChange,
  coverCrop,
  defaultPair,
  duetLayout,
  duetSeconds,
  ownsTakePath,
  pickRecorderType,
  pickTwo,
  reelLayout,
  reelSeconds,
  reelTakes,
  shareFileName,
  startTake,
  takeExtension,
  takeLabel,
  takeLengthOk,
  takePath,
  type Take,
} from "../lib/elite/my-drills";
import { cleanDrillName } from "../lib/elite/my-drills-name";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const TAKE = "33333333-3333-4333-8333-333333333333";

// Takes on given days after Nov 1 2026 (noon UTC, so the New York date is
// the same day).
const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n, 17)).toISOString();
const take = (id: string, n: number, count: number | null = null): Take => ({ id, created_at: day(n), count });

describe("naming a drill", () => {
  it("is the player's own words, trimmed, 40 characters at most", () => {
    expect(cleanDrillName("  Weak   foot juggles ")).toEqual({ ok: true, name: "Weak foot juggles" });
    expect(cleanDrillName("Rabona")).toEqual({ ok: true, name: "Rabona" });
    expect(cleanDrillName("x".repeat(DRILL_NAME_MAX)).ok).toBe(true);
    expect(cleanDrillName("x".repeat(DRILL_NAME_MAX + 1)).ok).toBe(false);
    expect(cleanDrillName("   ").ok).toBe(false);
    expect(cleanDrillName(null).ok).toBe(false);
    expect(DRILL_NAME_MAX).toBe(40);
  });

  it("goes through the word filter", () => {
    const res = cleanDrillName("fuck this drill");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/words we don't allow/);
  });

  it("the filter stays on the server: the screens never load it", () => {
    expect(read("lib/elite/my-drills.ts")).not.toContain("text-filter");
    for (const f of ["components/elite/MyDrills.tsx", "components/elite/PostComposer.tsx", "components/elite/MyWeek.tsx"]) {
      expect(read(f), f).not.toContain("my-drills-name");
    }
    expect(read("lib/elite/my-drills-actions.ts")).toContain("cleanDrillName(");
  });
});

describe("the caps", () => {
  it("20 drills a player, 50 takes a drill, 20 seconds and 60 MB a take", () => {
    expect(DRILLS_PER_PLAYER).toBe(20);
    expect(TAKES_PER_DRILL).toBe(50);
    expect(TAKE_SECONDS).toBe(20);
    expect(canAddDrill(19)).toBe(true);
    expect(canAddDrill(20)).toBe(false);
    expect(canAddTake(49)).toBe(true);
    expect(canAddTake(50)).toBe(false);
    expect(takeLengthOk(20)).toBe(true);
    expect(takeLengthOk(21.2)).toBe(true); // the phone's own rounding
    expect(takeLengthOk(25)).toBe(false);
    expect(takeLengthOk(NaN)).toBe(true); // unreadable: never refuse a real take
  });

  it("the database holds the same caps, under a lock", () => {
    const sql = read("supabase/migrations/078_my_drills_and_reminders.sql");
    expect(sql).toMatch(/where profile_id = new\.profile_id\) >= 20 then\s+raise exception 'drill_cap'/);
    expect(sql).toMatch(/where drill_id = new\.drill_id\) >= 50 then\s+raise exception 'take_cap'/);
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('drills:'");
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('takes:'");
    expect(sql).toContain("check (char_length(name) between 1 and 40)");
    expect(sql).toContain("check (count is null or count between 0 and 999)");
  });

  it("an optional count is a whole number 0 to 999 or nothing", () => {
    expect(cleanCount("")).toBeNull();
    expect(cleanCount(null)).toBeNull();
    expect(cleanCount("43")).toBe(43);
    expect(cleanCount(0)).toBe(0);
    expect(cleanCount(1000)).toBeUndefined();
    expect(cleanCount("4.5")).toBeUndefined();
    expect(cleanCount("abc")).toBeUndefined();
  });
});

describe("the starting take and the pair", () => {
  const takes = [take("c", 20, 30), take("a", 0, 12), take("b", 9), take("d", 40, 41)];

  it("the start is the first take filmed unless the player set another", () => {
    expect(startTake(takes, null)?.id).toBe("a");
    expect(startTake(takes, "b")?.id).toBe("b");
    expect(startTake(takes, "gone")?.id).toBe("a"); // a deleted start falls back to the first
    expect(startTake([], null)).toBeNull();
  });

  it("Then and now by default is the start beside the latest", () => {
    expect(defaultPair(takes, null)?.map((t) => t.id)).toEqual(["a", "d"]);
    expect(defaultPair(takes, "c")?.map((t) => t.id)).toEqual(["c", "d"]);
    expect(defaultPair([take("a", 0)], null)).toBeNull(); // one take: nothing to compare yet
    // the newest take set as the start still pairs with the newest other one, earlier first
    expect(defaultPair(takes, "d")?.map((t) => t.id)).toEqual(["c", "d"]);
  });

  it("pick two: any two, earlier on the left, never the same one twice", () => {
    expect(pickTwo(takes, "d", "b")?.map((t) => t.id)).toEqual(["b", "d"]);
    expect(pickTwo(takes, "a", "a")).toBeNull();
    expect(pickTwo(takes, "a", "nope")).toBeNull();
  });

  it("the counts show as a change only when both takes have one", () => {
    expect(countChange(take("x", 0, 43), take("y", 1, 58))).toBe("43 → 58");
    expect(countChange(take("x", 0, null), take("y", 1, 58))).toBeNull();
  });
});

describe("the progress reel", () => {
  it("plays every take from the start, in order, when there are 8 or fewer", () => {
    const t = [take("b", 3), take("a", 0), take("c", 7)];
    expect(reelTakes(t, null).map((x) => x.id)).toEqual(["a", "b", "c"]);
    // a later start leaves the earlier takes out of the reel
    expect(reelTakes(t, "b").map((x) => x.id)).toEqual(["b", "c"]);
  });

  it("past 8 takes uses 8, spread evenly, always the first and the latest", () => {
    for (const n of [9, 12, 50, 200]) {
      const many = Array.from({ length: n }, (_, i) => take(`t${String(i).padStart(3, "0")}`, i));
      const reel = reelTakes(many, null);
      expect(reel).toHaveLength(REEL_MAX_TAKES);
      expect(reel[0].id).toBe("t000");
      expect(reel[reel.length - 1].id).toBe(`t${String(n - 1).padStart(3, "0")}`);
      // in order, no repeats
      const days = reel.map((x) => new Date(x.created_at).getTime());
      expect([...days].sort((a, b) => a - b)).toEqual(days);
      expect(new Set(reel.map((x) => x.id)).size).toBe(reel.length);
    }
  });

  it("about 3 seconds a take, the latest held longer, never past the take itself", () => {
    expect(REEL_TAKE_SECONDS).toBe(3);
    expect(reelSeconds([10, 10, 10])).toEqual([3, 3, REEL_LAST_SECONDS]);
    expect(reelSeconds([2, 4])).toEqual([2, 4]);
    expect(reelSeconds([NaN, NaN])).toEqual([3, REEL_LAST_SECONDS]);
  });

  it("each take is dated from the start: Day 1, Day 2 ... Day 7, then Week 2, Week 3", () => {
    const start = take("s", 0);
    expect(takeLabel(take("x", 0), start)).toBe("Day 1");
    expect(takeLabel(take("x", 1), start)).toBe("Day 2");
    expect(takeLabel(take("x", 6), start)).toBe("Day 7");
    expect(takeLabel(take("x", 7), start)).toBe("Week 2");
    expect(takeLabel(take("x", 14), start)).toBe("Week 3");
    expect(takeLabel(take("x", 49), start)).toBe("Week 8");
    expect(takeLabel(take("x", 0), take("s", 3))).toBeNull(); // before the start
  });
});

describe("the shared video, made on the phone", () => {
  it("is 1080 x 1920, the earlier take on top and the later below, each half filled", () => {
    const L = duetLayout({ width: 1080, height: 1920 }, { width: 1920, height: 1080 });
    expect(L.canvas).toEqual({ width: 1080, height: 1920 });
    expect(L.halves[0].dst).toEqual({ x: 0, y: 0, w: 1080, h: 960 });
    expect(L.halves[1].dst).toEqual({ x: 0, y: 960, w: 1080, h: 960 });
    // a portrait take keeps its middle at the half's shape (1080:960)
    expect(L.halves[0].src).toEqual({ x: 0, y: 480, w: 1080, h: 960 });
    // a landscape take keeps its middle columns
    expect(L.halves[1].src.h).toBe(1080);
    expect(L.halves[1].src.w).toBeCloseTo(1215, 5);
    expect(L.halves[1].src.x).toBeCloseTo(352.5, 5);
    expect(L.halves[0].label.y).toBeLessThan(960);
    expect(L.halves[1].label.y).toBeGreaterThan(960);
    expect(L.mark.x).toBeGreaterThan(L.name.x);
  });

  it("the reel is one take full frame at a time", () => {
    const L = reelLayout({ width: 720, height: 1280 });
    expect(L.dst).toEqual({ x: 0, y: 0, w: COMPOSITE.width, h: COMPOSITE.height });
    expect(L.src.w / L.src.h).toBeCloseTo(1080 / 1920, 5);
  });

  it("never stretches, whatever the shape", () => {
    for (const [w, h] of [
      [1080, 1920],
      [1920, 1080],
      [1000, 1000],
    ]) {
      const r = coverCrop(w, h, 1080, 960);
      expect(r.w / r.h).toBeCloseTo(1080 / 960, 5);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(w + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(h + 1e-9);
    }
  });

  it("runs as long as the longer take, never past 20 seconds", () => {
    expect(duetSeconds(8, 14)).toBe(14);
    expect(duetSeconds(40, 2)).toBe(20);
    expect(duetSeconds(NaN, NaN)).toBe(20);
  });

  it("records MP4 where the phone can (iPhone), WebM elsewhere, nothing where it cannot", () => {
    expect(pickRecorderType((t) => t.startsWith("video/mp4"))).toEqual({ mime: "video/mp4;codecs=avc1", ext: "mp4" });
    expect(pickRecorderType((t) => t === "video/webm")).toEqual({ mime: "video/webm", ext: "webm" });
    expect(pickRecorderType(() => false)).toBeNull();
    expect(pickRecorderType(null)).toBeNull();
    expect(
      pickRecorderType(() => {
        throw new Error("x");
      })
    ).toBeNull();
  });

  it("Share is drawn only where the phone can make the video", () => {
    const yes = { isTypeSupported: (t: string) => t === "video/webm" };
    expect(canComposeVideo({ MediaRecorder: yes, canvasCaptureStream: true })).toBe(true);
    expect(canComposeVideo({ MediaRecorder: yes, canvasCaptureStream: false })).toBe(false);
    expect(canComposeVideo({ MediaRecorder: null, canvasCaptureStream: true })).toBe(false);
    expect(canComposeVideo({ MediaRecorder: { isTypeSupported: () => false }, canvasCaptureStream: true })).toBe(false);
    const screen = code("components/elite/MyDrills.tsx");
    expect(screen).toMatch(/canShare && a\.url && b\.url && \(/);
    expect(screen).toMatch(/canShare && <ShareButton/);
  });

  it("is made on the phone and handed to the phone: nothing is uploaded or posted", () => {
    const client = code("lib/elite/my-drills-client.ts");
    expect(client).toContain("new MediaRecorder(");
    expect(client).toContain("nav.share({ files: [file]");
    expect(client).not.toMatch(/fetch\(|supabase|uploadClip|\/api\//);
    expect(shareFileName("then-and-now", "Weak foot juggles!", "mp4")).toBe("then-and-now-weak-foot-juggles.mp4");
  });
});

describe("where takes are kept, and who sees them", () => {
  it("a take lives flat in the player's own folder", () => {
    expect(takePath(ME, TAKE, "mp4")).toBe(`${ME}/take-${TAKE}.mp4`);
    expect(takePath(ME, TAKE, "exe")).toBeNull();
    expect(takePath("me", TAKE, "mp4")).toBeNull();
    expect(takeExtension("IMG_1.MOV")).toBe("mov");
    expect(takeExtension("clip", "video/webm")).toBe("webm");
    expect(takeExtension("clip", "")).toBe("mp4");
  });

  it("only the owner's own take path is theirs", () => {
    const p = `${ME}/take-${TAKE}.mov`;
    expect(ownsTakePath(p, ME)).toBe(true);
    expect(ownsTakePath(p, ME, TAKE)).toBe(true);
    expect(ownsTakePath(p, ME, OTHER)).toBe(false);
    expect(ownsTakePath(p, OTHER)).toBe(false);
    expect(ownsTakePath(`${ME}/${TAKE}.jpg`, ME)).toBe(false); // a post photo is not a take
    expect(ownsTakePath(`${ME}/sub/take-${TAKE}.mp4`, ME)).toBe(false);
    expect(ownsTakePath(`${ME}/take-${TAKE}.mp4/../x`, ME)).toBe(false);
  });

  it("the storage policy lets a player write a take into their own folder, and nothing else", () => {
    const sql = read("supabase/migrations/078_my_drills_and_reminders.sql");
    expect(sql).toContain("split_part(p_name, '/', 1) = auth.uid()::text");
    expect(sql).toMatch(/create policy tracker_takes_owner_insert on storage\.objects\s+for insert with check/);
    // no player read or list on the bucket: reads are signed by the server
    expect(sql).not.toMatch(/on storage\.objects\s+for select/);
    expect(sql).toMatch(/elite_tracker_drills enable row level security/);
    expect(sql).toMatch(/elite_tracker_takes enable row level security/);
    expect(sql).toContain("_coach_read");
    expect(sql).toContain("references public.elite_profiles(id) on delete cascade");
    expect(sql.replace(/--.*$/gm, "")).not.toMatch(/\bdrop\s+(table|policy|column)\b/i);
  });

  it("deleting the account takes them: they sit flat in the folder the account deletion empties", () => {
    expect(read("lib/elite/tracker-server.ts")).toMatch(/\.list\(profileId, \{ limit: 1000 \}\)/);
    expect(takePath(ME, TAKE, "mp4")!.split("/")).toHaveLength(2);
  });

  it("every read is the signed-in player's own, with short-lived links", () => {
    const server = code("lib/elite/my-drills-server.ts");
    expect(server.match(/\.eq\("profile_id", viewer!\.profile\.id\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(server).toContain("POST_URL_SECONDS");
    const actions = code("lib/elite/my-drills-actions.ts");
    expect(actions).toContain("ownsTakePath(input.path, o.profileId, input.takeId)");
    expect(actions.match(/\.eq\("profile_id", o\.profileId\)/g)?.length).toBeGreaterThanOrEqual(6);
  });
});

// Takes are never in the friends feed and never on anyone's profile.
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("nothing in the feed", () => {
  it("only My drills' own files read the takes", () => {
    const files = ["app", "components", "lib"].flatMap((d) => walk(join(root, d)));
    const readers = files
      .filter((f) => /elite_tracker_takes|my-drills-server/.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(root + "/", ""))
      .sort();
    expect(readers).toEqual([
      "app/(free)/log/drills/[id]/page.tsx",
      "app/(free)/log/drills/page.tsx",
      "lib/elite/my-drills-actions.ts",
      "lib/elite/my-drills-server.ts",
    ]);
  });

  it("a video on the posting screen is saved as a take, never posted, and says so", () => {
    const composer = code("components/elite/PostComposer.tsx");
    const save = composer.slice(composer.indexOf("async function saveVideo"), composer.indexOf("async function logIt"));
    expect(save).toContain("saveTake(");
    expect(save).not.toContain("/api/elite/tracker/post");
    expect(composer).toContain("{VIDEO_PRIVATE_LINE}");
    expect(VIDEO_PRIVATE_LINE).toMatch(/feed shows photos only/);
    expect(composer).toMatch(/preview && isVideo \?/);
    // the post route still takes only a JPEG
    expect(code("app/api/elite/tracker/post/route.ts")).toContain("cleanJpeg(");
  });

  it("the copy follows the house rules", () => {
    for (const f of ["components/elite/MyDrills.tsx", "lib/elite/my-drills.ts"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/—|\bAI\b|automated|algorithm|streak/i);
    }
  });
});
