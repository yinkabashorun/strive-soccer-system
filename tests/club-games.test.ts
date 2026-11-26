import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CLUBS_TOPIC_DETAIL_NO_GAMES,
  CLUB_GAMES_IN_APP,
  CLUB_GAMES_OFF_MESSAGE,
  clubGamesInApp,
  clubPageForApp,
  planActionInApp,
  planInApp,
  waitingForApp,
} from "@/lib/elite/club-games";
import type { PlanCard } from "@/lib/elite/club-teams";
import { prefsForApp, type NoticePrefs } from "@/lib/elite/notice-prefs";
import { TOPIC_CHOICE } from "@/lib/elite/notices";
import {
  CHAMPS_FROM_HOUR,
  CHAMPS_UNTIL_HOUR,
  champsDue,
  champsOf,
  matchupView,
  type MatchupRow,
} from "@/lib/elite/club-matchups";
import { CHAMPS_MARK, champsBeatLine, everyMatchupSentence } from "@/lib/elite/club-matchup-words";

// Three of Coach Yinka's calls from Nov 26 2026, each held in both
// directions where it is a switch:
//
//   GAMES BETWEEN CLUBS ARE OUT OF THE IPHONE APP ("2 YES"). One constant,
//   lib/elite/club-games.ts. Off: the app is sent nothing of games, its
//   routes refuse what a game needs, the phone draws none of it. A club's
//   own training sessions and the weekly matchup stay. The website is
//   unchanged. On: everything comes back as it was (a switch, never a
//   deletion).
//
//   THE FREE APP LEADS WITH TWO SCORES: the friends board and the club's
//   weekly matchup. The level lives on You and on a profile, nowhere else.
//
//   CHAMPS OF THE WEEK: the players of a club that won last week's matchup
//   are told once, Monday evening, and the club carries a gold mark for
//   the week after the win.

const root = join(__dirname, "..");
const code = (p: string) => readFileSync(join(root, p), "utf8");

const plan = (kind: "training" | "game", id: string = kind): PlanCard => ({ id, kind }) as PlanCard;
const page = () => ({
  id: "club-a",
  name: "Sunday Pickup",
  open: true,
  record: "4-1",
  recordLine: "4 games won, 1 lost.",
  next: [plan("game", "g1"), plan("training", "t1"), plan("game", "g2")],
  results: [plan("game", "g0")],
  manage: { requests: [{ id: "r1" }], games: [{ id: "g3" }] } as { requests: unknown[]; games: unknown[] },
  matchup: { state: "on" },
});

describe("the one switch", () => {
  it("is off: games between clubs are not in the iPhone app", () => {
    expect(CLUB_GAMES_IN_APP).toBe(false);
    expect(clubGamesInApp()).toBe(false);
    expect(CLUB_GAMES_OFF_MESSAGE).toBe("Games between clubs are not in the app.");
  });

  it("off: a club's page reaches the app with nothing of games on it", () => {
    const sent = clubPageForApp(page(), false);
    expect(sent.open).toBe(false);
    expect(sent.record).toBe("");
    expect(sent.recordLine).toBe("");
    expect(sent.next.map((p) => p.id)).toEqual(["t1"]);
    expect(sent.results).toEqual([]);
    expect(sent.manage).toEqual({ requests: [{ id: "r1" }], games: [] });
    // what is not a game is untouched: the club, its training, its matchup
    expect(sent.name).toBe("Sunday Pickup");
    expect(sent.matchup).toEqual({ state: "on" });
    // a member who is not the captain has no manage block either way
    expect(clubPageForApp({ ...page(), manage: null }, false).manage).toBeNull();
  });

  it("on: the same page passes through whole (a switch, never a deletion)", () => {
    const whole = page();
    expect(clubPageForApp(whole, true)).toBe(whole);
  });

  it("what waits on a captain: players asking to join always, a game only when games are in", () => {
    const counts = { requests: 2, gameAsks: 1, scores: 3 };
    expect(waitingForApp(counts, false)).toBe(2);
    expect(waitingForApp(counts, true)).toBe(6);
    expect(waitingForApp({ requests: 0, gameAsks: 4, scores: 4 }, false)).toBe(0);
  });

  it("a plan the app may show or act on", () => {
    expect(planInApp("training", false)).toBe(true);
    expect(planInApp("game", false)).toBe(false);
    expect(planInApp(null, false)).toBe(false);
    expect(planInApp("game", true)).toBe(true);
    // the default follows the constant
    expect(planInApp("game")).toBe(CLUB_GAMES_IN_APP);
  });

  it("the app's actions on one plan: a game's own are refused, a training session's all work", () => {
    for (const action of ["accept", "pass", "score", "confirm", "dispute"]) {
      expect(planActionInApp(action, "game", false), action).toBe(false);
      // even aimed at a training session's id: they are a game's alone
      expect(planActionInApp(action, "training", false), action).toBe(false);
      expect(planActionInApp(action, "game", true), action).toBe(true);
    }
    for (const action of ["in", "out", "cancel", "report"]) {
      expect(planActionInApp(action, "training", false), action).toBe(true);
      expect(planActionInApp(action, "game", false), action).toBe(false);
      expect(planActionInApp(action, null, false), action).toBe(false);
      expect(planActionInApp(action, "game", true), action).toBe(true);
    }
  });

  it("Clubs under Notifications names no games in the app; the website's line is its own", () => {
    const prefs: NoticePrefs = {
      topics: [
        { key: "friends", ...TOPIC_CHOICE.friends, on: true },
        { key: "clubs", ...TOPIC_CHOICE.clubs, on: false },
      ],
      reminder: null,
    };
    const app = prefsForApp(prefs, false);
    expect(app.topics[1]).toEqual({ key: "clubs", label: TOPIC_CHOICE.clubs.label, detail: CLUBS_TOPIC_DETAIL_NO_GAMES, on: false });
    expect(app.topics[0]).toEqual(prefs.topics[0]);
    expect(CLUBS_TOPIC_DETAIL_NO_GAMES).not.toMatch(/game/i);
    expect(prefsForApp(prefs, true)).toBe(prefs);
    expect(TOPIC_CHOICE.clubs.detail).toMatch(/games/);
  });
});

