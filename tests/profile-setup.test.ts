import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NO_SETUP,
  needsPhoto,
  needsUsername,
  photoAddress,
  photoKeyOf,
  profileSetupDue,
  setupFromRow,
  setupSteps,
} from "../lib/elite/account-profile";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// The profile photo and the @username are REQUIRED (Nov 23 2026, Coach
// Yinka). New members and new free accounts cannot finish onboarding
// without them; everyone made before gets one required screen, built like
// the agreement gate. Until migration 081 is applied, nothing is asked and
// nothing is refused.

const ID = "11111111-1111-4111-8111-111111111111";
const PHOTO = "22222222-2222-4222-8222-222222222222";

describe("what an account owes", () => {
  it("nothing before 081 (the columns are not on the row), or when the row could not be read", () => {
    expect(setupFromRow({ id: ID, full_name: "Marcus" }, ID)).toEqual(NO_SETUP);
    expect(setupFromRow(null, ID)).toEqual(NO_SETUP);
    expect(profileSetupDue(NO_SETUP)).toBe(false);
    expect(setupSteps(NO_SETUP)).toEqual([]);
  });

  it("after 081: the username, then the photo, only the ones still missing", () => {
    const none = setupFromRow({ username: null, avatar_path: null }, ID);
    expect(none.available).toBe(true);
    expect(profileSetupDue(none)).toBe(true);
    expect(setupSteps(none)).toEqual(["username", "photo"]);
    const named = setupFromRow({ username: "marcus.b", avatar_path: null }, ID);
    expect(needsUsername(named)).toBe(false);
    expect(setupSteps(named)).toEqual(["photo"]);
    const done = setupFromRow({ username: "marcus.b", avatar_path: `${ID}/avatar-${PHOTO}.jpg` }, ID);
    expect(profileSetupDue(done)).toBe(false);
    expect(done.photoKey).toBe(PHOTO);
  });

  it("a photo in someone else's folder, or a username that breaks the rules, does not count", () => {
    const other = "33333333-3333-4333-8333-333333333333";
    expect(needsPhoto(setupFromRow({ username: "marcus.b", avatar_path: `${other}/avatar-${PHOTO}.jpg` }, ID))).toBe(true);
    expect(needsUsername(setupFromRow({ username: "coach.gary", avatar_path: null }, ID))).toBe(true);
  });

  it("the photo's address stays the same as long as the photo does", () => {
    expect(photoKeyOf(`${ID}/avatar-${PHOTO}.jpg`)).toBe(PHOTO);
    expect(photoAddress({ photoKey: PHOTO })).toBe(`/api/elite/profile/photo?v=${PHOTO}`);
    expect(photoAddress({ photoKey: PHOTO }, ID)).toBe(`/api/elite/profile/photo?v=${PHOTO}&of=${ID}`);
    expect(photoAddress({ photoKey: null })).toBeNull();
  });
});

describe("required: no skip, and the server refuses without them", () => {
  it("the set-up screens have no skip", () => {
    const setup = read("components/elite/ProfileSetup.tsx");
    expect(setup).not.toMatch(/Skip|Not now|Later|skip/);
    expect(setup).toContain('title="Add a profile photo"');
    expect(setup).toContain('title="Pick a username"');
  });

  it("a member's onboarding is refused without them", () => {
    const actions = read("lib/elite/player-actions.ts");
    const complete = actions.slice(actions.indexOf("export async function completeOnboarding("), actions.indexOf("export async function toggleHomework("));
    const refuse = complete.indexOf("if (profileSetupDue(viewer.setup)) return { ok: false as const, needsSetup: true as const");
    expect(refuse).toBeGreaterThan(-1);
    // before anything is written
    expect(refuse).toBeLessThan(complete.indexOf('.from("elite_players")'));
    // the quiz ends on them, and goes back to them if the server says so
    const quiz = read("components/elite/QuizFlow.tsx");
    expect(quiz).toContain('setStage("profile")');
    expect(quiz).toContain("<ProfileSetup");
    expect(read("app/onboarding/page.tsx")).toContain("setupSteps(viewer.setup)");
  });

  it("a free account's set-up is refused without them", () => {
    const actions = read("lib/elite/tracker-actions.ts");
    const save = actions.slice(actions.indexOf("export async function saveQuiz("), actions.indexOf("export async function setPlanDays("));
    expect(save).toContain("if (viewer && profileSetupDue(viewer.setup)) return fail(SETUP_REFUSED);");
    expect(save.indexOf("SETUP_REFUSED")).toBeLessThan(save.indexOf('.from("elite_trackers")'));
  });
});

