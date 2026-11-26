import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ACTIVATED_RULE,
  CLUB_MIN_MEMBERS,
  CLUB_MIN_POSTED,
  TOO_EARLY,
  activatedLine,
  fmtCameBack,
  fmtTypical,
  launchNumbers,
  type LaunchAccount,
  type LaunchInput,
  type LaunchLog,
} from "@/lib/elite/launch-numbers";

// The launch numbers on the coach's free page (Nov 26 2026): is a new
// player getting going, overall and club by club. Counted from rows the
// app already stores, never estimated.

// Thursday Nov 26 2026, noon in New York. The week is Mon Nov 23 to Sun Nov 29.
const NOW = new Date("2026-11-26T17:00:00.000Z");
const HOUR = 3_600_000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR).toISOString();
// noon New York on a given date
const noon = (day: string) => `${day}T17:00:00.000Z`;

const account = (id: string, over: Partial<LaunchAccount> = {}): LaunchAccount => ({
  id,
  joinedAt: ago(24),
  hasPhoto: false,
  hasUsername: false,
  ...over,
});
const log = (profileId: string, day: string, over: Partial<LaunchLog> = {}): LaunchLog => ({
  profileId,
  day,
  at: noon(day),
  kind: "training",
  proof: "clock",
  ...over,
});
const input = (over: Partial<LaunchInput>): LaunchInput => ({
  accounts: [],
  logs: [],
  clubs: [],
  members: [],
  friendships: [],
  ...over,
});