describe("every reader goes through the switch", () => {
  it("the app's routes: sending a game, a game's actions, clubs near you, Open to games", () => {
    const plans = code("app/api/app/free/plans/route.ts");
    expect(plans).toContain("if (!clubGamesInApp()) return bad(CLUB_GAMES_OFF_MESSAGE);");
    const one = code("app/api/app/free/plans/[id]/route.ts");
    expect(one).toContain("if (!clubGamesInApp()) {");
    expect(one).toContain("if (!planActionInApp(body?.do, kind, false)) return bad(CLUB_GAMES_OFF_MESSAGE);");
    const near = code("app/api/app/free/clubs/[id]/near/route.ts");
    expect(near).toContain("if (!clubGamesInApp()) return appJson(NOT_FOUND, 404);");
    const club = code("app/api/app/free/clubs/[id]/route.ts");
    expect(club).toContain("setClubCountyFromApp(id, county, body.open)");
    expect(club).not.toMatch(/\bsetClubCounty\(/);
  });

  it("the app's club readers: the card's next, the page, the count, clubs near you, the county", () => {
    const server = code("lib/elite/club-app-server.ts");
    expect(server).toContain("return clubPageForApp<AppClubPage>({");
    expect(server).toContain("return waitingForApp({");
    expect(server).toContain('plans.next.find((p) => p.status === "on" && planInApp(p.kind))');
    const nearFn = server.slice(server.indexOf("export async function appClubNearFor"));
    expect(nearFn.indexOf("if (!clubGamesInApp()) return null;")).toBeGreaterThan(-1);
    const county = server.slice(server.indexOf("export async function setClubCountyFromApp"));
    expect(county).toContain("if (clubGamesInApp()) return setClubCounty(clubId, county, open);");
  });

  it("the phone: every games control is drawn only when the constant says so", () => {
    const index = code("mobile/app/club/[id]/index.tsx");
    expect(index).toContain("{CLUB_GAMES_IN_APP ? <RecordChip big={c.record}");
    expect(index).toContain('{CLUB_GAMES_IN_APP ? <Button quiet label="Plan a game"');
    expect(index).toContain("{CLUB_GAMES_IN_APP && c.results.length ? (");
    // each games word on the club's page sits behind the switch
    for (const line of index.split("\n")) {
      if (/Plan a game|games won-lost|no games yet/.test(line)) expect(line, line.trim()).toContain("CLUB_GAMES_IN_APP");
    }
    const manage = code("mobile/app/club/[id]/manage.tsx");
    expect((manage.match(/\{CLUB_GAMES_IN_APP \? \(/g) ?? []).length).toBe(2);
    expect(code("mobile/app/club/[id]/plan.tsx")).toContain("const game = CLUB_GAMES_IN_APP && Boolean(vs);");
    expect(code("mobile/app/club/[id]/near.tsx")).toContain("if (!CLUB_GAMES_IN_APP) return <Redirect href={`/club/${clubId}` as Href} />;");
    expect(code("mobile/app/club/start.tsx")).toContain("{CLUB_GAMES_IN_APP");
    // what Notifications says it is for names no game while games are out
    const settings = code("mobile/app/settings.tsx");
    expect(settings).toContain('"A friend posts or gives you props, your club plans a session, or your club wins the week. Nothing else."');
    expect(settings.indexOf("? CLUB_GAMES_IN_APP")).toBeLessThan(settings.indexOf("or your club plans a session or a game."));
  });

  it("the phone reads the constant from the shared file, never a copy of its own", () => {
    const copies: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(root, dir))) {
        const p = `${dir}/${name}`;
        if (statSync(join(root, p)).isDirectory()) {
          if (name !== "node_modules") walk(p);
          continue;
        }
        if (/\.(ts|tsx)$/.test(name) && /(const|let|var)\s+CLUB_GAMES_IN_APP\b/.test(code(p))) copies.push(p);
      }
    };
    walk("mobile/app");
    walk("mobile/src");
    expect(copies).toEqual([]);
    expect(code("lib/elite/club-games.ts")).toContain("export const CLUB_GAMES_IN_APP: boolean = false;");
  });

  it("a game's notice goes to browsers only while games are out of the app; a session's goes everywhere", () => {
    const notices = code("lib/elite/free-notices-server.ts");
    expect(notices).toContain("notifyProfile(r.profileId, notice, { webOnly: !planInApp(plan.kind) })");
    const push = code("lib/elite/push.ts");
    expect(push).toContain("const native = isNativePushConfigured() && !opts.webOnly;");
  });

  it("the website is unchanged: its club pages and actions never read the switch", () => {
    const readers: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(root, dir))) {
        const p = `${dir}/${name}`;
        if (statSync(join(root, p)).isDirectory()) {
          walk(p);
          continue;
        }
        if (/\.(ts|tsx)$/.test(name) && /from "[^"]*club-games"/.test(code(p))) readers.push(p);
      }
    };
    walk("app");
    walk("components");
    expect(readers.sort()).toEqual([
      "app/api/app/free/clubs/[id]/near/route.ts",
      "app/api/app/free/plans/[id]/route.ts",
      "app/api/app/free/plans/route.ts",
    ]);
    for (const f of ["lib/elite/club-teams.ts", "lib/elite/club-teams-server.ts", "lib/elite/club-teams-actions.ts"]) {
      expect(code(f), f).not.toMatch(/club-games|clubGamesInApp|CLUB_GAMES_IN_APP/);
    }
  });
});

