import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAPTION_MAX,
  FEED_DAYS,
  FREE_MIN_AGE,
  POST_BUCKET,
  POST_MAX_EDGE,
  POST_RULES_LINE,
  REPORT_REASONS,
  UNDER_AGE_LINE,
  ageFromBirth,
  blockedEitherWay,
  buildFeed,
  canBefriend,
  cleanBirth,
  cleanCaption,
  cleanReason,
  facesRow,
  feedSince,
  fitWithin,
  initialsOf,
  lockedHeadline,
  lockedLine,
  looksLikeJpeg,
  mayGiveProps,
  mayViewPhoto,
  oldEnough,
  ownsPostPath,
  postLocked,
  postPath,
  postedPhotoToday,
  reportText,
  timeSince,
  type PhotoViewer,
  type PostRow,
} from "@/lib/elite/tracker";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");

// The free app's posts (migration 069): a log with a photo, shared with
// the friends a player added. Wed Nov 18 2026 is "today" throughout.
const today = "2026-11-18";
const yesterday = "2026-11-17";
const ME = "11111111-1111-4111-8111-111111111111";
const GARY = "22222222-2222-4222-8222-222222222222";
const DANI = "33333333-3333-4333-8333-333333333333";
const STRANGER = "44444444-4444-4444-8444-444444444444";

let n = 0;
function post(owner: string, day: string, extra: Partial<PostRow> = {}): PostRow {
  n += 1;
  const id = `0000000${n}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`.slice(-36);
  return {
    id,
    profile_id: owner,
    trained_on: day,
    minutes: 45,
    kind: "training",
    created_at: `${day}T15:${String(n % 60).padStart(2, "0")}:00.000Z`,
    photo_path: `${owner}/${id}.jpg`,
    caption: "Weak foot, pop and juggle",
    removed_at: null,
    ...extra,
  };
}

function viewer(extra: Partial<PhotoViewer> = {}): PhotoViewer {
  return {
    id: ME,
    staff: false,
    friendIds: new Set([GARY, DANI]),
    unlocked: false,
    reported: new Set(),
    ...extra,
  };
}

describe("the rule of the feed: post yours to see theirs", () => {
  it("a friend's post from today is locked until you have posted a photo today", () => {
    const theirs = post(GARY, today);
    expect(postLocked({ post: theirs, viewerId: ME, today, unlocked: false })).toBe(true);
    expect(postLocked({ post: theirs, viewerId: ME, today, unlocked: true })).toBe(false);
  });

  it("your own posts are always open", () => {
    const mine = post(ME, today);
    expect(postLocked({ post: mine, viewerId: ME, today, unlocked: false })).toBe(false);
    expect(mayViewPhoto(mine, viewer({ unlocked: false }), today)).toBe(true);
  });

  it("yesterday's post never locks, whatever you did today", () => {
    const theirs = post(GARY, yesterday);
    expect(postLocked({ post: theirs, viewerId: ME, today, unlocked: false })).toBe(false);
    expect(mayViewPhoto(theirs, viewer({ unlocked: false }), today)).toBe(true);
  });

  it("only a photo of your own, posted today, unlocks", () => {
    // a log with no photo does not
    expect(postedPhotoToday([post(ME, today, { photo_path: null })], ME, today)).toBe(false);
    // yesterday's photo does not
    expect(postedPhotoToday([post(ME, yesterday)], ME, today)).toBe(false);
    // somebody else's photo does not
    expect(postedPhotoToday([post(GARY, today)], ME, today)).toBe(false);
    // a photo a coach took down does not
    expect(postedPhotoToday([post(ME, today, { removed_at: "2026-11-18T16:00:00Z" })], ME, today)).toBe(false);
    // today's photo does
    expect(postedPhotoToday([post(ME, today)], ME, today)).toBe(true);
  });

  it("the day turns over at New York midnight: last night's post opens, tonight's locks", () => {
    // posted at 11:59pm New York on the 17th (04:59 UTC on the 18th): the
    // post belongs to the 17th, so on the 18th it is open
    const lateLastNight = post(GARY, yesterday, { created_at: "2026-11-18T04:59:00.000Z" });
    expect(mayViewPhoto(lateLastNight, viewer(), today)).toBe(true);
    // posted at 12:01am New York on the 18th: it belongs to the 18th
    const justAfter = post(GARY, today, { created_at: "2026-11-18T05:01:00.000Z" });
    expect(mayViewPhoto(justAfter, viewer(), today)).toBe(false);
    // and the photo you posted on the 17th stops unlocking once it is the 18th
    expect(postedPhotoToday([post(ME, yesterday)], ME, today)).toBe(false);
    // the day itself comes from the server's New York clock, never the phone
    expect(code("app/api/elite/tracker/post/route.ts")).toContain("const today = nyToday();");
  });
});