describe("every new player", () => {
  it("counts who joined, set up, found a club and has three friends", () => {
    const n = launchNumbers(
      input({
        accounts: [
          account("a", { hasPhoto: true, hasUsername: true }),
          account("b", { hasPhoto: true }), // no username: not set up
          account("c", { hasUsername: true }), // no photo: not set up
          account("d"),
          account("e"),
        ],
        clubs: [
          { id: "k1", name: "Team 1", archived: false },
          { id: "k2", name: "Old club", archived: true },
        ],
        members: [
          { clubId: "k1", profileId: "a" },
          { clubId: "k1", profileId: "b" },
          { clubId: "k2", profileId: "c" }, // an ended club is no club
        ],
        friendships: [
          { a: "a", b: "b" },
          { a: "a", b: "c" },
          { a: "a", b: "d" }, // a has three
          { a: "b", b: "c" }, // b has two
          { a: "a", b: "gone" }, // not an account: not counted
        ],
      }),
      NOW
    ).allTime;
    expect(n.joined).toBe(5);
    expect(n.setUp).toEqual({ n: 1, of: 5 });
    expect(n.inClub).toEqual({ n: 2, of: 5 });
    expect(n.threeFriends).toEqual({ n: 1, of: 5 });
  });

  it("a pair written twice is still one friend", () => {
    const n = launchNumbers(
      input({
        accounts: [account("a"), account("b"), account("c")],
        friendships: [
          { a: "a", b: "b" },
          { a: "a", b: "b" },
          { a: "a", b: "c" },
        ],
      }),
      NOW
    ).allTime;
    expect(n.threeFriends.n).toBe(0);
  });

  it("only a timed training is a post: typed time and gym never count", () => {
    const n = launchNumbers(
      input({
        accounts: [account("clock"), account("session"), account("before"), account("typed"), account("gym"), account("none")],
        logs: [
          log("clock", "2026-11-26"),
          log("session", "2026-11-26", { proof: "session" }),
          log("before", "2026-11-26", { proof: "before" }),
          log("before", "2026-11-26", { proof: null }), // from before the column: counted
          log("typed", "2026-11-26", { proof: "typed" }),
          log("typed", "2026-11-25", { proof: "typed" }),
          log("gym", "2026-11-26", { kind: "gym" }),
        ],
      }),
      NOW
    ).allTime;
    expect(n.posted).toEqual({ n: 3, of: 6 });
    expect(n.postedIn48h.n).toBe(3);
  });

  it("the first post counts inside 48 hours up to the hour, and not a minute past it", () => {
    const joined = "2026-11-20T15:00:00.000Z";
    const plus = (hours: number, minutes = 0) => new Date(new Date(joined).getTime() + hours * HOUR + minutes * 60_000).toISOString();
    const n = launchNumbers(
      input({
        accounts: [account("on", { joinedAt: joined }), account("over", { joinedAt: joined }), account("later", { joinedAt: joined })],
        logs: [
          log("on", "2026-11-22", { at: plus(48) }),
          log("over", "2026-11-22", { at: plus(48, 1) }),
          // a fast second post does not rescue a slow first one, and a slow
          // second post does not spoil a fast first one
          log("later", "2026-11-20", { at: plus(2) }),
          log("later", "2026-11-25", { at: plus(120) }),
        ],
      }),
      NOW
    ).allTime;
    expect(n.posted.n).toBe(3);
    expect(n.postedIn48h).toEqual({ n: 2, of: 3 });
  });

  it("the typical time to a first post is the middle player's, in hours", () => {
    const joined = ago(100);
    const first = (id: string, hours: number) => log(id, "2026-11-23", { at: new Date(new Date(joined).getTime() + hours * HOUR).toISOString() });
    const accounts = ["a", "b", "c", "d"].map((id) => account(id, { joinedAt: joined }));
    const n = launchNumbers(input({ accounts, logs: [first("a", 1), first("b", 5.5), first("c", 30), first("d", 90)] }), NOW).allTime;
    expect(n.medianHours).toBe(5.5); // four players: the lower of the two middles
    expect(launchNumbers(input({ accounts }), NOW).allTime.medianHours).toBeNull();
  });

  it("came back: a later day inside seven days, only for players whose first training is a week old", () => {
    const old = { joinedAt: ago(24 * 20) };
    const n = launchNumbers(
      input({
        accounts: [
          account("back", old),
          account("day7", old),
          account("day8", old),
          account("sameDay", old),
          account("typedBack", old),
          account("fresh"),
          account("edge", old),
          account("never", old),
        ],
        logs: [
          log("back", "2026-11-10"),
          log("back", "2026-11-12"),
          log("day7", "2026-11-10"),
          log("day7", "2026-11-17"), // the seventh day still counts
          log("day8", "2026-11-10"),
          log("day8", "2026-11-18"), // the eighth does not
          log("sameDay", "2026-11-10"),
          log("sameDay", "2026-11-10"), // twice in one day is not coming back
          log("typedBack", "2026-11-10"),
          log("typedBack", "2026-11-12", { proof: "typed" }), // a typed return is not one
          log("fresh", "2026-11-25"),
          log("fresh", "2026-11-26"), // came back, but too new to judge
          log("edge", "2026-11-19"), // exactly seven days old: judged
        ],
      }),
      NOW
    ).allTime;
    expect(n.posted.n).toBe(7);
    // back, day7, day8, sameDay, typedBack and edge are a week old; fresh and never are not in it
    expect(n.cameBack).toEqual({ n: 2, of: 6 });
    expect(fmtCameBack(n.cameBack)).toBe("2 of 6");
  });

  it("says too early to tell until somebody's first training is a week old", () => {
    const n = launchNumbers(input({ accounts: [account("a")], logs: [log("a", "2026-11-20"), log("a", "2026-11-22")] }), NOW).allTime;
    expect(n.cameBack).toEqual({ n: 0, of: 0 });
    expect(fmtCameBack(n.cameBack)).toBe(TOO_EARLY);
    expect(TOO_EARLY).toBe("Too early to tell");
  });

  it("the last 30 days are their own count, to the hour", () => {
    const n = launchNumbers(
      input({
        accounts: [
          account("new", { joinedAt: ago(1), hasPhoto: true, hasUsername: true }),
          account("in", { joinedAt: ago(30 * 24) }), // exactly 30 days: in
          account("out", { joinedAt: ago(30 * 24 + 1), hasPhoto: true, hasUsername: true }),
        ],
        logs: [log("new", "2026-11-26", { at: ago(0.5) }), log("out", "2026-10-28")],
        clubs: [{ id: "k", name: "Team", archived: false }],
        members: [{ clubId: "k", profileId: "out" }],
      }),
      NOW
    );
    expect(n.last30.joined).toBe(2);
    expect(n.last30.setUp).toEqual({ n: 1, of: 2 });
    expect(n.last30.inClub).toEqual({ n: 0, of: 2 });
    expect(n.last30.posted).toEqual({ n: 1, of: 2 });
    expect(n.allTime.joined).toBe(3);
    expect(n.allTime.setUp).toEqual({ n: 2, of: 3 });
    expect(n.allTime.inClub).toEqual({ n: 1, of: 3 });
    expect(n.allTime.posted).toEqual({ n: 2, of: 3 });
  });

  it("a log before the account was made counts as posted at once, never as negative time", () => {
    const n = launchNumbers(
      input({ accounts: [account("a", { joinedAt: ago(1) })], logs: [log("a", "2026-11-26", { at: ago(2) })] }),
      NOW
    ).allTime;
    expect(n.postedIn48h.n).toBe(1);
    expect(n.medianHours).toBe(0);
  });
});