describe("the free app leads with two scores", () => {
  // The level is the player's own: You, and a profile. Every other screen
  // of the free app leads with the friends board or the club's matchup.
  const LEVEL_HOMES = ["mobile/app/(free)/me.tsx", "mobile/app/player/[id].tsx", "mobile/src/ProfileParts.tsx"];

  it("the level is drawn on You and a profile, and nowhere else in the app", () => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(root, dir))) {
        const p = `${dir}/${name}`;
        if (statSync(join(root, p)).isDirectory()) {
          if (name !== "node_modules" && name !== "api") walk(p);
          continue;
        }
        if (/\.(ts|tsx)$/.test(name) && /\baura\b|LevelBar|LevelRing|levelName/.test(code(p))) found.push(p);
      }
    };
    walk("mobile/app");
    walk("mobile/src");
    expect(found.sort()).toEqual([...LEVEL_HOMES].sort());
  });

  it("nothing the other screens are sent carries a level", () => {
    const contract = code("lib/elite/app-contract.ts");
    const holders = [...contract.matchAll(/export type (\w+) = \{(?:(?!\nexport type )[\s\S])*?\n\s+aura: /g)].map((m) => m[1]);
    expect(holders).toEqual(["AppFreeYou", "AppProfile"]);
    // the feed, the week with its friends board, and the clubs: none of them
    for (const name of ["AppFreeFeed", "AppFreeWeek", "AppClubCard", "AppClubPage"]) {
      const start = contract.indexOf(`export type ${name} = `);
      expect(start, name).toBeGreaterThan(-1);
      const end = contract.indexOf("\nexport type ", start + 1);
      expect(contract.slice(start, end === -1 ? undefined : end), name).not.toMatch(/\baura\b|\blevel\b/);
    }
  });

  it("the games record is not a third score in the app", () => {
    expect(clubPageForApp(page(), false).record).toBe("");
    // the matchup's own record stays, in its own words
    expect(code("mobile/app/club/[id]/index.tsx")).toContain("weeks won-lost");
  });
});