describe("who may be handed a photo", () => {
  const theirs = post(GARY, yesterday);

  it("the owner, a friend the rule allows, and coaches. Nobody else", () => {
    expect(mayViewPhoto(theirs, viewer({ id: GARY, friendIds: new Set() }), today)).toBe(true);
    expect(mayViewPhoto(theirs, viewer(), today)).toBe(true);
    expect(mayViewPhoto(theirs, viewer({ id: "coach", staff: true, friendIds: new Set() }), today)).toBe(true);
    expect(mayViewPhoto(theirs, viewer({ id: STRANGER, friendIds: new Set([DANI]) }), today)).toBe(false);
    // a friend of a friend is not a friend
    expect(mayViewPhoto(post(STRANGER, yesterday), viewer(), today)).toBe(false);
  });

  it("not a locked one, not one you reported, not one older than the feed", () => {
    const locked = post(GARY, today);
    expect(mayViewPhoto(locked, viewer({ unlocked: false }), today)).toBe(false);
    expect(mayViewPhoto(locked, viewer({ unlocked: true }), today)).toBe(true);
    expect(mayViewPhoto(theirs, viewer({ reported: new Set([theirs.id]) }), today)).toBe(false);
    expect(FEED_DAYS).toBe(7);
    expect(feedSince(today)).toBe("2026-11-12");
    expect(mayViewPhoto(post(GARY, "2026-11-12"), viewer(), today)).toBe(true);
    expect(mayViewPhoto(post(GARY, "2026-11-11"), viewer(), today)).toBe(false);
    // the owner still sees their own old post
    expect(mayViewPhoto(post(ME, "2026-11-01"), viewer(), today)).toBe(true);
  });

  it("a removed post is shown to nobody, not its owner and not a coach", () => {
    const gone = post(GARY, yesterday, { removed_at: "2026-11-18T10:00:00Z" });
    expect(mayViewPhoto(gone, viewer(), today)).toBe(false);
    expect(mayViewPhoto(gone, viewer({ id: GARY }), today)).toBe(false);
    expect(mayViewPhoto(gone, viewer({ staff: true }), today)).toBe(false);
    // and an entry with no photo has nothing to show
    expect(mayViewPhoto(post(GARY, yesterday, { photo_path: null }), viewer(), today)).toBe(false);
  });
});

describe("props", () => {
  it("from a friend who can see the post, never on your own, never on a locked one", () => {
    expect(mayGiveProps(post(GARY, yesterday), viewer(), today)).toBe(true);
    expect(mayGiveProps(post(ME, today), viewer(), today)).toBe(false);
    expect(mayGiveProps(post(GARY, today), viewer({ unlocked: false }), today)).toBe(false);
    expect(mayGiveProps(post(GARY, today), viewer({ unlocked: true }), today)).toBe(true);
    expect(mayGiveProps(post(STRANGER, yesterday), viewer(), today)).toBe(false);
    expect(mayGiveProps(post(GARY, yesterday), viewer({ staff: true }), today)).toBe(false);
  });

  it("the server asks the rule before it writes, and it is one per player per post", () => {
    const acts = code("lib/elite/tracker-actions.ts");
    const fn = acts.slice(acts.indexOf("export async function toggleProps("), acts.indexOf("export async function reportPost("));
    expect(fn.indexOf("mayGiveProps(found.post, found.viewer, today)")).toBeGreaterThan(-1);
    expect(fn.indexOf("mayGiveProps(")).toBeLessThan(fn.indexOf('.from("elite_log_props")'));
    expect(read("supabase/migrations/069_free_training_log.sql")).toContain("primary key (log_id, profile_id)");
  });
});

