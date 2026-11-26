import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ADD_ALREADY,
  ADD_BODY,
  ADD_DAY_FULL,
  ADD_EMPTY,
  ADD_FIELD,
  ADD_MY_CODE,
  ADD_MY_CODE_DETAIL,
  ADD_NOT_FOUND,
  ADD_OFFLINE,
  ADD_ROW,
  ADD_SELF,
  ADD_SEND,
  ADD_TRIES_PER_DAY,
  ADD_TRIES_PER_MINUTE,
  ADD_WAITING,
  MY_CODE_BODY,
  MY_CODE_SAID,
  MY_CODE_SEND,
  MY_CODE_TITLE,
  friendAddAnswer,
  myCodeLine,
  usernameToFind,
  type FriendAddFacts,
  type RequestResult,
} from "@/lib/elite/friend-add";
import {
  INVITE_NOT_NOW,
  INVITE_NOT_ONE,
  INVITE_ROUTE,
  inviteAsTyped,
  inviteClubButton,
  inviteFriendButton,
  inviteFriendTitle,
  inviteFromLink,
  inviteFromParams,
  inviteRoute,
  routeForLink,
} from "@/lib/elite/friend-link";
import { APP_DOMAIN, APP_LINK_PATHS, APP_SCHEME, IOS_APP_ID } from "@/lib/elite/app-identity";
import { DOOR_OWN_CODE, doorCodeFrom, friendShareText } from "@/lib/elite/free-door";
import { FRIEND_REQUESTS_FULL_MESSAGE, clubLink, joinLink, requestSentLine } from "@/lib/elite/tracker";

// ADD A FRIEND IN PERSON (Nov 26 2026), in the iPhone app: by their exact
// @username, by showing your own QR code, and an invite link that opens
// the app. What is held here is that none of it loosens who can become a
// friend:
//   - a username is looked up EXACTLY, the answer is one line and never a
//     list, and "nobody has that name" cannot be told from "that player
//     blocked you" or "that player took you off"
//   - the request goes through the one function every request goes through
//   - the QR code holds the invite link and nothing else
//   - the site hands the app the invite page only, to the same app the
//     phone's build names
//   - a link is read by one pure rule, moves nobody past a gate, and never
//     sends a request without a tap

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
// code only: a rule explained in a comment is not a use of the thing
const code = (p: string) =>
  read(p)
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("{/*"))
    .join("\n");
const APP = "https://thestriveapp.com";

// ---- the server, with its lookups stood in for ----------------------------

type Account = { id: string; full_name: string };
const s = {
  accounts: {} as Record<string, Account | "offline">,
  inFreeApp: new Set<string>(),
  facts: { removed: false, waiting: false } as { removed: boolean; waiting: boolean } | null,
  result: "sent" as RequestResult,
  calls: [] as { fn: string; args: unknown[] }[],
  clubs: {} as Record<string, { id: string; name: string; kind: string; archived_at: string | null }>,
  codes: {} as Record<string, { first: string; initials: string }>,
};

vi.mock("@/lib/elite/supabase/server", () => ({ createServiceClient: () => ({}), isSupabaseConfigured: () => true }));
vi.mock("@/lib/elite/account-profile-server", () => ({
  accountByUsername: async (_admin: unknown, name: string) => {
    s.calls.push({ fn: "accountByUsername", args: [name] });
    return s.accounts[name] ?? null;
  },
}));
vi.mock("@/lib/elite/tracker-server", () => ({
  getTracker: async (id: string) => (s.inFreeApp.has(id) ? { profile_id: id } : null),
  friendAskFacts: async (...args: unknown[]) => (s.calls.push({ fn: "friendAskFacts", args }), s.facts),
  requestFriend: async (...args: unknown[]) => (s.calls.push({ fn: "requestFriend", args }), s.result),
  clubByCode: async (_admin: unknown, c: string) => s.clubs[c] ?? null,
  inviteLandingFor: async (ref: string | null) => (ref && s.codes[ref] ? { kind: "friend", ...s.codes[ref] } : null),
}));

const me = (username: string | null = "marcus.b") =>
  ({
    profile: { id: "me", role: "player", full_name: "Marcus Bryant", email: "m@example.com", avatar_color: "#000" },
    role: "player",
    playerId: null,
    demo: false,
    setup: { available: true, username, hasPhoto: true, photoKey: "k" },
  }) as never;

async function ask(raw: unknown, viewer = me()) {
  const { askFriendByUsername } = await import("@/lib/elite/friend-add-server");
  return askFriendByUsername(viewer, raw);
}
const asked = () => s.calls.filter((c) => c.fn === "requestFriend");

