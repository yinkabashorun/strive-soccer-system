// ONE APP (Coach Yinka, Nov 24 2026: "pro should just add tabs", after "why
// would they lose friends when they upgrade"). A free player who starts
// Strive Pro keeps everything the free app gave them, and gains one tab.
// These tests hold that from the rule down to the routes.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FREE_APP_TABS, PRO_ENDED_LINE, POST_SESSION_ROW, TRAIN_TAB, firstTab, keepsFreeApp, oneAppTabs, proEnded } from "@/lib/elite/one-app";
import { livesInFreeApp, memberState } from "@/lib/elite/member-gate";
import { accessAllowed } from "@/lib/elite/app-api";
import { nativeRouteFor } from "@/lib/elite/notice-routes";
import { parseSessionRef, sessionLogId, sessionLogMinutes, SESSION_LOG_MAX } from "@/lib/elite/session-log";
import { devicesWhere } from "@/lib/elite/push";
import { topicsFor } from "@/lib/elite/notices";

const src = (p: string) => readFileSync(p, "utf8");
const proOn = { tier: "pro", subscription_status: "active", onboarded_at: "2026-11-20T00:00:00Z" };
const proOff = { tier: "pro", subscription_status: "none", onboarded_at: null };

describe("the tabs", () => {
  it("a free player has Friends, Week, Clubs, You", () => {
    expect(oneAppTabs(false).map((t) => t.label)).toEqual(["Friends", "Week", "Clubs", "You"]);
    expect(firstTab(false)).toBe("friends");
  });

  it("Strive Pro adds exactly one tab, Train, and removes or moves none", () => {
    const free = oneAppTabs(false);
    const pro = oneAppTabs(true);
    expect(pro).toEqual([TRAIN_TAB, ...free]);
    expect(pro.length).toBe(free.length + 1);
    for (const t of FREE_APP_TABS) expect(pro.map((x) => x.key)).toContain(t.key);
    // an iPhone tab bar shows five; a sixth would be hidden under "More"
    expect(pro.length).toBeLessThanOrEqual(5);
    expect(firstTab(true)).toBe("train");
  });
});

describe("who keeps the free app", () => {
  it("a free account, before, during and after Strive Pro", () => {
    expect(keepsFreeApp({ hasTracker: true, hasPlayer: false, tier: null })).toBe(true);
    expect(keepsFreeApp({ hasTracker: true, hasPlayer: true, tier: "pro" })).toBe(true);
    // no free account behind them: nothing to keep
    expect(keepsFreeApp({ hasTracker: false, hasPlayer: true, tier: "pro" })).toBe(false);
    // an invite family is not a free account
    expect(keepsFreeApp({ hasTracker: true, hasPlayer: true, tier: "elite" })).toBe(false);
  });

  it("the gate says a paid-up member from the free app is BOTH: in, and social", () => {
    const base = { role: "player" as const, playerId: "p1", consentDue: false };
    expect(memberState({ ...base, isFree: true, hasFreeApp: true, player: proOn })).toEqual({ kind: "ok", social: true });
    // a Pro member who joined directly has no free app: the member app
    expect(memberState({ ...base, isFree: false, hasFreeApp: false, player: proOn })).toEqual({ kind: "ok" });
    // not paid: still a free player, exactly as before
    expect(memberState({ ...base, isFree: true, hasFreeApp: true, freeStage: "ready", player: proOff })).toEqual({ kind: "free", stage: "ready" });
    // and "lives in the free app" still means only that last one
    expect(livesInFreeApp({ hasTracker: true, hasPlayer: true, player: proOn })).toBe(false);
    expect(livesInFreeApp({ hasTracker: true, hasPlayer: true, player: proOff })).toBe(true);
  });

  it("every free route still answers them, and every member route too", () => {
    const social = { kind: "ok", social: true } as const;
    for (const access of ["account", "player", "person", "member", "free", "free_app"] as const) {
      expect(accessAllowed(access, social, false), access).toBe(true);
    }
    // ...except the three that only make sense before Strive Pro is on:
    // the quiz, the offer and the checkout. A member is never sent to pay
    // a second time.
    expect(accessAllowed("free_only", social, false)).toBe(false);
    expect(accessAllowed("free_only", { kind: "free", stage: "offer" }, false)).toBe(true);
    for (const [file, name] of [["intake", "free-intake"], ["offer", "free-offer"], ["upgrade", "free-upgrade"]]) {
      expect(src(`app/api/app/free/${file}/route.ts`), file).toContain(`name: "${name}", access: "free_only"`);
    }
    // a member with no free app is still refused the free routes
    expect(accessAllowed("free_app", { kind: "ok" }, false)).toBe(false);
    expect(accessAllowed("free", { kind: "ok" }, false)).toBe(false);
    // the photo and username gate holds for them like anyone
    expect(accessAllowed("free_app", social, true)).toBe(false);
    // a free player is still refused the member routes
    expect(accessAllowed("member", { kind: "free", stage: "ready" }, false)).toBe(false);
  });

  it("the server's free-app reader answers for both, and the free-only reader for one", () => {
    const s = src("lib/elite/tracker-server.ts");
    expect(s).toMatch(/export async function trackerFor[\s\S]{0,200}freeSideOf\(viewer\)\)\?\.tracker/);
    expect(s).toMatch(/export async function freeAccountFor[\s\S]{0,200}side\.lives \? side\.tracker : null/);
    expect(s).toMatch(/keepsFreeApp\(\{ hasTracker: true, hasPlayer: true, tier: player\?\.tier \}\)/);
    // the Account page and what a phone is filed under must tell a free
    // account from a member (a member's Account has Cancel Strive Pro)
    for (const p of ["app/account/page.tsx", "app/account/delete/page.tsx", "app/api/elite/push/subscribe/route.ts", "app/api/elite/push/native/route.ts"]) {
      expect(src(p), p).toContain("freeAccountFor(viewer)");
      expect(src(p), p).not.toContain("trackerFor(viewer)");
    }
  });

  it("their notification choices are both kinds: their week, and friends and clubs", () => {
    expect(topicsFor({ member: true, free: true, coachTime: false })).toEqual(expect.arrayContaining(["week", "friends", "clubs"]));
    const s = src("lib/elite/notice-prefs-server.ts");
    expect(s).toContain("freeAccountFor(viewer)");
    expect(s).toMatch(/const member = Boolean\(viewer\.playerId\) && lives === null/);
  });
});