describe("champs of the week", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const WEEK = "2026-11-23";
  const row = (r: Partial<MatchupRow> & { club_id: string }): MatchupRow => ({
    week_monday: WEEK,
    opponent_id: null,
    roster: ["p1", "p2", "p3"],
    minutes: null,
    players: null,
    result: null,
    decided_at: null,
    ...r,
  });
  const done = "2026-11-30T05:01:00Z";

  it("the winners of a decided week, each with the club it beat and the true gap per player", () => {
    const rows = [
      row({ club_id: A, opponent_id: B, minutes: 360, players: 3, result: "win", decided_at: done, roster: ["a1", "a2", "a3"] }),
      row({ club_id: B, opponent_id: A, minutes: 432, players: 4, result: "loss", decided_at: done }),
      // a draw has no winner
      row({ club_id: C, opponent_id: D, minutes: 300, players: 3, result: "draw", decided_at: done }),
      row({ club_id: D, opponent_id: C, minutes: 300, players: 3, result: "draw", decided_at: done }),
    ];
    // 360 / 3 = 120 a player against 432 / 4 = 108: more time in total did not win
    expect(champsOf(rows)).toEqual([{ clubId: A, otherId: B, roster: ["a1", "a2", "a3"], gap: 12 }]);
  });

  it("nobody is champs of a week that is not decided, had nobody to play, or cannot be said truthfully", () => {
    // not decided yet
    expect(champsOf([row({ club_id: A, opponent_id: B, minutes: 360, players: 3 }), row({ club_id: B, opponent_id: A, minutes: 100, players: 3 })])).toEqual([]);
    // no other club was left to play
    expect(champsOf([row({ club_id: A, minutes: 360, players: 3, decided_at: done })])).toEqual([]);
    // the other side's row is missing: the gap cannot be said
    expect(champsOf([row({ club_id: A, opponent_id: B, minutes: 360, players: 3, result: "win", decided_at: done })])).toEqual([]);
    // a stored win with no gap in the stored numbers is not shouted about
    expect(
      champsOf([
        row({ club_id: A, opponent_id: B, minutes: 300, players: 3, result: "win", decided_at: done }),
        row({ club_id: B, opponent_id: A, minutes: 300, players: 3, result: "loss", decided_at: done }),
      ])
    ).toEqual([]);
  });

  it("told on Monday in New York, from 5 PM, never after 9 PM, never another day", () => {
    expect([CHAMPS_FROM_HOUR, CHAMPS_UNTIL_HOUR]).toEqual([17, 21]);
    const monday = "2026-11-30";
    for (const hour of [17, 18, 19, 20]) expect(champsDue({ today: monday, hour }), String(hour)).toBe(true);
    for (const hour of [0, 6, 16, 21, 23]) expect(champsDue({ today: monday, hour }), String(hour)).toBe(false);
    for (const day of ["2026-11-29", "2026-12-01", "2026-12-05"]) expect(champsDue({ today: day, hour: 18 }), day).toBe(false);
  });

  it("the sender: winners only, each player once, through the one sender, and nothing without its ledger", () => {
    const src = code("lib/elite/free-notices-server.ts");
    const fn = src.slice(src.indexOf("export async function noticeClubChamps"), src.indexOf("async function claimChamps"));
    // the window first, before the database is touched
    expect(fn.indexOf("if (!champsDue(opts)) return { sent: 0 };")).toBeLessThan(fn.indexOf("ready()"));
    // last week's rows, all of them, in an order that never ties
    expect(fn).toContain("const week = lastMonday(matchupMonday(opts.today));");
    expect(fn).toContain("everyRow<Raw>(");
    expect(fn).toContain('.eq("week_monday", week)');
    // only who champsOf names: a loss and a draw reach nobody
    expect(fn).toContain("const winners = champsOf(rows);");
    // the players counted in that matchup who are still in the club
    expect(fn).toContain("const counted = w.roster.filter((id) => still.has(id));");
    // claim first, then the one sender
    const claim = fn.indexOf("if (!maySend(await claimChamps(admin, week, w.clubId, id))) continue;");
    expect(claim).toBeGreaterThan(-1);
    expect(claim).toBeLessThan(fn.indexOf("notifyProfile(id, clubChampsNotice("));
    expect(fn).not.toMatch(/sendPushToProfile|sendSms|sendPlayerOwnSMS|textCoaches/);
    // the ledger is the migration's own table, one row per week, club and player
    expect(src).toContain('admin.from("elite_champs_notices").insert({ week_monday: weekMonday, club_id: clubId, profile_id: profileId })');
    // it never throws into the hourly run
    expect(fn).toMatch(/\} catch \{\s+return \{ sent: 0 \};/);
  });

  it("the hourly run calls it with New York's day and hour, inside its own catch", () => {
    const cron = code("app/api/elite/cron/weekly-plans/route.ts");
    expect(cron).toContain("await noticeClubChamps({ today: nyToday(), hour: nyHour() }).catch(");
  });

  it("the words: his mark, and the true margin a child can read", () => {
    expect(CHAMPS_MARK).toBe("Strive champs of the week");
    expect(champsBeatLine({ who: "You", other: "Sunday Pickup", gap: 12 })).toBe("You beat Sunday Pickup by 12 minutes per player.");
    expect(champsBeatLine({ who: "Renegados FC", other: "Sunday Pickup", gap: 1 })).toBe("Renegados FC beat Sunday Pickup by 1 minute per player.");
    // held to the matchup's own rule for its words (tests/club-matchups.test.ts reads this list)
    expect(everyMatchupSentence()).toContain(CHAMPS_MARK);
  });

  it("the gold mark: on for the week after a win, from the stored result alone", () => {
    const name = (id: string) => (id === B ? "Sunday Pickup" : id === C ? "Gainesville HS" : "Renegados FC");
    const won = row({ club_id: A, opponent_id: B, minutes: 360, players: 3, result: "win", decided_at: done });
    const lost = row({ club_id: B, opponent_id: A, minutes: 300, players: 3, result: "loss", decided_at: done });
    const view = (clubId: string, today: string, rows: MatchupRow[], theirRows: MatchupRow[]) =>
      matchupView({ club: { id: clubId, name: name(clubId), members: 3 }, today, rows, theirRows, nameOf: name, logs: [] });

    // Monday, before this week's matching has run
    expect(view(A, "2026-11-30", [won], [lost]).champs).toBe(true);
    // mid-week, with this week's matchup on
    const next = row({ week_monday: "2026-11-30", club_id: A, opponent_id: C });
    const on = view(A, "2026-12-03", [won, next], [lost]);
    expect(on.state).toBe("on");
    expect(on.champs).toBe(true);
    // the club that lost carries no mark, and is never told anything
    expect(view(B, "2026-12-03", [lost], [won]).champs).toBe(false);
    // the week after that, the mark is gone unless they won again
    expect(view(A, "2026-12-07", [won, { ...next, minutes: 100, players: 3, result: "loss", decided_at: "2026-12-07T05:01:00Z" }], [lost]).champs).toBe(false);
    // a draw, and a week with nobody to play, are no mark
    expect(view(A, "2026-11-30", [{ ...won, result: "draw" }], [lost]).champs).toBe(false);
    expect(view(A, "2026-11-30", [row({ club_id: A, decided_at: done })], []).champs).toBe(false);
  });

  it("the mark is on the club's card and its page, in the earned colour, never a button", () => {
    const card = code("mobile/app/(free)/clubs.tsx");
    expect(card).toContain("{club.champs ? <Eyebrow style={{ marginTop: 6 }}>{CHAMPS_MARK}</Eyebrow> : null}");
    const clubPage = code("mobile/app/club/[id]/index.tsx");
    expect(clubPage).toContain("{c.matchup?.champs ? <Eyebrow");
    // the card's flag comes from the matchup's own view
    expect(code("lib/elite/club-app-server.ts")).toContain("...(matchup?.champs ? { champs: true } : {})");
    // Eyebrow is the app's small gold label
    const ui = code("mobile/src/ui.tsx");
    const eyebrow = ui.slice(ui.indexOf("export function Eyebrow"), ui.indexOf("export function Eyebrow") + 600);
    expect(eyebrow).toMatch(/gold/);
  });
});
