import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AVATAR_EDGE,
  AVATAR_MAX_BYTES,
  CREST_COLOURS,
  GRID_MAX,
  RANKING_MIN_MEMBERS,
  avatarPath,
  clubPlaceLine,
  clubRanking,
  crestIndex,
  crestLetters,
  crestOf,
  friendsBoard,
  lastTrainedLabel,
  mayViewAvatar,
  mayViewProfile,
  ownsAvatarPath,
  ownsPostPath,
  profilePosts,
  rankedClubCount,
  seasonWord,
  squareCrop,
  type PhotoViewer,
  type PostRow,
} from "@/lib/elite/tracker";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");

const ME = "11111111-1111-4111-8111-111111111111";
const GARY = "22222222-2222-4222-8222-222222222222";
const STRANGER = "33333333-3333-4333-8333-333333333333";
const PHOTO = "44444444-4444-4444-8444-444444444444";
const TODAY = "2026-11-19"; // a Thursday

let n = 0;
function post(owner: string, day: string, extra: Partial<PostRow> = {}): PostRow {
  n += 1;
  const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
  return {
    id,
    profile_id: owner,
    trained_on: day,
    minutes: 45,
    kind: "training",
    created_at: `${day}T${String(10 + (n % 10)).padStart(2, "0")}:00:00Z`,
    photo_path: `${owner}/${id}.jpg`,
    caption: null,
    removed_at: null,
    ...extra,
  };
}
const viewer = (over: Partial<PhotoViewer> = {}): PhotoViewer => ({
  id: ME,
  staff: false,
  friendIds: new Set([GARY]),
  unlocked: false,
  reported: new Set(),
  ...over,
});