describe("a push reaches the person, whichever key their phone is on file under", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  it("the player's devices and their profile's", () => {
    expect(devicesWhere("player_id", A, [B])).toBe(`player_id.eq.${A},profile_id.eq.${B}`);
    expect(devicesWhere("profile_id", B, [A])).toBe(`profile_id.eq.${B},player_id.eq.${A}`);
    expect(devicesWhere("profile_id", B, [])).toBe(`profile_id.eq.${B}`);
  });
  it("nothing that is not an id ever goes into the filter", () => {
    expect(devicesWhere("player_id", A, ["x,profile_id.neq.0"])).toBe(`player_id.eq.${A}`);
  });
  it("both senders go through it", () => {
    const s = src("lib/elite/push.ts");
    expect(s.match(/\.or\(where\)/g)?.length).toBe(2);
    expect(s).not.toMatch(/\.eq\(column, id\)/);
  });
});

describe("a finished session counts once on the week", () => {
  const P = "33333333-3333-4333-8333-333333333333";
  it("the entry's id is the same for the same session, and different for another", () => {
    const id = sessionLogId(P, 3, 2);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(sessionLogId(P, 3, 2)).toBe(id);
    expect(sessionLogId(P, 3, 3)).not.toBe(id);
    expect(sessionLogId(P, 4, 2)).not.toBe(id);
    expect(sessionLogId("44444444-4444-4444-8444-444444444444", 3, 2)).not.toBe(id);
  });

  it("the minutes are the ones really trained, only once every drill is done", () => {
    const done = (s: number) => ({ completed: true, duration_min: 6, actual_seconds: s });
    expect(sessionLogMinutes([done(300), done(240), done(360)])).toBe(15);
    // one drill still open: not finished, nothing on the week
    expect(sessionLogMinutes([done(300), { completed: false, duration_min: 6, actual_seconds: null }])).toBeNull();
    // tapped through in seconds: finished, and worth nothing
    expect(sessionLogMinutes([done(4), done(6)])).toBeNull();
    expect(sessionLogMinutes([])).toBeNull();
    // a drill from before the clock keeps the plan's minutes (the one rule)
    expect(sessionLogMinutes([{ completed: true, duration_min: 6, actual_seconds: null }])).toBe(6);
    // never more than the table takes
    expect(sessionLogMinutes(Array.from({ length: 40 }, () => done(720)))).toBe(SESSION_LOG_MAX);
  });

  it("the phone names a session and nothing else", () => {
    expect(parseSessionRef("3-2")).toEqual({ week: 3, session: 2 });
    for (const bad of ["", "3", "3-", "0-1", "3-0", "3-2-1", "a-b", "3-2; drop", null, 32]) expect(parseSessionRef(bad), String(bad)).toBeNull();
  });

  it("the tick itself settles it, for the website and the app alike", () => {
    const s = src("lib/elite/player-actions.ts");
    expect(s).toMatch(/settleSessionLogForDrill\(\{ playerId: viewer\.playerId, profileId: viewer\.profile\.id, homeworkId: id \}\)/);
    const log = src("lib/elite/session-log.ts");
    // only an account with the free app has a week to put it on
    expect(log).toMatch(/from\("elite_trackers"\)[\s\S]{0,160}if \(!tracker\) return false/);
    // a second write of the same session is "already there", not an error
    expect(log).toContain('"23505"');
    // a drill unticked takes it back off, unless friends already see a photo
    expect(log).toMatch(/\.delete\(\)\.eq\("id", id\)\.eq\("profile_id", i\.profileId\)\.is\("photo_path", null\)/);
  });

  it("posting it adds a photo to that same entry: the time is never sent, never counted twice", () => {
    const route = src("app/api/elite/tracker/post/route.ts");
    expect(route).toMatch(/settleSessionLog\(ref\)/);
    expect(route).toMatch(/attachSessionPhoto\(\{ profileId: viewer\.profile\.id, logId, caption, photo \}\)/);
    const attach = src("lib/elite/tracker-server.ts");
    const fn = attach.slice(attach.indexOf("export async function attachSessionPhoto"), attach.indexOf("// Every photo an account ever posted"));
    expect(fn).not.toMatch(/minutes/);
    expect(fn).toMatch(/\.is\("photo_path", null\)/);
    // the phone's session post carries no length
    const phone = src("mobile/src/post-api.ts");
    expect(phone).toMatch(/: \{ session: input\.session, caption: input\.caption\.trim\(\) \}/);
  });
});