describe("the one-time screen for accounts made before", () => {
  for (const [label, file, seenBy] of [
    ["member", "app/(player)/layout.tsx", "your coaches"],
    ["free", "app/(free)/layout.tsx", "your friends and the coaches"],
  ] as const) {
    it(`${label}: shown in place of the app, never on the tour, after the agreement`, () => {
      const layout = read(file);
      expect(layout).toContain("if (!viewer.demo && profileSetupDue(viewer.setup)) {");
      expect(layout.indexOf("<ProfileSetupScreen")).toBeGreaterThan(layout.indexOf("<AgreementScreen"));
      expect(layout).toContain(`seenBy="${seenBy}"`);
      expect(layout).toContain("signOut={signOut}");
    });
  }

  it("Account, Delete my account and Sign out are one tap away on it", () => {
    const screen = read("components/elite/ProfileSetupScreen.tsx");
    expect(screen).toContain('href="/account"');
    expect(screen).toContain('href="/account/delete"');
    expect(screen).toContain("Sign out");
    // a free account's Account page stays open while it is owed
    expect(read("app/account/page.tsx")).toContain("!profileSetupDue(viewer.setup)");
  });

  it("the example tour is never asked, and an unreadable profile opens the app", () => {
    const session = read("lib/elite/session.ts");
    expect(session.match(/setup: NO_SETUP/g)!.length).toBe(2); // both example viewers
    expect(session).toContain("setup: setupFromRow(profile as Record<string, unknown> | null, user.id)");
  });
});

describe("one photo, one place, private", () => {
  it("every account's photo is on its profile row, in its own folder of the private bucket", () => {
    const sql = read("supabase/migrations/081_profile_photo_and_username.sql");
    expect(sql).toContain("alter table public.elite_profiles add column if not exists avatar_path text;");
    expect(sql).toContain("split_part(avatar_path, '/', 1) = id::text");
    // the free app's photos are carried over
    expect(sql).toMatch(/update public\.elite_profiles p\s+set avatar_path = t\.avatar_path\s+from public\.elite_trackers t/);
    // no policy lets a browser write it
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/\bdrop (table|column|policy|constraint|index|trigger)\b/i);
  });

  it("the photo route serves only your own photo (or a member's, to a coach), never cached in between", () => {
    const route = read("app/api/elite/profile/photo/route.ts");
    expect(route).toContain('const staff = viewer.role === "coach" || viewer.role === "admin";');
    expect(route).toContain("if (of && !staff && of !== viewer.profile.id) return new NextResponse(null, { status: 404 });");
    expect(route).toContain('"cache-control": "private, max-age=86400, immutable"');
    // members and free accounts both upload here; nobody else
    expect(route).toContain("if (!viewer.playerId && !free) return no(\"Sign in first.\", 403);");
  });

  it("deleting an account takes the photo with it, members included", () => {
    const del = read("lib/elite/account-actions.ts");
    expect(del).toContain("await removeTrackerFiles(user.id);");
    expect(del).not.toContain("if (free) await removeTrackerFiles(user.id);");
    expect(read("lib/elite/coach-actions.ts")).toContain("await removeTrackerFiles(player.profile_id)");
  });

  it("a coach can take a member's photo off, which asks the member for a new one", () => {
    expect(read("lib/elite/coach-actions.ts")).toContain("export async function removeMemberPhoto(");
  });
});