describe("profile photos", () => {
  it("are seen by exactly who may open the profile: the player, friends, coaches; never a stranger or a block", () => {
    const base = { viewerId: ME, staff: false, targetId: GARY, friendIds: new Set([GARY]), blocks: [] };
    for (const input of [
      base,
      { ...base, friendIds: new Set<string>() },
      { ...base, friendIds: new Set<string>(), staff: true },
      { ...base, targetId: ME, friendIds: new Set<string>() },
      { ...base, blocks: [{ blocker: GARY, blocked: ME }] },
    ]) {
      expect(mayViewAvatar(input)).toBe(mayViewProfile(input));
    }
    expect(mayViewAvatar({ ...base, friendIds: new Set<string>() })).toBe(false);
    expect(mayViewAvatar({ ...base, blocks: [{ blocker: ME, blocked: GARY }] })).toBe(false);
  });

  it("live in the player's own folder of the private bucket, under a name nobody can guess", () => {
    expect(avatarPath(ME, PHOTO)).toBe(`${ME}/avatar-${PHOTO}.jpg`);
    expect(avatarPath("me", PHOTO)).toBeNull();
    expect(avatarPath(ME, "1")).toBeNull();
    expect(ownsAvatarPath(`${ME}/avatar-${PHOTO}.jpg`, ME)).toBe(true);
    expect(ownsAvatarPath(`${ME}/avatar-${PHOTO}.jpg`, GARY)).toBe(false);
    expect(ownsAvatarPath(`${ME}/x/avatar-${PHOTO}.jpg`, ME)).toBe(false);
    expect(ownsAvatarPath(`${ME}/avatar-${PHOTO}.png`, ME)).toBe(false);
    // an avatar is not a post, and a post is not an avatar
    expect(ownsPostPath(`${ME}/avatar-${PHOTO}.jpg`, ME)).toBe(false);
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).toContain("avatar_path ~ '^[0-9a-f-]{36}/avatar-[0-9a-f-]{36}\\.jpg$'");
  });

  it("are cut to the middle square and kept small", () => {
    expect(squareCrop(1200, 1600)).toEqual({ sx: 0, sy: 200, size: 1200 });
    expect(squareCrop(1600, 900)).toEqual({ sx: 350, sy: 0, size: 900 });
    expect(AVATAR_EDGE).toBe(512);
    expect(AVATAR_MAX_BYTES).toBeLessThanOrEqual(600_000);
  });

  it("the upload checks the account, the size and that it is a JPEG, and is never public", () => {
    const route = code("app/api/elite/profile/photo/route.ts");
    expect(route).toContain("AVATAR_MAX_BYTES");
    expect(route).toContain("cleanJpeg(");
    expect(route).toContain("rateLimit(");
    const server = code("lib/elite/tracker-server.ts");
    expect(server).not.toMatch(/getPublicUrl/);
    // a photo is signed only for the ids the caller was allowed to show:
    // one photo per account, members and free alike (081)
    expect(server).toMatch(/export async function avatarsOf\(admin: Admin, ids: string\[\]\)[^{]*\{\s*return avatarUrlsOf\(admin, ids\);/);
    const shared = code("lib/elite/account-profile-server.ts");
    expect(shared).not.toMatch(/getPublicUrl/);
    expect(shared).toContain("ownsAvatarPath(");
    expect(shared).toContain("createSignedUrls(");
  });

  it("a friend reports it from the profile, a coach removes it", () => {
    const acts = code("lib/elite/tracker-actions.ts");
    const remove = acts.slice(acts.indexOf("export async function removeProfilePhoto("));
    expect(remove).toContain("const c = await coach();");
    expect(remove).toContain('if (c.kind === "no") return fail("Only a coach can do this.");');
    expect(code("components/elite/ProfileScreen.tsx")).toContain("Report the profile photo");
    expect(code("components/elite/LineReports.tsx")).toContain("removeProfilePhoto(r.profile_id)");
    expect(read("supabase/migrations/069_free_training_log.sql")).toContain("check (what in ('line', 'photo'))");
  });

  it("is asked for right after sign-up, once the account exists, and is required (Nov 23 2026)", () => {
    // the join form itself takes no file: a photo needs the account's own
    // folder, so it is the first screen after it (the free layout's gate)
    const join = code("components/elite/JoinForm.tsx");
    expect(join).not.toMatch(/avatar|type="file"/i);
    const layout = code("app/(free)/layout.tsx");
    expect(layout).toContain("profileSetupDue(viewer.setup)");
    expect(layout.indexOf("<ProfileSetupScreen")).toBeLessThan(layout.indexOf("<FreeShell"));
    // there is no way for a player to take their own photo off
    expect(code("components/elite/ProfilePhotoPicker.tsx")).not.toMatch(/Remove photo|removeMyPhoto/);
  });

  it("a visitor who is not signed in never sees anyone's photo on the invite", () => {
    const landing = code("components/elite/JoinLanding.tsx");
    expect(landing).toContain("<FreeAvatar photo={null}");
    const server = code("lib/elite/tracker-server.ts");
    const invite = server.slice(server.indexOf("export async function inviteLandingFor("), server.indexOf("export async function auraLogsOf("));
    expect(invite).not.toMatch(/avatar|photo|signPhotos/);
  });
});

describe("the profile's grid", () => {
  it("shows a friend's posts by the feed's rule: the last seven days, today's only once you posted", () => {
    const rows = [
      post(GARY, TODAY),
      post(GARY, "2026-11-17"),
      post(GARY, "2026-11-01"), // older than the feed's seven days
      post(GARY, "2026-11-16", { removed_at: "2026-11-16T20:00:00Z" }),
      post(GARY, "2026-11-15", { photo_path: null }),
      post(STRANGER, "2026-11-18"),
    ];
    const locked = profilePosts(rows, GARY, viewer(), TODAY);
    expect(locked.map((p) => p.day)).toEqual(["2026-11-17"]);
    const open = profilePosts(rows, GARY, viewer({ unlocked: true }), TODAY);
    expect(open.map((p) => p.day)).toEqual([TODAY, "2026-11-17"]);
    // a post you reported is gone from it too
    expect(profilePosts(rows, GARY, viewer({ unlocked: true, reported: new Set([rows[1].id]) }), TODAY)).toHaveLength(1);
  });

  it("a non-friend sees nothing; the player sees all their own; at most thirty", () => {
    const rows = Array.from({ length: 40 }, () => post(ME, "2026-10-01"));
    expect(profilePosts(rows, ME, viewer({ id: STRANGER, friendIds: new Set() }), TODAY)).toEqual([]);
    const mine = profilePosts(rows, ME, viewer(), TODAY);
    expect(mine).toHaveLength(GRID_MAX);
    expect(GRID_MAX).toBe(30);
    // the stored path never leaves the server: the screen gets a signed address
    expect(code("components/elite/ProfileScreen.tsx")).not.toContain("photoPath");
  });
});

describe("club crests", () => {
  it("carry two characters from the name", () => {
    expect(crestLetters("Strive Elite 5v5: Team 7")).toBe("T7");
    expect(crestLetters("5v5 Team 12")).toBe("12");
    expect(crestLetters("2010 Boys")).toBe("10");
    expect(crestLetters("Weak Foot Gang")).toBe("WF");
    expect(crestLetters("Pickup")).toBe("PI");
    expect(crestLetters("!!!")).toBe("?");
  });

  it("keep one of six colour pairs, picked from the id, so a rename never changes them", () => {
    expect(CREST_COLOURS).toHaveLength(6);
    const id = "demo-club-1";
    expect(crestIndex(id)).toBe(crestIndex(id));
    expect(crestOf({ id, name: "Old name" }).from).toBe(crestOf({ id, name: "New name" }).from);
    const seen = new Set(Array.from({ length: 60 }, (_, i) => crestIndex(`club-${i}`)));
    expect(seen.size).toBe(6);
    for (let i = 0; i < 60; i++) {
      const k = crestIndex(`club-${i}`);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(6);
    }
  });
});

describe("places: one each, a tie broken by name", () => {
  it("on the friends board", () => {
    const rows = friendsBoard(
      [
        { id: "a", name: "Zed Z.", minutes: 60 },
        { id: "b", name: "Amy A.", minutes: 60 },
        { id: ME, name: "Me M.", minutes: 30 },
      ],
      ME
    );
    expect(rows.map((r) => [r.place, r.name])).toEqual([
      [1, "Amy A."],
      [2, "Zed Z."],
      [3, "Me M."],
    ]);
  });

  it("on the club ranking, with the count of ranked clubs for \"#2 of 24\"", () => {
    const club = (id: string, name: string, size: number) => ({
      id,
      name,
      memberIds: Array.from({ length: size }, (_, i) => `${id}-${i}`),
    });
    const list = [club("x", "Team 5", 3), club("y", "Bull Run", 3), club("z", "Two Players", 2)];
    const weekMinutes = new Map<string, number>();
    for (const c of list) c.memberIds.forEach((m) => weekMinutes.set(m, 90));
    const rows = clubRanking({ clubs: list, weekMinutes, myClubIds: new Set(["x"]) });
    expect(rows.map((r) => [r.place, r.name])).toEqual([
      [1, "Bull Run"],
      [2, "Team 5"],
    ]);
    expect(rows[1].members).toBe(3);
    expect(rankedClubCount(list)).toBe(2);
    expect(clubPlaceLine(2, 24)).toEqual({ big: "#2", small: "of 24 clubs" });
    expect(clubPlaceLine(1, 1)).toEqual({ big: "#1", small: "of 1 club" });
    expect(clubPlaceLine(null, 24)).toEqual({ big: "New", small: `Ranked at ${RANKING_MIN_MEMBERS} players` });
  });
});

describe("small words", () => {
  it("when a club member last trained", () => {
    expect(lastTrainedLabel(null, TODAY)).toBe("No training yet");
    expect(lastTrainedLabel(TODAY, TODAY)).toBe("Trained today");
    expect(lastTrainedLabel("2026-11-18", TODAY)).toBe("Yesterday");
    expect(lastTrainedLabel("2026-11-17", TODAY)).toBe("Tuesday");
    expect(lastTrainedLabel("2026-11-01", TODAY)).not.toMatch(/day$/);
  });

  it("the season on Settings", () => {
    expect(seasonWord("in_season")).toBe("in season");
    expect(seasonWord("off_season")).toBe("off season");
    expect(seasonWord(null)).toBeNull();
  });
});

describe("the redrawn screens keep the house rules", () => {
  it("every menu is a bottom sheet, the red rows are the one red", () => {
    const sheet = code("components/elite/ActionSheet.tsx");
    expect(sheet).toContain("rounded-t-[26px]");
    expect(sheet).toContain("#ff5a4e");
    for (const f of ["components/elite/FriendsFeed.tsx", "components/elite/ProfileScreen.tsx", "components/elite/ClubScreen.tsx"]) {
      expect(code(f), f).toContain("<ActionSheet");
      expect(code(f), f).not.toContain("SheetButton");
    }
  });

  it("no button is gold", () => {
    const files = [
      "components/elite/ProfileScreen.tsx",
      "components/elite/ClubScreen.tsx",
      "components/elite/ClubsSection.tsx",
      "components/elite/FriendsBoard.tsx",
      "components/elite/ShareWeek.tsx",
      "components/elite/FreeSettings.tsx",
      "components/elite/ProfilePhotoPicker.tsx",
      "components/elite/JoinForm.tsx",
      "components/elite/JoinLanding.tsx",
      "components/elite/UnderAge.tsx",
      "app/(join)/join/page.tsx",
      "app/(free)/log/clubs/page.tsx",
    ];
    for (const f of files) {
      for (const m of code(f).matchAll(/<(button|Link|a)\b[^>]*className="([^"]*)"/g)) {
        expect(m[2], `${f}: ${m[0].slice(0, 80)}`).not.toMatch(/(^|\s)(bg-accent|btn-accent)(\s|$)/);
      }
    }
  });

  it("/join is its own page: no header, and no link to another website", () => {
    const layout = code("app/(join)/layout.tsx");
    expect(layout).not.toMatch(/https?:\/\//);
    for (const f of ["app/(join)/join/page.tsx", "components/elite/JoinForm.tsx", "components/elite/JoinLanding.tsx"]) {
      expect(code(f), f).not.toContain("strivesoccer100x");
    }
  });

  it("the birthday is a wheel, and the 13 and older check runs on the server before anything else", () => {
    const form = code("components/elite/JoinForm.tsx");
    expect(form).toContain("<WheelColumn");
    expect(form).toContain('setStep(res.allowed ? "name" : "young")');
    expect(code("components/elite/WheelPicker.tsx")).toContain('role="listbox"');
  });

  it("Settings is the free account's own; a member's Account page keeps no free-app setting", () => {
    const account = code("app/account/page.tsx");
    // it stays on Account only while new terms or the photo and username
    // (081), or the code from its email (093), are owed, so it can still
    // sign out or delete
    expect(account).toContain("if (tracker && !viewer.emailDue && !profileSetupDue(viewer.setup) && !(await consentDue(viewer.profile.id))) redirect(FREE_SETTINGS);");
    expect(account).not.toMatch(/BlockedList|PlayingForField|FREE_QUIZ|FREE_DAYS/);
    const settings = code("components/elite/FreeSettings.tsx");
    for (const s of ["Weekly target", "My training days", "Send my link", "Blocked", "Support", "Privacy and terms", "Sign out", "Delete my account"]) {
      expect(settings).toContain(s);
    }
    expect(settings).not.toMatch(/Progress|Vibration/);
    // the one device setting a free account has: notifications (078), in
    // the free app's own words and without the member's other switches
    expect(settings).toContain('<DeviceSettings showNotifications variant="free" />');
  });
});