describe("when Strive Pro ends", () => {
  it("is said only to someone it was really on for", () => {
    expect(proEnded({ tier: "pro", status: "canceled", hadEarnedMonth: false })).toBe(true);
    expect(proEnded({ tier: "pro", status: "none", hadEarnedMonth: true })).toBe(true);
    // tapped Start and never paid: it was never on
    expect(proEnded({ tier: "pro", status: "none", hadEarnedMonth: false })).toBe(false);
    // it is on
    expect(proEnded({ tier: "pro", status: "active", hadEarnedMonth: true })).toBe(false);
    expect(proEnded({ tier: "pro", status: "trialing", hadEarnedMonth: true })).toBe(false);
    expect(proEnded({ tier: "elite", status: "canceled", hadEarnedMonth: false })).toBe(false);
  });

  it("the line is calm, says what is kept, and sells nothing", () => {
    expect(PRO_ENDED_LINE).toMatch(/still here/);
    expect(PRO_ENDED_LINE).not.toMatch(/upgrade|\$|price|missed|lost|!|—/i);
    expect(POST_SESSION_ROW).toBe("Post it to your friends");
  });
});

describe("where a notice opens for a member with the free tabs", () => {
  it("their week on Train, their friends on Friends, a course as the course", () => {
    expect(nativeRouteFor("/dashboard", "social", "week")).toBe("/(free)/train");
    expect(nativeRouteFor("/courses", "social")).toBe("/(free)/train");
    expect(nativeRouteFor("/courses/keep-it-up", "social")).toBe("/course/keep-it-up");
    expect(nativeRouteFor("/log", "social", "friends")).toBe("/(free)/friends");
    expect(nativeRouteFor("/log/clubs", "social")).toBe("/(free)/clubs");
    expect(nativeRouteFor("/you", "social")).toBe("/(free)/me");
    expect(nativeRouteFor("/messages", "social", "coach")).toBe("/inbox");
  });
});

describe("the website", () => {
  it("a member who came through the free app gets a Friends tab on their pages, and nobody loses a tab", async () => {
    const { memberTabs, FRIENDS_TAB } = await import("@/lib/elite/experience");
    for (const tier of ["pro", "elite", "complete"]) {
      const plain = memberTabs(tier);
      const social = memberTabs(tier, true);
      expect(social.filter((t) => t.href !== FRIENDS_TAB.href)).toEqual(plain);
      expect(plain.map((t) => t.href)).not.toContain(FRIENDS_TAB.href);
    }
    expect(memberTabs("pro", true).map((t) => t.label)).toEqual(["Home", "Friends", "Week", "Courses", "You"]);
    expect(memberTabs("pro", true).length).toBeLessThanOrEqual(5);
    const shell = src("app/(player)/layout.tsx");
    expect(shell).toContain("hasFreeApp: Boolean(freeAccount)");
    expect(shell).toContain("memberTabs(player?.tier, social)");
  });

  it("the free pages let them in and add a Train tab; Friends, the plus and My week stay", () => {
    const layout = src("app/(free)/layout.tsx");
    expect(layout).toContain("const side = await freeSideOf(viewer);");
    expect(layout).toContain('if (!side) redirect("/dashboard");');
    expect(layout).toContain("train={train}");
    const shell = src("components/elite/FreeShell.tsx");
    expect(shell).toMatch(/\{train \? \(\s*<Tab href="\/dashboard" label="Train"/);
    for (const label of ['label="Friends"', 'label="My week"', 'aria-label="Post my training"']) expect(shell).toContain(label);
  });
});

describe("the phone", () => {
  it("draws the tab bar from the one rule, and Train is the member's own Home", () => {
    expect(src("mobile/src/tabs.ts")).toContain('from "@shared/one-app"');
    expect(src("mobile/app/(free)/_layout.tsx")).toContain("oneAppTabBar(train)");
    expect(src("mobile/app/(free)/train.tsx")).toContain("<HomeScreen train />");
    expect(src("mobile/app/(tabs)/index.tsx")).toContain("<HomeScreen />");
  });

  it("the one upgrade card is never shown to a member", () => {
    expect(src("mobile/app/(free)/my-week.tsx")).toContain('<UpgradeCard place="week" member={train}');
  });
});
