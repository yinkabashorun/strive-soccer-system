import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SHARE_LINE, SHARE_SOURCE, shareJoinLink, shareText } from "../lib/elite/share-link";
import {
  PROPS_NOTICES_PER_DAY,
  friendPostReceivers,
  isQuietTime,
  noticeKey,
  noticeName,
  nyClock,
  propsWithinDay,
} from "../lib/elite/free-notices";
import { friendPostNotice, noticeProblems, propsNotice } from "../lib/elite/notices";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");

const APP = "https://thestriveapp.com";

// ---- 5. Every share is an invite ------------------------------------

describe("the share link", () => {
  it("while free sign-up is open: their free code, which sends a friend request", () => {
    expect(shareJoinLink({ appUrl: APP, signupOpen: true, referralCode: "ABCD2345", waitlistCode: "WXYZ6789" })).toBe(
      "https://thestriveapp.com/join?ref=ABCD2345&src=share"
    );
  });

  it("while sign-up is closed: their waitlist code when they have one", () => {
    expect(shareJoinLink({ appUrl: APP + "/", signupOpen: false, referralCode: "ABCD2345", waitlistCode: "WXYZ6789" })).toBe(
      "https://thestriveapp.com/join?w=WXYZ6789&src=share"
    );
  });

  it("while sign-up is closed with no waitlist code: their free code, which the waitlist takes", () => {
    expect(shareJoinLink({ appUrl: APP, signupOpen: false, referralCode: "ABCD2345", waitlistCode: null })).toBe(
      "https://thestriveapp.com/join?ref=ABCD2345&src=share"
    );
    const page = code("app/(join)/join/page.tsx");
    expect(page).toContain("const w = cleanWaitlistCode(searchParams?.w) ?? ref;");
    const waitlist = code("lib/elite/waitlist-server.ts");
    expect(waitlist).toMatch(/\.from\("elite_trackers"\)[\s\S]{0,120}\.eq\("referral_code", input\.ref\)/);
  });

  it("always carries the share source", () => {
    expect(SHARE_SOURCE).toBe("share");
    expect(shareJoinLink({ appUrl: APP, signupOpen: true, referralCode: null, waitlistCode: null })).toBe(
      "https://thestriveapp.com/join?src=share"
    );
  });

  it("the share text carries the full link", () => {
    const link = "https://thestriveapp.com/join?ref=ABCD2345&src=share";
    for (const kind of ["week", "then_and_now", "progress_reel"] as const) {
      expect(shareText(kind, link)).toContain(link);
      expect(shareText(kind, link)).not.toMatch(/—|!|\bAI\b/);
    }
  });

  it("the picture and the videos show the address only, never the code", () => {
    expect(SHARE_LINE).toBe("thestriveapp.com/join");
    expect(read("app/api/elite/tracker/card/route.tsx")).toContain("{SHARE_LINE}");
    expect(read("app/api/elite/tracker/card/route.tsx")).not.toMatch(/referral_code|shareJoinLink/);
    const client = code("lib/elite/my-drills-client.ts");
    expect((client.match(/text\(ctx, SHARE_LINE/g) ?? []).length).toBe(2);
    expect(client).not.toMatch(/referral|shareJoinLink/);
  });

  it("every share in the free app hands over the text", () => {
    expect(code("components/elite/ShareWeek.tsx")).toContain('navigator.share({ files: [file], text })');
    expect(code("components/elite/ShareWeek.tsx")).toContain('shareText("week", shareLink)');
    const drills = code("components/elite/MyDrills.tsx");
    expect(drills).toContain('shareText("then_and_now", shareLink)');
    expect(drills).toContain('shareText("progress_reel", shareLink)');
    expect(code("lib/elite/my-drills-client.ts")).toContain("nav.share({ files: [file], title, text })");
  });

  it("a join from a share is recorded for the coaches, without ever stopping a sign-up", () => {
    const route = code("app/api/elite/auth/join/route.ts");
    expect(route).toContain("const source = cleanSource(body.src);");
    expect(route).toMatch(/update\(\{ source \}\)[\s\S]{0,80}\.then\(\(\) => undefined, \(\) => undefined\)/);
    expect(code("components/elite/JoinForm.tsx")).toContain("src: source,");
    expect(read("supabase/migrations/078_my_drills_and_reminders.sql")).toContain("add column if not exists source text");
    expect(code("lib/elite/tracker-coach.ts")).toContain('.eq("source", SHARE_SOURCE)');
  });
});

// ---- 6. The daily pull ---------------------------------------------------

describe("quiet hours, New York", () => {
  const at = (h: number, m: number) => isQuietTime({ hour: h, minute: m });
  it("nothing from 9:30 PM to 7:00 AM", () => {
    expect(at(21, 29)).toBe(false);
    expect(at(21, 30)).toBe(true);
    expect(at(23, 59)).toBe(true);
    expect(at(0, 0)).toBe(true);
    expect(at(6, 59)).toBe(true);
    expect(at(7, 0)).toBe(false);
    expect(at(12, 0)).toBe(false);
  });
  it("reads the New York clock, summer and winter", () => {
    expect(nyClock(new Date("2026-11-22T02:45:00Z"))).toEqual({ hour: 21, minute: 45 }); // EST
    expect(nyClock(new Date("2026-07-01T11:05:00Z"))).toEqual({ hour: 7, minute: 5 }); // EDT
  });
});

describe("a friend just posted", () => {
  const base = {
    posterId: "diego",
    friends: ["ana", "ben", "cam", "dee", "diego"],
    blocks: [] as { blocker: string; blocked: string }[],
    withDevice: new Set(["ana", "ben", "cam", "dee"]),
    postedToday: new Set<string>(),
  };
  it("goes to accepted friends with notifications on", () => {
    expect(friendPostReceivers(base)).toEqual(["ana", "ben", "cam", "dee"]);
    expect(friendPostReceivers({ ...base, withDevice: new Set(["ana"]) })).toEqual(["ana"]);
  });
  it("never across a block, either way", () => {
    expect(
      friendPostReceivers({
        ...base,
        blocks: [
          { blocker: "diego", blocked: "ana" },
          { blocker: "ben", blocked: "diego" },
        ],
      })
    ).toEqual(["cam", "dee"]);
  });
  it("not to someone who has already posted today", () => {
    expect(friendPostReceivers({ ...base, postedToday: new Set(["cam"]) })).toEqual(["ana", "ben", "dee"]);
  });
  it("one a day: every friend's post that day claims the same key", () => {
    const a = noticeKey("friend_post", { today: "2026-11-22", postId: "p1" });
    const b = noticeKey("friend_post", { today: "2026-11-22", postId: "p2" });
    expect(a).toEqual(b);
    expect(a).toEqual({ kind: "friend_post", ny_date: "2026-11-22", ref: "" });
  });
  it("only friends: the sender reads the poster's own friend pairs and blocks", () => {
    const src = code("lib/elite/free-notices-server.ts");
    expect(src).toContain("friendIdsOf(admin, posterId)");
    expect(src).toContain("blocksWith(admin, posterId, friends)");
    expect(src.indexOf("claim(admin, id, \"friend_post\"")).toBeLessThan(src.indexOf("notifyProfile(id, friendPostNotice({ first, nyDate: today }))"));
    expect(code("app/api/elite/tracker/post/route.ts")).toContain("noticeFriendPost(viewer.profile.id, today)");
  });
});

describe("props", () => {
  it("one per post, whatever day the props come", () => {
    expect(noticeKey("props", { today: "2026-11-24", postId: "p1", postDay: "2026-11-22" })).toEqual({
      kind: "props",
      ny_date: "2026-11-22",
      ref: "p1",
    });
  });
  it("three a day at most", () => {
    expect(PROPS_NOTICES_PER_DAY).toBe(3);
    expect(propsWithinDay(1)).toBe(true);
    expect(propsWithinDay(3)).toBe(true);
    expect(propsWithinDay(4)).toBe(false);
  });
  it("claimed before it is counted and sent, only when props are given", () => {
    const src = code("lib/elite/free-notices-server.ts");
    const claimAt = src.indexOf('claim(admin, input.ownerId, "props"');
    expect(claimAt).toBeGreaterThan(-1);
    expect(src.indexOf("propsWithinDay(")).toBeGreaterThan(claimAt);
    expect(src.indexOf("notifyProfile(input.ownerId, propsNotice({ first, postId: input.postId }))")).toBeGreaterThan(claimAt);
    expect(code("lib/elite/tracker-actions.ts")).toMatch(/if \(!had\) \{\s*await noticeProps\(/);
  });
  it("uses the friend's first name", () => {
    expect(noticeName("Diego R.")).toBe("Diego");
    expect(noticeName("  ")).toBe("A friend");
  });
});

describe("the words", () => {
  it("say what happened, no emoji, no exclamation mark", () => {
    const posted = friendPostNotice({ first: "Diego", nyDate: "2026-11-24" });
    const props = propsNotice({ first: "Diego", postId: "post-1" });
    // "Post yours to see it." was an instruction; it says what happens instead
    expect({ title: posted.title, body: posted.body, path: posted.path }).toEqual({
      title: "Diego just posted",
      body: "Their post opens when you post yours today.",
      path: "/log",
    });
    expect({ title: props.title, body: props.body, path: props.path }).toEqual({
      title: "Diego gave you props",
      body: "On your training post.",
      path: "/log",
    });
    for (const n of [posted, props]) {
      expect(noticeProblems(n)).toEqual([]);
      // a free account has no bell: the phone is the only place it shows
      expect([n.push, n.bell]).toEqual([true, false]);
      expect(n.topic).toBe("friends");
    }
  });
  it("every profile push takes its words from the list", () => {
    const src = code("lib/elite/free-notices-server.ts");
    // through the one sender (lib/elite/notify.ts), never the push layer itself
    expect(src).not.toMatch(/sendPushToProfile\(/);
    expect((src.match(/notifyProfile\(/g) ?? []).length).toBe(3);
    expect(src).toContain("friendPostNotice({ first, nyDate: today })");
    expect(src).toContain("propsNotice({ first, postId: input.postId })");
    // the one about clubs (087): its words are the list's too
    expect(src).toContain("const notice = clubPlanNotice({");
    expect(src).toContain("notifyProfile(r.profileId, notice)");
  });
});

describe("free accounts can turn notifications on", () => {
  it("their devices are on file by profile, a member's rows unchanged", () => {
    const sql = read("supabase/migrations/078_my_drills_and_reminders.sql");
    expect(sql).toMatch(/elite_push_subscriptions\s+add column if not exists profile_id uuid references public\.elite_profiles\(id\) on delete cascade/);
    expect(sql).toContain("check (num_nonnulls(player_id, profile_id) = 1)");
    expect(sql).toContain("on public.elite_push_subscriptions (profile_id, endpoint)");
    expect(sql).toMatch(/create table if not exists public\.elite_free_notices[\s\S]*primary key \(profile_id, kind, ny_date, ref\)/);
    expect(code("app/api/elite/push/subscribe/route.ts")).toContain('onConflict: "profile_id,endpoint"');
    expect(code("app/api/elite/push/native/route.ts")).toContain("profile_id: free ? viewer.profile.id : null");
    // the coach's count of members with push leaves free devices out
    expect(code("lib/elite/push.ts")).toContain(".filter((s) => s.player_id)");
  });

  it("asked once, right after a post, in the free app's words", () => {
    const composer = code("components/elite/PostComposer.tsx");
    expect(composer).toContain("useNotificationsAsk(Boolean(photo) && !isVideo)");
    expect(composer).toContain('<PushOptIn ask={ask} variant="free"');
    expect(read("components/elite/PushOptIn.tsx")).toContain("Know the moment your friends post?");
  });

  it("a switch in Settings", () => {
    expect(code("components/elite/FreeSettings.tsx")).toContain('<DeviceSettings showNotifications variant="free" />');
  });
});