beforeEach(() => {
  s.accounts = { "kai.m": { id: "kai", full_name: "Kai Morales" } };
  s.inFreeApp = new Set(["kai"]);
  s.facts = { removed: false, waiting: false };
  s.result = "sent";
  s.calls = [];
  s.clubs = { WXYZ6789: { id: "c1", name: "Sunday Pickup", kind: "player", archived_at: null } };
  s.codes = { ABCD2345: { first: "Kai", initials: "KM" } };
});

describe("the username that is looked up", () => {
  it("is exactly what was typed: the @ is optional and capitals do not matter", () => {
    expect(usernameToFind("kai.m")).toBe("kai.m");
    expect(usernameToFind("@Kai.M")).toBe("kai.m");
    expect(usernameToFind("  @kai_m9  ")).toBe("kai_m9");
  });

  it("is never part of a name and never a pattern", () => {
    for (const raw of ["", "  ", "@", "ka", "kai%", "kai*", "ka?", "%", "k_", "kai m", "kai,nico", "kai\nnico", "a".repeat(21), null, undefined, 7, {}, ["kai.m"]]) {
      expect(usernameToFind(raw), String(raw)).toBeNull();
    }
  });

  it("the database is asked with an equals, never a like, and for one row's worth", () => {
    const src = code("lib/elite/account-profile-server.ts");
    const fn = src.slice(src.indexOf("export async function accountByUsername("), src.indexOf("function escapeLike("));
    expect(fn).toContain('.eq("username", exact)');
    expect(fn).not.toMatch(/ilike|\.like\(|textSearch|\.or\(/);
    // one account or none: two rows would be nobody
    expect(fn).toContain("rows.length === 1");
    expect(fn).not.toMatch(/\.map\(|\.filter\(/);
  });
});

describe("what a player is told", () => {
  const found = (over: Partial<Extract<FriendAddFacts, { found: true }>>): FriendAddFacts => ({
    found: true,
    self: false,
    name: "Kai M.",
    removedBefore: false,
    waitingBefore: false,
    result: "sent",
    ...over,
  });

  it("a request that went says so, with the name the server chose to show", () => {
    expect(friendAddAnswer(found({}))).toEqual({ ok: true, result: "sent", line: "Request sent. You and Kai M. are friends once Kai M. accepts." });
    expect(friendAddAnswer(found({})).ok && requestSentLine("Kai M.")).toBe("Request sent. You and Kai M. are friends once Kai M. accepts.");
    // each had asked the other: both wanted it
    expect(friendAddAnswer(found({ result: "friends" }))).toEqual({ ok: true, result: "friends", line: "You and Kai M. are friends." });
  });

  it("nobody has that name, a block either way and a player who took you off are ONE line", () => {
    const lines = [
      friendAddAnswer({ found: false }),
      friendAddAnswer(found({ result: "blocked" })),
      friendAddAnswer(found({ removedBefore: true, result: "sent" })),
      // taken off AND a block: still the same
      friendAddAnswer(found({ removedBefore: true, result: "blocked" })),
    ];
    for (const l of lines) expect(l).toEqual({ ok: false, error: ADD_NOT_FOUND });
    expect(ADD_NOT_FOUND).toBe("We could not find that @username. Check the spelling.");
  });

  it("your own, a friend you have, and a request still waiting each have their own line", () => {
    expect(friendAddAnswer(found({ self: true, result: null }))).toEqual({ ok: false, error: "That is your own @username." });
    expect(friendAddAnswer(found({ result: "already" }))).toEqual({ ok: false, error: "You are already friends." });
    expect(friendAddAnswer(found({ waitingBefore: true, result: "sent" }))).toEqual({ ok: false, error: "You already asked. They have not answered yet." });
    // 30 waiting, and this one is among them
    expect(friendAddAnswer(found({ waitingBefore: true, result: "too_many" }))).toEqual({ ok: false, error: ADD_WAITING });
  });

  it("30 requests waiting is the wording every request already uses", () => {
    expect(friendAddAnswer(found({ result: "too_many" }))).toEqual({ ok: false, error: FRIEND_REQUESTS_FULL_MESSAGE });
    expect(friendAddAnswer(found({ result: "error" }))).toEqual({ ok: false, error: ADD_OFFLINE });
    expect(friendAddAnswer(found({ result: null }))).toEqual({ ok: false, error: ADD_OFFLINE });
  });

  it("the words are short, plain, and say the whole thing", () => {
    const lines = [
      ADD_ROW, ADD_BODY, ADD_FIELD, ADD_SEND, ADD_EMPTY, ADD_NOT_FOUND, ADD_SELF, ADD_ALREADY, ADD_WAITING, ADD_DAY_FULL, ADD_OFFLINE, ADD_MY_CODE,
      ADD_MY_CODE_DETAIL, MY_CODE_TITLE, MY_CODE_BODY, MY_CODE_SEND, MY_CODE_SAID, myCodeLine("ABCD2345"), INVITE_NOT_NOW, INVITE_NOT_ONE,
      inviteFriendTitle("Kai"), inviteFriendButton("Kai"), inviteClubButton("Sunday Pickup"),
    ];
    for (const line of lines) {
      expect(line, line).not.toMatch(/[—–]/);
      expect(line, line).not.toMatch(/\b(AI|automated|algorithm|invalid|error|search|discover|nearby|contacts|location)\b/i);
      expect(line.length, line).toBeLessThanOrEqual(120);
    }
    expect(ADD_FIELD).toBe("Their @username");
    expect(ADD_SEND).toBe("Send a friend request");
    expect(inviteFriendButton("Kai")).toBe("Send Kai a friend request");
    expect(inviteClubButton("Sunday Pickup")).toBe("Ask to join Sunday Pickup");
  });
});

describe("the server: one lookup, then the one request function", () => {
  it("a real username sends that player a request, from the signed-in player", async () => {
    expect(await ask("@Kai.M")).toEqual({ ok: true, result: "sent", line: requestSentLine("Kai M.") });
    expect(s.calls.find((c) => c.fn === "accountByUsername")?.args).toEqual(["kai.m"]);
    expect(asked()).toEqual([{ fn: "requestFriend", args: ["me", "kai"] }]);
    // what stands between them is read first, for the wording only
    const order = s.calls.map((c) => c.fn);
    expect(order.indexOf("friendAskFacts")).toBeLessThan(order.indexOf("requestFriend"));
  });

  it("a username nobody has, or one that cannot be a username, asks nothing of anyone", async () => {
    for (const raw of ["nobody.here", "ka", "kai%", "", null, 12]) {
      expect(await ask(raw), String(raw)).toEqual({ ok: false, error: ADD_NOT_FOUND });
    }
    expect(asked()).toEqual([]);
    // a name that cannot be one never reaches the database
    expect(s.calls.filter((c) => c.fn === "accountByUsername").map((c) => c.args[0])).toEqual(["nobody.here"]);
  });

  it("an account that is not in the free app reads as a username nobody has", async () => {
    s.accounts["coach.only"] = { id: "staff", full_name: "Somebody Else" };
    expect(await ask("coach.only")).toEqual({ ok: false, error: ADD_NOT_FOUND });
    expect(asked()).toEqual([]);
  });

  it("your own username is known without asking the database", async () => {
    expect(await ask("@MARCUS.B")).toEqual({ ok: false, error: ADD_SELF });
    expect(s.calls).toEqual([]);
    // and by the account, when the name on the session is stale
    s.accounts["marcus.new"] = { id: "me", full_name: "Marcus Bryant" };
    expect(await ask("marcus.new")).toEqual({ ok: false, error: ADD_SELF });
    expect(asked()).toEqual([]);
  });

  it("a block reads as not found, and so does a player who took the caller off", async () => {
    s.result = "blocked";
    expect(await ask("kai.m")).toEqual({ ok: false, error: ADD_NOT_FOUND });
    s.result = "sent"; // what the request function says to a player who was taken off (071)
    s.facts = { removed: true, waiting: false };
    expect(await ask("kai.m")).toEqual({ ok: false, error: ADD_NOT_FOUND });
    // the request function was still the one asked both times: it decides, and it stored nothing
    expect(asked()).toHaveLength(2);
  });

  it("already friends, already asked, and 30 waiting are the request function's own answers", async () => {
    s.result = "already";
    expect(await ask("kai.m")).toEqual({ ok: false, error: ADD_ALREADY });
    s.result = "sent";
    s.facts = { removed: false, waiting: true };
    expect(await ask("kai.m")).toEqual({ ok: false, error: ADD_WAITING });
    s.facts = { removed: false, waiting: false };
    s.result = "too_many";
    expect(await ask("kai.m")).toEqual({ ok: false, error: FRIEND_REQUESTS_FULL_MESSAGE });
    s.result = "friends";
    expect(await ask("kai.m")).toEqual({ ok: true, result: "friends", line: "You and Kai M. are friends." });
  });

  it("when something cannot be read, nothing is sent and nothing is claimed", async () => {
    s.accounts["kai.m"] = "offline";
    expect(await ask("kai.m")).toEqual({ ok: false, error: ADD_OFFLINE });
    s.accounts["kai.m"] = { id: "kai", full_name: "Kai Morales" };
    s.facts = null;
    expect(await ask("kai.m")).toEqual({ ok: false, error: ADD_OFFLINE });
    expect(asked()).toEqual([]);
  });

  it("it is not a second way to make a request: no table of its own, no pair, one call", () => {
    const server = code("lib/elite/friend-add-server.ts");
    expect(server.match(/requestFriend\(/g)).toHaveLength(1);
    expect(server).toContain("await requestFriend(me, other.id)");
    expect(server).not.toMatch(/\.from\(|makeFriends|\.insert\(|\.upsert\(|\.update\(|\.delete\(|elite_/);
    // what it reads beforehand writes nothing
    const tracker = code("lib/elite/tracker-server.ts");
    const facts = tracker.slice(tracker.indexOf("export async function friendAskFacts("), tracker.indexOf("export type FriendRequestView"));
    expect(facts).toContain('.from("elite_tracker_unfriends")');
    expect(facts).toContain('.from("elite_tracker_friend_requests")');
    expect(facts).not.toMatch(/\.insert\(|\.upsert\(|\.update\(|\.delete\(|makeFriends/);
    // and the request function itself is untouched by this: tests/friend-requests.test.ts
    expect(tracker).toContain('export type FriendRequestResult = "sent" | "friends" | "already" | "blocked" | "too_many" | "error";');
  });

  it("only the app's own routes call it, after their gate and their limits", () => {
    const walk = (dir: string): string[] =>
      readdirSync(join(root, dir)).flatMap((n) => {
        const p = `${dir}/${n}`;
        return statSync(join(root, p)).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    const users = ["app", "lib", "components"].flatMap(walk).filter((f) => /from ["'][^"']*friend-add-server["']/.test(read(f)));
    expect(users.sort()).toEqual(["app/api/app/free/code/route.ts", "app/api/app/free/friend/ask/route.ts"]);
    const route = code("app/api/app/free/friend/ask/route.ts");
    expect(route).toMatch(/appRoute\(\{ name: "free-friend-ask", access: "free_app", limit: ADD_TRIES_PER_MINUTE \}/);
    expect(route).toContain("ADD_TRIES_PER_DAY, DAY_MS)");
    // the day's count is the caller's own, taken from the token, and a try that matched nobody counts
    expect(route).toContain("${viewer.profile.id}");
    expect(route.indexOf("rateLimit(")).toBeLessThan(route.indexOf("askFriendByUsername(viewer"));
    expect(route).not.toMatch(/createServiceClient|\.from\(/);
    expect(ADD_TRIES_PER_MINUTE).toBe(10);
    expect(ADD_TRIES_PER_DAY).toBe(30);
  });
});

describe("my code", () => {
  const screen = code("mobile/app/friend/code.tsx");

  it("the QR code holds the player's own invite link, the one Send my link shares", () => {
    expect(screen).toContain("<QrCode text={y.invite} size={side} said={MY_CODE_SAID} />");
    // what the server sends as `invite` is the join link with their own code
    const server = code("lib/elite/free-app-server.ts");
    const you = server.slice(server.indexOf("export async function freeYouFor("), server.indexOf("export async function appProfileFor("));
    expect(you).toContain("invite: joinLink(APP_URL, tracker.referral_code)");
    // and that link, read back by a camera, is the same code as a teammate's
    const link = joinLink(APP, "ABCD2345");
    expect(link).toBe("https://thestriveapp.com/join?ref=ABCD2345");
    expect(inviteFromLink(link)).toEqual({ code: "ABCD2345", kind: "friend" });
    // the letters under the picture are read out of the same link
    expect(screen).toContain("doorCodeFrom(y.invite)?.code");
    expect(doorCodeFrom(link)?.code).toBe("ABCD2345");
    expect(myCodeLine("ABCD2345")).toBe("My code: ABCD2345");
    expect(friendShareText({ code: "ABCD2345", link })).toContain(link);
  });

  it("is drawn dark on white with its margin, on the phone, and nothing else is in it", () => {
    const qr = code("mobile/src/QrCode.tsx");
    expect(qr).toContain('<Rect x={0} y={0} width={grid} height={grid} fill="#ffffff" />');
    expect(qr).toContain('<Path d={d} fill="#000000" />');
    expect(qr).toContain("accessibilityLabel={said}");
    expect(qr).not.toMatch(/gold|<Image|uri:/);
    const maker = code("mobile/src/qr.ts");
    expect(maker).toContain('import qrcode from "qrcode-generator";');
    expect(maker).toContain("export const QUIET_ZONE = 4;");
    // made on the phone: no picture is fetched and the link is sent nowhere
    for (const f of ["mobile/src/qr.ts", "mobile/src/QrCode.tsx"]) expect(code(f), f).not.toMatch(/fetch\(|@\/api\/|https?:\/\//);
    // one plain-JavaScript package, pinned, and the app has no scanner (no camera library was added)
    const pkg = JSON.parse(read("mobile/package.json")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["qrcode-generator"]).toBe("2.0.4");
    expect(Object.keys(pkg.dependencies).filter((n) => /camera|barcode|scanner|contacts|location/i.test(n))).toEqual([]);
  });

  it("shows whose it is and has the one button, with no way to look anyone up", () => {
    expect(screen).toContain("@{username}");
    expect(screen).toContain("myCodeLine(code)");
    expect(screen).toContain("Share.share(inviteShare(y))");
    expect(screen.match(/<Button\b/g)?.length).toBe(2); // Send my link, and Try again when it cannot be read
    expect(screen).not.toMatch(/<TextInput|askFriend|useInvite/);
  });
});

describe("the site hands the app the invite page, and nothing else", () => {
  const app = JSON.parse(read("mobile/app.json")).expo as { scheme: string; ios: { bundleIdentifier: string; associatedDomains: string[] } };

  it("applinks for /join only, to the same app the phone's build names", async () => {
    const { GET } = await import("@/app/.well-known/apple-app-site-association/route");
    const file = (await GET().json()) as {
      applinks: { details: { appIDs: string[]; components: Record<string, unknown>[] }[] };
      webcredentials: { apps: string[] };
    };
    expect(file.applinks.details).toHaveLength(1);
    expect(file.applinks.details[0].appIDs).toEqual(["LPZWVS6D54.com.strivesoccer.elite"]);
    expect(file.applinks.details[0].appIDs).toEqual([IOS_APP_ID]);
    expect(file.applinks.details[0].components).toEqual([{ "/": "/join" }, { "/": "/join/*" }]);
    expect([...APP_LINK_PATHS]).toEqual(["/join", "/join/*"]);
    // saved passwords are as they were
    expect(file.webcredentials).toEqual({ apps: [IOS_APP_ID] });
    expect(Object.keys(file).sort()).toEqual(["applinks", "webcredentials"]);
    // the phone's half
    expect(IOS_APP_ID.endsWith(`.${app.ios.bundleIdentifier}`)).toBe(true);
    expect(app.ios.associatedDomains).toEqual([`webcredentials:${APP_DOMAIN}`, `applinks:${APP_DOMAIN}`]);
    expect(app.scheme).toBe(APP_SCHEME);
  });

  it("the page the link opens with no app installed is still the website's own", () => {
    expect(existsSync(join(root, "app/(join)/join/page.tsx"))).toBe(true);
    // and the website's page reads the same two codes
    const page = code("app/(join)/join/page.tsx");
    expect(page).toContain("cleanReferralCode(searchParams?.ref)");
    expect(page).toContain("cleanClubCode(searchParams?.club)");
  });
});

describe("what a link is, to the app", () => {
  it("a teammate's link and a club's link become the one screen that asks", () => {
    expect(inviteFromLink(joinLink(APP, "ABCD2345"))).toEqual({ code: "ABCD2345", kind: "friend" });
    expect(inviteFromLink(clubLink(APP, "WXYZ6789"))).toEqual({ code: "WXYZ6789", kind: "club" });
    expect(routeForLink(joinLink(APP, "ABCD2345"))).toBe("/friend/link?code=ABCD2345&kind=friend");
    expect(routeForLink(clubLink(APP, "WXYZ6789"))).toBe("/friend/link?code=WXYZ6789&kind=club");
    expect(inviteRoute({ code: "ABCD2345", kind: "friend" }).startsWith(INVITE_ROUTE)).toBe(true);
  });

  it("however the phone hands it over", () => {
    const friend = { code: "ABCD2345", kind: "friend" };
    for (const link of [
      "https://thestriveapp.com/join?ref=ABCD2345",
      "https://www.thestriveapp.com/join?ref=abcd2345",
      "HTTPS://THESTRIVEAPP.COM/join?ref=ABCD2345",
      "https://thestriveapp.com/join/?ref=ABCD2345",
      "https://thestriveapp.com/join?src=share&ref=ABCD2345#top",
      "https://thestriveapp.com/join?web=1&ref=ABCD2345",
      "/join?ref=ABCD2345",
      "join?ref=ABCD2345",
      "striveelite://join?ref=ABCD2345",
      "striveelite:///join?ref=ABCD2345",
      "  https://thestriveapp.com/join?ref=ABCD2345  ",
    ]) {
      expect(inviteFromLink(link), link).toEqual(friend);
    }
    // a link with both is the club's, as at the door
    expect(inviteFromLink("https://thestriveapp.com/join?ref=ABCD2345&club=WXYZ6789")).toEqual({ code: "WXYZ6789", kind: "club" });
  });

  it("anything else is not an invite, and opens home", () => {
    for (const link of [
      "garbage",
      "",
      "   ",
      "striveelite:///",
      "striveelite://settings",
      "/",
      "https://thestriveapp.com/",
      "https://thestriveapp.com/join",
      "https://thestriveapp.com/join?w=ABCD2345",
      "https://thestriveapp.com/join/extra?ref=ABCD2345",
      "https://thestriveapp.com/log?friend=ABCD2345",
      "https://thestriveapp.com/pro?ref=ABCD2345",
      "https://thestriveapp.com/settings",
      // a code that is not 8 letters and digits
      "https://thestriveapp.com/join?ref=ABCD234",
      "https://thestriveapp.com/join?ref=ABCD23456",
      "https://thestriveapp.com/join?ref=ABCD-234",
      "https://thestriveapp.com/join?ref=O0I1O0I1",
      "https://thestriveapp.com/join?club=",
      "https://thestriveapp.com/join?ref=%E0%A4%A",
      // somebody else's site, however it is dressed
      "https://evil.example/join?ref=ABCD2345",
      "https://thestriveapp.com.evil.example/join?ref=ABCD2345",
      "https://thestriveapp.com@evil.example/join?ref=ABCD2345",
      "https://evil.example/?https://thestriveapp.com/join?ref=ABCD2345",
      "//evil.example/join?ref=ABCD2345",
      "otherapp://join?ref=ABCD2345",
      "javascript:alert(1)//join?ref=ABCD2345",
      "https://thestriveapp.com/join?ref=ABCD2345".padEnd(601, "x"),
    ]) {
      expect(inviteFromLink(link), link).toBeNull();
      expect(routeForLink(link), link).toBe("/");
    }
    for (const raw of [null, undefined, 12, {}, ["https://thestriveapp.com/join?ref=ABCD2345"]]) {
      expect(inviteFromLink(raw)).toBeNull();
      expect(routeForLink(raw)).toBe("/");
    }
  });

  it("the screen reads its own address the same strict way", () => {
    expect(inviteFromParams({ code: "abcd2345", kind: "friend" })).toEqual({ code: "ABCD2345", kind: "friend" });
    expect(inviteFromParams({ code: "WXYZ6789", kind: "club" })).toEqual({ code: "WXYZ6789", kind: "club" });
    expect(inviteFromParams({ code: ["ABCD2345"], kind: ["club"] })).toEqual({ code: "ABCD2345", kind: "club" });
    // no word of whose it is: the server tries a club's, then a teammate's
    expect(inviteFromParams({ code: "ABCD2345" })).toEqual({ code: "ABCD2345", kind: null });
    expect(inviteFromParams({ code: "ABCD2345", kind: "admin" })).toEqual({ code: "ABCD2345", kind: null });
    for (const bad of [{}, { code: "" }, { code: "ABCD234" }, { code: 12345678 }, { code: "../../x" }, { kind: "friend" }]) {
      expect(inviteFromParams(bad)).toBeNull();
    }
  });

  it("the button hands the door the invite as the door already reads one", () => {
    expect(doorCodeFrom(inviteAsTyped({ code: "ABCD2345", kind: "friend" }))).toEqual({ code: "ABCD2345", kind: "friend" });
    expect(doorCodeFrom(inviteAsTyped({ code: "WXYZ6789", kind: "club" }))).toEqual({ code: "WXYZ6789", kind: "club" });
    expect(doorCodeFrom(inviteAsTyped({ code: "ABCD2345", kind: null }))).toEqual({ code: "ABCD2345", kind: null });
  });
});

describe("who an invite is from, before anything is sent", () => {
  const mine = { profile_id: "me", referral_code: "MYCD2345" } as never;
  const who = async (asked: { code: string; kind: "friend" | "club" | null }) => (await import("@/lib/elite/friend-add-server")).inviteFor(mine, asked);

  it("a teammate is a first name and initials, as the website shows a visitor, and nothing more", async () => {
    const res = await who({ code: "ABCD2345", kind: "friend" });
    expect(res).toEqual({ ok: true, kind: "friend", code: "ABCD2345", first: "Kai", initials: "KM", body: "When Kai accepts, you see each other's training and the photos you post." });
    expect(Object.keys(res).sort()).toEqual(["body", "code", "first", "initials", "kind", "ok"]);
    const server = code("lib/elite/friend-add-server.ts");
    const fn = server.slice(server.indexOf("export async function inviteFor("));
    expect(fn).toContain("inviteLandingFor(asked.code, null)");
    expect(fn).not.toMatch(/photo|avatar|username|full_name|shortName/i);
  });

  it("a club is its name; a code with no word of whose it is tries the club first, as the door does", async () => {
    expect(await who({ code: "WXYZ6789", kind: "club" })).toEqual({
      ok: true,
      kind: "club",
      code: "WXYZ6789",
      id: "c1",
      name: "Sunday Pickup",
      body: "The club's captain lets you in. Then you become friends with everyone in the club, and the club shows on your profile.",
    });
    expect((await who({ code: "WXYZ6789", kind: null })).ok && (await who({ code: "WXYZ6789", kind: null }))).toMatchObject({ kind: "club" });
    expect(await who({ code: "ABCD2345", kind: null })).toMatchObject({ ok: true, kind: "friend", first: "Kai" });
  });

  it("your own code, a club that ended and a code nobody has are said plainly", async () => {
    expect(await who({ code: "MYCD2345", kind: "friend" })).toEqual({ ok: false, error: DOOR_OWN_CODE });
    s.clubs.WXYZ6789.archived_at = "2026-11-01T00:00:00Z";
    expect(await who({ code: "WXYZ6789", kind: "club" })).toEqual({ ok: false, error: INVITE_NOT_ONE });
    expect(await who({ code: "ZZZZ9999", kind: null })).toEqual({ ok: false, error: INVITE_NOT_ONE });
    // a teammate's code asked for as a club's is not looked up as a teammate's
    expect(await who({ code: "ABCD2345", kind: "club" })).toEqual({ ok: false, error: INVITE_NOT_ONE });
  });

  it("the route only reads; the request is the door's own route, on the tap", () => {
    const route = code("app/api/app/free/code/route.ts");
    const get = route.slice(route.indexOf("export const GET"), route.indexOf("export const POST"));
    expect(get).toMatch(/appRoute\(\{ name: "free-code-who", access: "free_app", limit: 30 \}/);
    expect(get).toContain("inviteFor(tracker, asked)");
    expect(get).not.toMatch(/enterDoorCode|confirmFriend|requestFriend|askToJoin/);
  });
});

describe("a link never sends a request, and never moves anyone past a gate", () => {
  const intent = code("mobile/app/+native-intent.ts");
  const opener = code("mobile/src/InviteOpener.tsx");
  const store = code("mobile/src/invite.ts");
  const screen = code("mobile/app/friend/link.tsx");

  it("the link is read by the one shared rule, kept, and the app opens where it always does", () => {
    expect(intent).toContain('import { inviteFromLink } from "@shared/friend-link";');
    expect(intent).toContain("const invite = inviteFromLink(path);");
    expect(intent).toContain("if (invite) holdInvite(invite);");
    // home when the link started the app, nothing moves when it was open: never the invite's screen itself
    expect(intent.match(/return [^;]+;/g)).toEqual(['return initial ? "/" : null;']);
    // it cannot throw, and it calls nothing but the pure rule and the keeper
    expect(intent).toMatch(/try \{[\s\S]*\} catch \{/);
    expect(intent).not.toMatch(/@\/api\/|fetch\(|router\.|enterCode|sendInvite|askFriend/);
    expect(store).not.toMatch(/@\/api\/|fetch\(|AsyncStorage|SecureStore/);
  });

  it("the screen that asks is opened only for a player inside the free app", () => {
    expect(opener).toContain('const inside = area === "free" && inArea(area, segments, hasTrain(state));');
    expect(opener).toContain("if (!held || !inside) return;");
    expect(opener).toContain("router.navigate(inviteRoute(invite) as Href)");
    // opening it sends nothing
    expect(opener).not.toMatch(/@\/api\/free|enterCode|sendInvite|askFriend|api</);
    // it is mounted once, beside the gatekeeper
    expect(code("mobile/app/_layout.tsx").match(/<InviteOpener \/>/g)).toHaveLength(1);
    // and the gatekeeper knows the screens it opens
    expect(code("mobile/src/navigation.ts")).toMatch(/const FREE_ROUTES = new Set\(\[[^\]]*"friend"[^\]]*\]\)/);
  });

  it("the request is made by the tap on the one button, and by nothing else", () => {
    // no effect on the screen at all: nothing runs because it opened
    expect(screen).not.toMatch(/useEffect|useLayoutEffect|useFocusEffect/);
    // the one send, inside the function the button calls
    expect(screen.match(/sendInvite\(/g)).toHaveLength(1);
    const send = screen.slice(screen.indexOf("async function send()"), screen.indexOf("// what the server said"));
    expect(send).toContain("await sendInvite(");
    expect(screen.match(/\bsend\(\)/g)).toEqual(["send()", "send()"]); // its definition, and the button's onPress
    expect(screen).toContain("onPress={() => void send()}");
    // what runs on opening is a read of who it is from
    expect(screen).toContain("const q = useInvite(asked);");
    const api = code("mobile/src/api/free.ts");
    const reader = api.slice(api.indexOf("export function useInvite("), api.indexOf("export const sendInvite"));
    expect(reader).toContain("api<AppInvite>(`${APP_API.freeCode}?code=");
    expect(reader).not.toMatch(/method: "POST"/);
    expect(api).toContain("export const sendInvite = (asked: AskedInvite) => enterCode(inviteAsTyped(asked));");
    // one way on and one way out, and nobody is shown by a photo
    expect(screen).toContain("label={INVITE_NOT_NOW}");
    expect(screen).toContain("<Avatar initials={invite.initials} size={88} />");
    expect(screen).not.toMatch(/uri=|photo/i);
  });

  it("a new player keeps the code: the door finds it already typed, and still has to tap", () => {
    const door = code("mobile/src/CodeDoor.tsx");
    expect(door).toContain('useState(() => heldInvite()?.code ?? "")');
    expect(door).toContain("if (held) setCode((typed) => (typed.trim() ? typed : held.code));");
    // used or turned down, it is not brought up again
    expect(door.match(/dropInvite\(\);/g)).toHaveLength(2);
    // the door's effect types the code in; it does not send it
    const effect = door.slice(door.indexOf("useEffect("), door.indexOf("function noCode()"));
    expect(effect).not.toMatch(/enterCode|use\(\)/);
  });

  it("a player already in the free app who opens a teammate's link is adding a friend, not being brought in", () => {
    const door = code("lib/elite/free-door-server.ts");
    expect(door).toContain("const fresh = !input.intake?.answers && !input.tracker.quiz_done_at && input.intake?.later !== true;");
  });
});

describe("in the app", () => {
  it("Add a friend is one quiet row under the invite on Friends, and My code is beside the invite on You", () => {
    const friends = code("mobile/app/(free)/friends.tsx");
    expect(friends.match(/router\.push\("\/friend\/add"\)/g)).toHaveLength(1);
    expect(friends).toContain("accessibilityLabel={ADD_ROW}");
    // under the squad card and the invite, never above the feed
    expect(friends.indexOf('router.push("/friend/add")')).toBeGreaterThan(friends.indexOf("<SquadCard"));
    const you = code("mobile/app/(free)/me.tsx");
    expect(you).toContain('<SettingRow label={MY_CODE_TITLE} detail={ADD_MY_CODE_DETAIL} onPress={() => router.push("/friend/code")} />');
  });

  it("the typing screen sends one username and shows one line: no list, no suggestions", () => {
    const add = code("mobile/app/friend/add.tsx");
    expect(add).toContain("<FormScreen");
    expect(add).toContain("<LabeledField");
    expect(add).toContain("label={ADD_FIELD}");
    expect(add).toContain("const res = await askFriend(name);");
    expect(add.match(/askFriend\(/g)).toHaveLength(1);
    // nothing is asked while typing
    expect(add).not.toMatch(/useEffect|useQuery|onChangeText=\{[^}]*askFriend|FlatList|\.map\(/);
    // the button rides on the keyboard and is never switched off
    const typing = add.slice(add.lastIndexOf("<FormScreen"));
    const footer = typing.slice(typing.indexOf("footer={"), typing.indexOf("{back}"));
    expect(footer).toContain("label={ADD_SEND}");
    expect(footer).not.toMatch(/disabled/);
    expect(add).not.toMatch(/position:\s*"absolute"/);
    expect(add).not.toMatch(/backgroundColor:\s*color\.gold/);
    const api = code("mobile/src/api/free.ts");
    expect(api).toContain('api<FriendAddAnswer>(APP_API.freeFriendAsk, { method: "POST", body: { username } })');
  });

  it("the example data answers every new call", () => {
    const fx = code("mobile/src/api/fixtures.ts");
    expect(fx).toContain('if (at === "friend/ask") {');
    expect(fx).toContain('if (at.startsWith("code?")) {');
    // an invite opened by a player already in the free app moves nothing on the example account
    expect(fx).toMatch(/if \(l\.stage === "ready"\) \{\s*return typed\.kind === "club"/);
  });

  it("the simulator pictures the three screens and taps through two of them", () => {
    const shots = read("mobile/sim/shots.sh");
    expect(shots).toContain("60-add-friend|locked|friend/add|10");
    expect(shots).toContain("61-my-code|locked|friend/code|11");
    expect(shots).toContain("62-invite-link|locked|friend/link?code=EXAMPLE2|11");
    const flow = read("mobile/sim/flows/17-add-a-friend.yaml");
    expect(flow).toContain('tapOn: "Their @username"');
    expect(flow).toContain('inputText: "kai.m"');
    expect(flow).toContain(`visible: "${requestSentLine("Kai M.")}"`);
    expect(flow).toContain(`visible: "${MY_CODE_SAID}"`);
    expect(flow).toContain(`visible: "${ADD_NOT_FOUND}"`);
  });

  it("what only two phones can show is on the phone checklist", () => {
    const list = read("docs/app-store/native-device-checklist.md");
    expect(list).toContain("Adding a friend in person");
    for (const line of ["another iPhone's Camera", "a link in Messages", "with the app not installed", "the request arrives on the other phone"]) {
      expect(list.toLowerCase(), line).toContain(line.toLowerCase());
    }
  });
});