describe("every club", () => {
  const club = (id: string, name: string, size: number, posted: number, archived = false) => {
    const ids = Array.from({ length: size }, (_, i) => `${id}-${i}`);
    return {
      club: { id, name, archived },
      accounts: ids.map((x) => account(x)),
      members: ids.map((profileId) => ({ clubId: id, profileId })),
      logs: ids.slice(0, posted).map((x) => log(x, "2026-11-20")),
    };
  };
  const build = (...parts: ReturnType<typeof club>[]) =>
    launchNumbers(
      input({
        accounts: parts.flatMap((p) => p.accounts),
        clubs: parts.map((p) => p.club),
        members: parts.flatMap((p) => p.members),
        logs: parts.flatMap((p) => p.logs),
      }),
      NOW
    );

  it("is activated at exactly five players and three who have posted, and not just under", () => {
    expect([CLUB_MIN_MEMBERS, CLUB_MIN_POSTED]).toEqual([5, 3]);
    const n = build(club("exact", "Exact", 5, 3), club("fewPosts", "Few posts", 5, 2), club("small", "Small", 4, 4), club("big", "Big", 9, 9));
    const by = new Map(n.clubs.map((c) => [c.id, c]));
    expect(by.get("exact")).toMatchObject({ members: 5, posted: 3, activated: true });
    expect(by.get("fewPosts")).toMatchObject({ members: 5, posted: 2, activated: false });
    expect(by.get("small")).toMatchObject({ members: 4, posted: 4, activated: false });
    expect(by.get("big")).toMatchObject({ members: 9, posted: 9, activated: true });
    expect(n.clubsActivated).toEqual({ n: 2, of: 4 });
    expect(activatedLine(n.clubsActivated)).toBe("2 of 4 clubs activated.");
  });

  it("typed time and gym do not activate a club", () => {
    const c = club("k", "Team", 5, 0);
    const n = launchNumbers(
      input({
        accounts: c.accounts,
        clubs: [c.club],
        members: c.members,
        logs: [
          log("k-0", "2026-11-25", { proof: "typed" }),
          log("k-1", "2026-11-25", { proof: "typed" }),
          log("k-2", "2026-11-25", { kind: "gym" }),
          log("k-3", "2026-11-25"),
        ],
      }),
      NOW
    );
    expect(n.clubs[0]).toMatchObject({ posted: 1, trainedThisWeek: 1, activated: false });
  });

  it("trained this week runs from Monday in New York", () => {
    const c = club("k", "Team", 5, 0);
    const n = launchNumbers(
      input({
        accounts: c.accounts,
        clubs: [c.club],
        members: c.members,
        logs: [
          log("k-0", "2026-11-23"), // Monday: this week
          log("k-0", "2026-11-24"), // the same player twice is one player
          log("k-1", "2026-11-26"), // today
          log("k-2", "2026-11-22"), // Sunday: last week
          log("k-3", "2026-11-26", { proof: "typed" }),
        ],
      }),
      NOW
    );
    expect(n.clubs[0]).toMatchObject({ members: 5, trainedThisWeek: 2, posted: 3, activated: true });
  });

  it("the New York day decides the week, not the server's clock", () => {
    // 9pm Sunday Nov 29 in New York is already Monday Nov 30 in UTC.
    const lateSunday = new Date("2026-11-30T02:00:00.000Z");
    const c = club("k", "Team", 5, 0);
    const n = launchNumbers(input({ accounts: c.accounts, clubs: [c.club], members: c.members, logs: [log("k-0", "2026-11-23")] }), lateSunday);
    expect(n.clubs[0].trainedThisWeek).toBe(1);
  });

  it("lists live clubs only, biggest first, then by name", () => {
    const n = build(club("b", "Bravo", 3, 0), club("z", "Zulu", 6, 0), club("a", "Alpha", 3, 0), club("x", "Ended", 9, 9, true));
    expect(n.clubs.map((c) => c.name)).toEqual(["Zulu", "Alpha", "Bravo"]);
    expect(n.clubsActivated).toEqual({ n: 0, of: 3 });
  });

  it("a member row written twice is one player, and a row for nobody is none", () => {
    const c = club("k", "Team", 4, 4);
    const n = launchNumbers(
      input({
        accounts: c.accounts,
        clubs: [c.club],
        members: [...c.members, c.members[0], { clubId: "k", profileId: "deleted" }],
        logs: c.logs,
      }),
      NOW
    );
    expect(n.clubs[0]).toMatchObject({ members: 4, activated: false });
  });

  it("names clubs and counts players: nothing in a row is a player", () => {
    const n = build(club("k", "Team", 5, 3));
    expect(Object.keys(n.clubs[0]).sort()).toEqual(["activated", "id", "members", "name", "posted", "trainedThisWeek"]);
    expect(JSON.stringify(n)).not.toContain("k-0");
  });
});