describe("the feed", () => {
  const names = new Map([
    [ME, "Marcus B."],
    [GARY, "Gary G."],
    [DANI, "Dani R."],
  ]);

  it("is the last seven days, newest first: your friends' photos and your own", () => {
    const rows = [
      post(GARY, yesterday, { created_at: "2026-11-17T20:00:00Z" }),
      post(ME, yesterday, { created_at: "2026-11-17T22:00:00Z" }),
      post(DANI, "2026-11-13", { created_at: "2026-11-13T20:00:00Z" }),
      post(GARY, "2026-11-10"), // older than the feed
      post(STRANGER, yesterday), // not a friend
      post(DANI, yesterday, { photo_path: null }), // logged with no photo
      post(DANI, yesterday, { removed_at: "2026-11-17T23:00:00Z" }), // taken down
    ];
    const cards = buildFeed({ rows, viewer: viewer(), names, today });
    expect(cards.map((c) => (c.state === "open" ? c.name : "locked"))).toEqual(["You", "Gary G.", "Dani R."]);
    const mine = cards[0];
    expect(mine.state === "open" && mine.mine).toBe(true);
  });

  it("a locked card carries a first name, the time and nothing else", () => {
    const rows = [post(GARY, today, { caption: "Secret session" })];
    const [card] = buildFeed({ rows, viewer: viewer({ unlocked: false }), names, today });
    expect(card).toEqual({
      state: "locked",
      id: rows[0].id,
      first: "Gary",
      initials: "GG",
      kind: "training",
      minutes: 45,
    });
    expect(JSON.stringify(card)).not.toContain(".jpg");
    expect(JSON.stringify(card)).not.toContain("Secret");
    // once you have posted, the same post opens
    const [open] = buildFeed({ rows, viewer: viewer({ unlocked: true }), names, today });
    expect(open.state).toBe("open");
  });

  it("a post you reported is gone from your feed at once", () => {
    const rows = [post(GARY, yesterday), post(DANI, yesterday)];
    const cards = buildFeed({ rows, viewer: viewer({ reported: new Set([rows[0].id]) }), names, today });
    expect(cards.map((c) => c.id)).toEqual([rows[1].id]);
  });

  it("the server only makes an address for a card the rule opened", () => {
    const server = code("lib/elite/tracker-server.ts");
    const fn = server.slice(server.indexOf("export async function feedFor("), server.indexOf("export async function postForViewer("));
    expect(fn).toContain('const open = cards.filter((c): c is OpenCard => c.state === "open");');
    expect(fn).toContain("sign(open.map((c) => c.photoPath))");
    expect(fn).toContain('if (c.state === "locked") return [c];');
    // the stored path never reaches the screen, only the short-lived address
    expect(fn).toContain("const { photoPath: _path, createdAt, ...rest } = c;");
    expect((server.match(/createSignedUrls\(/g) ?? []).length).toBe(1);
    expect(server).not.toMatch(/getPublicUrl/);
    for (const f of ["lib/elite/tracker-actions.ts", "lib/elite/tracker-coach.ts", "app/api/elite/tracker/post/route.ts"]) {
      expect(code(f), f).not.toMatch(/getPublicUrl/);
    }
  });

  it("the row of faces: you first, then whoever trained today", () => {
    const faces = facesRow({
      me: { id: ME, name: "Marcus B." },
      friends: [
        { id: DANI, name: "Dani R." },
        { id: GARY, name: "Gary G." },
        { id: STRANGER, name: "Leo K." },
      ],
      activeToday: new Set([GARY, DANI]),
    });
    expect(faces.map((f) => [f.first, f.initials, f.active])).toEqual([
      ["You", "MB", false],
      ["Dani", "DR", true],
      ["Gary", "GG", true],
      ["Leo", "LK", false],
    ]);
    expect(initialsOf("Marcus")).toBe("M");
    expect(initialsOf("")).toBe("");
  });

  it("the words on a locked card and the time on an open one", () => {
    expect(lockedHeadline("Gary", 75, "training")).toBe("Gary trained 1h 15m today");
    expect(lockedHeadline("Gary", 45, "gym")).toBe("Gary was in the gym 45m today");
    expect(lockedLine(3)).toBe("3 of your friends have trained today. Post yours to see theirs.");
    expect(lockedLine(1)).toBe("1 of your friends has trained today. Post yours to see theirs.");
    const now = new Date("2026-11-18T18:00:00Z").getTime();
    expect(timeSince({ day: today, createdAt: "2026-11-18T17:59:40Z" }, now, today)).toBe("Just now");
    expect(timeSince({ day: today, createdAt: "2026-11-18T17:18:00Z" }, now, today)).toBe("42 min ago");
    expect(timeSince({ day: today, createdAt: "2026-11-18T15:30:00Z" }, now, today)).toBe("2h ago");
    expect(timeSince({ day: yesterday, createdAt: "2026-11-17T15:30:00Z" }, now, today)).toBe("Yesterday");
    expect(timeSince({ day: "2026-11-16", createdAt: "2026-11-16T15:30:00Z" }, now, today)).toBe("Mon, Nov 16");
  });
});

describe("a post's photo and its one line", () => {
  it("lives at the account's own folder, under the entry's own id", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(postPath(ME, id)).toBe(`${ME}/${id}.jpg`);
    expect(postPath("../etc", id)).toBeNull();
    expect(postPath(ME, "not-an-id")).toBeNull();
    expect(ownsPostPath(`${ME}/${id}.jpg`, ME)).toBe(true);
    expect(ownsPostPath(`${GARY}/${id}.jpg`, ME)).toBe(false);
    expect(ownsPostPath(`${ME}/../${GARY}/${id}.jpg`, ME)).toBe(false);
    expect(ownsPostPath(`${ME}/${id}.png`, ME)).toBe(false);
    expect(ownsPostPath(`${ME}/sub/${id}.jpg`, ME)).toBe(false);
  });

  it("is a JPEG, shrunk on the phone to 1440 on its longest side", () => {
    expect(looksLikeJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe(true);
    expect(looksLikeJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false); // a PNG
    expect(looksLikeJpeg(new Uint8Array([0xff, 0xd8]))).toBe(false);
    expect(POST_MAX_EDGE).toBe(1440);
    expect(fitWithin(4032, 3024)).toEqual({ width: 1440, height: 1080 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1080, height: 1440 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 }); // never made bigger
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 });
    const composer = code("components/elite/PostComposer.tsx");
    expect(composer).toContain("fitWithin(");
    expect(composer).toContain('"image/jpeg", POST_JPEG_QUALITY');
    // the camera opens from the plus (and every Post my training button)
    expect(code("components/elite/FreeShell.tsx")).toMatch(/type="file"\s+accept="image\/\*"\s+capture="environment"/);
  });

  it("the server takes the photo only after it knows who is signed in, and only a JPEG", () => {
    const route = code("app/api/elite/tracker/post/route.ts");
    const order = [
      "const viewer = await getViewer();",
      "const tracker = await trackerFor(viewer);",
      "validateMinutes(",
      "mayLog(kind, tracker.grade)",
      "file.size > POST_MAX_BYTES",
      "looksLikeJpeg(photo)",
      "await savePost({ profileId: viewer.profile.id, today,",
    ].map((mark) => route.indexOf(mark));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    // the account, the day and the path are the server's own
    expect(route).not.toMatch(/form\.get\("(profile|profile_id|path|day|trained_on)"\)/);
    const server = code("lib/elite/tracker-server.ts");
    expect(server).toContain("const path = postPath(input.profileId, id);");
    expect(server).toContain('.upload(path, input.photo, { contentType: "image/jpeg", upsert: false })');
  });

  it("the note is one plain line of 80 characters at most", () => {
    expect(CAPTION_MAX).toBe(80);
    expect(cleanCaption("  Weak foot,\n pop and   juggle ")).toBe("Weak foot, pop and juggle");
    expect(cleanCaption("")).toBeNull();
    expect(cleanCaption("   ")).toBeNull();
    expect(cleanCaption(undefined)).toBeNull();
    expect(cleanCaption("x".repeat(200))).toHaveLength(80);
    expect(read("supabase/migrations/069_free_training_log.sql")).toContain("char_length(caption) <= 80");
  });

  it("the bucket is private: no browser can read or write it", () => {
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(POST_BUCKET).toBe("tracker-posts");
    expect(sql).toContain("values ('tracker-posts', 'tracker-posts', false, 3000000, array['image/jpeg'])");
    const policies = sql.match(/create policy \w+ on storage\.objects[\s\S]*?;/g) ?? [];
    expect(policies).toHaveLength(1);
    expect(policies[0]).toContain("for select using (bucket_id = 'tracker-posts' and public.elite_is_coach())");
    // no browser-side upload anywhere: the photo goes to our own route
    const composer = code("components/elite/PostComposer.tsx");
    expect(composer).toContain('fetch("/api/elite/tracker/post"');
    expect(composer).not.toMatch(/supabase|storage/i);
  });

  it("deleting an entry or an account deletes the photo", () => {
    const acts = code("lib/elite/tracker-actions.ts");
    const del = acts.slice(acts.indexOf("export async function deleteLog("), acts.indexOf("export async function confirmFriend("));
    expect(del).toContain("ownsPostPath(path, o.profileId)");
    expect(del).toContain(".storage.from(POST_BUCKET).remove([path])");
    const account = code("lib/elite/account-actions.ts");
    expect(account.indexOf("await removeTrackerFiles(user.id)")).toBeGreaterThan(-1);
    expect(account.indexOf("await removeTrackerFiles(user.id)")).toBeLessThan(account.indexOf("admin.auth.admin.deleteUser(user.id)"));
  });

  it("the posting screen says who sees a photo before anything is sent", () => {
    expect(POST_RULES_LINE).toBe("Photos of your training only. Your friends see them. Coaches can remove a post.");
    expect(code("components/elite/PostComposer.tsx")).toContain("{POST_RULES_LINE}");
  });
});

