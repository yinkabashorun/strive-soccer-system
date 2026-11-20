import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLUB_REFUSED,
  DAY_MAX_MINUTES,
  PHOTO_MIN_EDGE,
  cleanJpeg,
  limitHit,
  newReferralCode,
} from "@/lib/elite/tracker";

// The free app's limits after the Nov 20 2026 security review (071): a
// removed friend or club member cannot walk back in on an old link, the
// caps hold in the database, a day holds 8 hours, codes are unguessable,
// and a stored photo is a whole JPEG with where it was taken removed.

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const sql = read("supabase/migrations/071_free_app_limits.sql");

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)));

const has = (bytes: Uint8Array, text: string) => Buffer.from(bytes).includes(Buffer.from(text));

describe("a stored photo", () => {
  it("keeps a real photo whole and takes out the Exif block", () => {
    const raw = fixture("photo-exif.jpg"); // 320 x 240, made with an Exif block
    expect(has(raw, "StriveTestPhone")).toBe(true);
    const clean = cleanJpeg(raw)!;
    expect(clean).not.toBeNull();
    expect(has(clean, "StriveTestPhone")).toBe(false);
    expect(has(clean, "Exif")).toBe(false);
    // still the whole picture: everything but the Exif block, byte for byte, and cleaning again changes nothing
    expect(raw.length - clean.length).toBeGreaterThan(20);
    expect(clean[clean.length - 2]).toBe(0xff);
    expect(clean[clean.length - 1]).toBe(0xd9);
    expect(Buffer.from(cleanJpeg(clean)!).equals(Buffer.from(clean))).toBe(true);
  });

  it("refuses junk, a cut-off file and a photo too small to be a photo", () => {
    expect(cleanJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
    expect(cleanJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    const whole = fixture("photo-exif.jpg");
    expect(cleanJpeg(whole.subarray(0, Math.floor(whole.length / 3)))).toBeNull();
    expect(PHOTO_MIN_EDGE).toBe(64);
    expect(cleanJpeg(fixture("photo-tiny.jpg"))).toBeNull(); // 63 x 200
    expect(cleanJpeg(fixture("photo-64.jpg"))).not.toBeNull(); // 64 x 64
  });

  it("is cleaned on both upload routes before anything is stored", () => {
    for (const r of ["post", "avatar"]) {
      const route = read(`app/api/elite/tracker/${r}/route.ts`);
      expect(route, r).toContain("cleanJpeg(new Uint8Array(await file.arrayBuffer()))");
      expect(route, r).not.toContain("looksLikeJpeg(photo)");
    }
  });
});

describe("codes", () => {
  it("come from the platform's secure generator", () => {
    const src = read("lib/elite/tracker.ts");
    expect(src).toContain("export function newReferralCode(random: () => number = secureRandom)");
    expect(src).toContain("crypto.getRandomValues");
    const codes = new Set(Array.from({ length: 500 }, () => newReferralCode()));
    expect(codes.size).toBe(500);
  });
});

describe("the database holds the limits", () => {
  it("caps clubs per player, players per club, under a lock, and keeps removed members out", () => {
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('club:'");
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('player-clubs:'");
    expect(sql).toMatch(/where profile_id = new\.profile_id\) >= 3/);
    expect(sql).toMatch(/where club_id = new\.club_id\) >= 20/);
    expect(sql).toContain("raise exception 'club_removed'");
  });

  it("caps a day at 8 hours", () => {
    expect(DAY_MAX_MINUTES).toBe(480);
    expect(sql).toContain("+ new.minutes > 480");
  });

  it("names each refusal so the player is told why", () => {
    expect(limitHit({ message: 'new row ... day_cap' })).toBe("day_cap");
    expect(limitHit({ message: "club_full" })).toBe("club_full");
    expect(limitHit({ message: "duplicate key" })).toBeNull();
    expect(limitHit(null)).toBeNull();
    expect(CLUB_REFUSED.removed).toContain("captain");
  });
});

describe("taking someone off sticks", () => {
  const actions = read("lib/elite/tracker-actions.ts");
  const server = read("lib/elite/tracker-server.ts");

  it("records a removed friend, and their old copy of the link will not add them back", () => {
    expect(actions).toMatch(/elite_tracker_unfriends"\)\s*\.upsert\(\{ remover: o\.profileId, removed: friendId \}/);
    expect(server).toMatch(/elite_tracker_unfriends"\)\s*\.select\("remover"\)\s*\.eq\("remover", y\)\s*\.eq\("removed", x\)/);
  });

  it("keeps a removed club member out and lets the captain make a new link", () => {
    expect(actions).toMatch(/elite_tracker_club_bans"\)\s*\.upsert\(\{ club_id: clubId, profile_id: memberId \}/);
    expect(actions).toContain("export async function newClubLink(clubId: string)");
    expect(server).toContain('if (hit === "club_removed") return "removed";');
  });

  it("hides a blocked player from a shared club, and shows photos only to friends", () => {
    expect(server).toContain("members.filter((m) => !blockedIds.has(m.profile_id))");
    expect(server).toContain("friendNow.has(x) && !blockedIds.has(x)");
    expect(read("components/elite/ClubScreen.tsx")).toContain('label: "Block a player"');
  });
});

describe("the word filter", () => {
  it("stops offensive words, look-alike spellings included, in what other players read", async () => {
    const { isOffensive } = await import("@/lib/elite/text-filter");
    const { cleanClubName, cleanPlayingFor } = await import("@/lib/elite/tracker");
    for (const bad of ["fuck this", "sh1t session", "b1tch"]) expect(isOffensive(bad), bad).toBe(true);
    for (const fine of ["Weak foot work", "Scunthorpe United", "Arsenal", "Richard Dickson", "Cassandra Bass", "Sussex FC"]) {
      expect(isOffensive(fine), fine).toBe(false);
    }
    expect(cleanClubName("Sh1t FC")).toBeNull();
    expect(cleanClubName("Dickson Elite")).toBe("Dickson Elite");
    expect(cleanPlayingFor("fuck it")).toBeNull();
  });

  it("guards a post's note on the server", () => {
    const route = read("app/api/elite/tracker/post/route.ts");
    expect(route).toContain('if (isOffensive(form.get("caption"))) return no(OFFENSIVE_MESSAGE, 400);');
  });
});