describe("an empty app", () => {
  it("gives zeros and too early to tell, without throwing", () => {
    const n = launchNumbers(input({}), NOW);
    for (const w of [n.last30, n.allTime]) {
      expect(w.joined).toBe(0);
      for (const c of [w.setUp, w.inClub, w.threeFriends, w.posted, w.postedIn48h, w.cameBack]) expect(c).toEqual({ n: 0, of: 0 });
      expect(w.medianHours).toBeNull();
      expect(fmtCameBack(w.cameBack)).toBe(TOO_EARLY);
      expect(fmtTypical(w.medianHours)).toBe("-");
    }
    expect(n.clubs).toEqual([]);
    expect(n.clubsActivated).toEqual({ n: 0, of: 0 });
    expect(activatedLine(n.clubsActivated)).toBe("No clubs yet.");
  });

  it("logs, members and friends of accounts that are gone are ignored", () => {
    const n = launchNumbers(
      input({
        logs: [log("gone", "2026-11-20")],
        clubs: [{ id: "k", name: "Team", archived: false }],
        members: [{ clubId: "k", profileId: "gone" }],
        friendships: [{ a: "gone", b: "also-gone" }],
      }),
      NOW
    );
    expect(n.allTime.posted).toEqual({ n: 0, of: 0 });
    expect(n.clubs).toEqual([{ id: "k", name: "Team", members: 0, trainedThisWeek: 0, posted: 0, activated: false }]);
  });
});