describe("reporting a post", () => {
  it("has four reasons", () => {
    expect(REPORT_REASONS.map((r) => r.id)).toEqual(["not_training", "inappropriate", "bullying", "other"]);
    expect(cleanReason("bullying")).toBe("bullying");
    expect(cleanReason("because")).toBeNull();
    expect(read("supabase/migrations/069_free_training_log.sql")).toContain(
      "check (reason in ('not_training', 'inappropriate', 'bullying', 'other'))"
    );
  });

  it("only a post you can see, never your own, once per player, and the coaches hear once per post", () => {
    const acts = code("lib/elite/tracker-actions.ts");
    const fn = acts.slice(acts.indexOf("export async function reportPost("), acts.indexOf("type Coach ="));
    expect(fn).toContain("found.post.profile_id === o.profileId || !mayViewPhoto(found.post, found.viewer, today)");
    expect(fn).toContain('onConflict: "log_id,reporter_id", ignoreDuplicates: true');
    expect(fn).toMatch(/if \(!count\) \{/);
    expect(read("supabase/migrations/069_free_training_log.sql")).toContain("unique (log_id, reporter_id)");
    expect(reportText("Gary G.", "https://thestriveapp.com/coach/free")).toBe(
      "A photo Gary G. posted in the free app was reported. Look at it here: https://thestriveapp.com/coach/free"
    );
  });

  it("a coach removes the post or says no action; a removed post keeps its minutes", () => {
    const acts = code("lib/elite/tracker-actions.ts");
    const remove = acts.slice(acts.indexOf("export async function removePost("), acts.indexOf("export async function dismissReports("));
    expect(remove).toContain('if (c.kind === "no") return fail("Only a coach can remove a post.");');
    expect(remove).toContain(".update({ removed_at: new Date().toISOString(), removed_by: c.profileId })");
    expect(remove).toContain(".storage.from(POST_BUCKET).remove([path])");
    expect(remove).toContain('closeReports(c, logId, "removed")');
    expect(remove).not.toMatch(/\.delete\(\)/); // the entry stays: the minutes count
    expect(acts).toContain('closeReports(c, logId, "none")');
    // a player cannot reach either
    const coachFn = acts.slice(acts.indexOf("async function coach()"), acts.indexOf("export async function setFreeSignupOpen("));
    expect(coachFn).toContain('if (!viewer || viewer.role === "player") return { kind: "no" };');
  });
});

describe("blocking", () => {
  it("is two-way in effect and survives the link", () => {
    const blocks = [{ blocker: ME, blocked: GARY }];
    expect(blockedEitherWay(blocks, ME, GARY)).toBe(true);
    expect(blockedEitherWay(blocks, GARY, ME)).toBe(true);
    expect(blockedEitherWay(blocks, ME, DANI)).toBe(false);
    expect(canBefriend(ME, GARY, blocks)).toBe(false);
    expect(canBefriend(GARY, ME, blocks)).toBe(false);
    expect(canBefriend(ME, DANI, blocks)).toBe(true);
    expect(canBefriend(ME, ME, [])).toBe(false);
  });

  it("the server refuses to pair a blocked two, by link or any other way", () => {
    const server = code("lib/elite/tracker-server.ts");
    const make = server.slice(server.indexOf("export async function makeFriends("), server.indexOf("export async function blockedFor("));
    expect(make.indexOf('return "blocked";')).toBeGreaterThan(-1);
    expect(make.indexOf("blockedEitherWay(await blocksBetween(admin, x, y), x, y)")).toBeLessThan(
      make.indexOf('.from("elite_tracker_friends")')
    );
    // the question is not even asked of a blocked pair
    const ask = server.slice(server.indexOf("export async function friendAskFor("), server.indexOf("async function blocksBetween("));
    expect(ask).toContain("blockedEitherWay(await blocksBetween(admin, viewer.profile.id, ownerId)");
    // every read of the blocks is tied to named accounts
    for (const m of server.matchAll(/\.from\("elite_tracker_blocks"\)\.select\([^)]*\)([\s\S]{0,30})/g)) {
      expect(m[1]).toMatch(/^\.eq\("blocker", /);
    }
  });

  it("blocking ends the friendship, and only a current friend can be blocked", () => {
    const acts = code("lib/elite/tracker-actions.ts");
    const fn = acts.slice(acts.indexOf("export async function blockPlayer("), acts.indexOf("export async function unblockPlayer("));
    expect(fn).toContain('if (!friends) return fail("Nobody to block.");');
    expect(fn).toContain('.upsert({ blocker: o.profileId, blocked: friendId }');
    expect(fn).toContain('.from("elite_tracker_friends").delete().eq("a", pair.a).eq("b", pair.b)');
    // the one who blocked takes it back; the row named is always their own
    const un = acts.slice(acts.indexOf("export async function unblockPlayer("), acts.indexOf("export async function toggleProps("));
    expect(un).toContain('.eq("blocker", o.profileId)');
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).toContain("primary key (blocker, blocked)");
    expect(sql).toContain("for select using (blocker = auth.uid())");
  });
});