describe("the words", () => {
  it("says a typical time the way a coach would", () => {
    expect(fmtTypical(0)).toBe("Under an hour");
    expect(fmtTypical(0.9)).toBe("Under an hour");
    expect(fmtTypical(1)).toBe("1 hour");
    expect(fmtTypical(5.4)).toBe("5 hours");
    expect(fmtTypical(47)).toBe("47 hours");
    expect(fmtTypical(48)).toBe("2 days");
    expect(fmtTypical(100)).toBe("4 days");
    expect(activatedLine({ n: 1, of: 1 })).toBe("1 of 1 club activated.");
    expect(ACTIVATED_RULE).toBe("A club counts as activated with 5 players in it and 3 who have posted.");
  });

  it("the card follows the house rules for words on screen", () => {
    const root = path.resolve(__dirname, "..");
    const card = readFileSync(path.join(root, "components/elite/LaunchNumbersCard.tsx"), "utf8");
    const calc = readFileSync(path.join(root, "lib/elite/launch-numbers.ts"), "utf8");
    for (const s of [card, calc]) {
      expect(s).not.toMatch(/[—–]/); // no em or en dashes
      expect(s).not.toMatch(/\bAI\b|automated|algorithm/i);
      expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    for (const label of [
      "Launch numbers",
      "Joined",
      "Photo and username set",
      "In a club",
      "3 friends or more",
      "Posted a timed training",
      "Posted inside 48 hours",
      "Came back within a week",
      "Typical time to a first post",
    ]) {
      expect(card, label).toContain(label);
    }
    // counts only: the card is handed no player and links to none
    expect(card).not.toMatch(/full_name|profile_id|\/coach\/players/);
  });
});

describe("the reader", () => {
  const root = path.resolve(__dirname, "..");
  const read = (f: string) => readFileSync(path.join(root, f), "utf8");
  const server = read("lib/elite/launch-numbers-server.ts");
  const code = server.replace(/^\s*\/\/.*$/gm, "");

  it("reads every row: each table is paged, in an order that never ties", () => {
    const reads = code.match(/\.from\("elite_[a-z_]+"\)/g) ?? [];
    expect(reads.length).toBe(6);
    expect((code.match(/\.range\(from, to\)/g) ?? []).length).toBe(reads.length);
    expect((code.match(/every<\w+>\(\(from, to\) =>/g) ?? []).length).toBe(reads.length);
    expect(code).toContain('import { everyRow } from "./supabase/every-row"');
    for (const chain of code.split("every<").slice(1)) {
      expect(chain.split(".range(from, to)")[0]).toMatch(/\.order\("(id|profile_id|a|club_id)"\)/);
    }
  });

  it("a failed page gives nothing, never part of a table", () => {
    expect(code).toContain("if (result.error) failed = true;");
    expect(code).toContain("if (failed) return null;");
  });

  it("only reads, and only for a coach", () => {
    expect(code).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
    expect(code).toContain('if (!viewer || viewer.demo || viewer.role === "player") return null;');
    expect(code.indexOf("getViewer()")).toBeLessThan(code.indexOf("createServiceClient()"));
  });

  it("asks the database for training that counts on boards, and the calculator asks again", () => {
    expect(code).toContain('.eq("kind", "training")');
    expect(code).toContain('.neq("proof", TYPED)');
    expect(read("lib/elite/launch-numbers.ts")).toContain("if (!onBoards(l)) continue;");
  });

  it("the calculator is pure and the card sits at the top of the coach's free page", () => {
    const calc = read("lib/elite/launch-numbers.ts");
    expect(calc).not.toMatch(/\.from\(|supabase|createServiceClient|getViewer/);
    const page = read("app/(coach)/coach/free/page.tsx");
    const card = page.indexOf("<LaunchNumbersCard");
    expect(card).toBeGreaterThan(0);
    expect(card).toBeLessThan(page.indexOf("<ReportsQueue"));
    expect(page).toContain("{launch ? <LaunchNumbersCard numbers={launch} /> : null}");
  });
});