describe("13 and older", () => {
  it("is one number", () => {
    expect(FREE_MIN_AGE).toBe(13);
    expect(UNDER_AGE_LINE).toBe(
      "The free app is for players 13 and older. A parent can reach us about coaching for a younger player."
    );
  });

  it("counts a birthday once its month is over, so nobody is let in early", () => {
    // today is Nov 18 2026
    expect(ageFromBirth({ month: 10, year: 2013 }, today)).toBe(13);
    expect(oldEnough({ month: 10, year: 2013 }, today)).toBe(true);
    // born November 2013: 13 some day this month, not counted until December
    expect(ageFromBirth({ month: 11, year: 2013 }, today)).toBe(12);
    expect(oldEnough({ month: 11, year: 2013 }, today)).toBe(false);
    expect(oldEnough({ month: 11, year: 2013 }, "2026-12-01")).toBe(true);
    expect(oldEnough({ month: 12, year: 2013 }, today)).toBe(false);
    expect(oldEnough({ month: 1, year: 2014 }, today)).toBe(false);
    expect(oldEnough({ month: 6, year: 2008 }, today)).toBe(true);
  });

  it("takes a real month and year, never one in the future", () => {
    expect(cleanBirth({ month: "3", year: "2010" }, today)).toEqual({ month: 3, year: 2010 });
    expect(cleanBirth({ month: 0, year: 2010 }, today)).toBeNull();
    expect(cleanBirth({ month: 13, year: 2010 }, today)).toBeNull();
    expect(cleanBirth({ month: 12, year: 2026 }, today)).toBeNull();
    expect(cleanBirth({ month: 3, year: 2027 }, today)).toBeNull();
    expect(cleanBirth({ month: 3, year: 1900 }, today)).toBeNull();
    expect(cleanBirth({}, today)).toBeNull();
  });

  it("is asked before anything else is typed, and cannot be answered twice in a visit", () => {
    const form = code("components/elite/JoinForm.tsx");
    expect(form.indexOf("When were you born?")).toBeGreaterThan(-1);
    expect(form).toContain("await checkJoinAge(");
    // the name, email and password fields are not drawn until the age is in
    expect(form).toMatch(/if \(step === "age"\) \{[\s\S]*?return \(/);
    const acts = code("lib/elite/tracker-actions.ts");
    const fn = acts.slice(acts.indexOf("export async function checkJoinAge("), acts.indexOf("export async function saveQuiz("));
    expect(fn).toContain("if (cookies().get(JOIN_AGE_COOKIE)) return { ok: true, allowed: false };");
    expect(fn).toContain("cookies().set(JOIN_AGE_COOKIE,");
    expect(fn).not.toMatch(/maxAge/); // it lasts the visit
    expect(fn).not.toMatch(/\.from\(/); // and the date is stored nowhere
    const page = code("app/(auth)/join/page.tsx");
    expect(page).toContain("cookies().get(JOIN_AGE_COOKIE)");
    expect(page).toContain("<UnderAge />");
  });

  it("the account stores the month and year, nothing finer", () => {
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).toContain("birth_year     smallint");
    expect(sql).toContain("birth_month    smallint");
    expect(sql).not.toMatch(/birth_date|birthday|date_of_birth/);
  });
});

describe("the legal pages say what the free app does", () => {
  it("13 and older, who sees a photo, report and block, removal", () => {
    const flat = (p: string) => read(p).replace(/\s+/g, " ");
    const privacy = flat("app/privacy/page.tsx");
    expect(privacy).toContain("the free app is for players 13 and older.");
    expect(privacy).toContain("the month and year you were born (never the day)");
    expect(privacy).toContain(
      "The friends you added by link see your first name, last initial, your training time and the photos you post; our coaches can see them too, and nobody else does."
    );
    expect(privacy).toContain("You can report a post or block a player at any time, and we can remove a post.");
    const terms = flat("app/terms/page.tsx");
    expect(terms).toContain("A free account is for players 13 and older.");
    expect(terms).toContain("The friends you added see them, and so do our coaches.");
    expect(terms).toContain("You can report a post or block a player at any time. We can remove any post");
  });
});

describe("the coach queue and taking a block back", () => {
  it("the coach page leads with the reported posts, and counts posts and open reports", () => {
    const page = code("app/(coach)/coach/free/page.tsx");
    expect(page).toContain("<ReportsQueue reports={data.reports} />");
    expect(page).toContain("{data.posts_week}");
    expect(page).toContain("{data.reports.length}");
    expect(page).toContain('"Posts this week"');
    const queue = code("components/elite/ReportsQueue.tsx");
    expect(queue).toContain("removePost(r.log_id)");
    expect(queue).toContain("dismissReports(r.log_id)");
    // the queue reads open reports only, and only posts still up
    const coach = code("lib/elite/tracker-coach.ts");
    expect(coach).toContain('.is("resolved_at", null)');
    expect(coach).toContain("return l && l.photo_path && !l.removed_at;");
  });

  it("a blocked player can be taken back from Account, by the player who blocked them", () => {
    const account = code("app/account/page.tsx");
    expect(account).toContain("const blocked = tracker ? await blockedFor(viewer) : [];");
    expect(account).toContain("<BlockedList blocked={blocked} />");
    expect(code("components/elite/BlockedList.tsx")).toContain("await unblockPlayer(b.id)");
  });

  it("report and block are on every friend's post; delete is on your own", () => {
    const feed = code("components/elite/FriendsFeed.tsx");
    expect(feed).toContain('<SheetButton onClick={() => setMenu("delete")}>Delete my post</SheetButton>');
    expect(feed).toContain('<SheetButton onClick={() => setMenu("report")}>Report this post</SheetButton>');
    expect(feed).toContain('<SheetButton onClick={() => setMenu("block")}>Block {card.first}</SheetButton>');
    expect(feed).toMatch(/\{card\.mine \? \(\s*<SheetButton onClick=\{\(\) => setMenu\("delete"\)\}/);
    expect(feed).toContain("act(() => reportPost(card.id, r.id))");
    expect(feed).toContain("act(() => blockPlayer(card.ownerId))");
    // a reported or blocked post leaves the screen at once
    expect(feed).toContain("onGone();");
  });
});
