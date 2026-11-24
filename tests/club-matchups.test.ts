import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MATCHUP_MIN_PLAYERS,
  decide,
  lastMonday,
  matchingDue,
  matchupMonday,
  matchupRecord,
  matchupRows,
  matchupView,
  opponentsOf,
  pairClubs,
  perPlayerMinutes,
  resultOf,
  sideMinutes,
  weekIsOver,
  weekOrder,
  type MatchupLog,
  type MatchupRow,
} from "@/lib/elite/club-matchups";
import {
  MATCHUP_HOW_LINES,
  MATCHUP_NONE_LINE,
  MATCHUP_SOON_LINE,
  everyMatchupSentence,
  matchupAheadLine,
  matchupCardLine,
  matchupRecordLine,
  matchupResultLine,
  matchupSmallLine,
} from "@/lib/elite/club-matchup-words";
import { RANKING_MIN_MEMBERS } from "@/lib/elite/tracker";

// THE WEEKLY CLUB MATCHUP (Nov 24 2026, migration 083). Every Monday each
// club is matched with another club; all week both train; after Sunday the
// club with more training time per player wins the week. Held here: who is
// matched with whom, what counts, when and how a week is decided, that a
// decided week is never worked out again, and the owner's condition on the
// words ("copy an elementary schooler can understand").

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

const MON = "2026-11-23"; // a Monday
const club = (id: string, county: string | null = "va-prince-william") => ({ id, county });
const none = new Map<string, string>();
const flat = (pairs: [string, string][]) => pairs.flat().sort();

describe("who is matched with whom", () => {
  it("pairs clubs of the same county, and everybody once", () => {
    const clubs = ["a", "b", "c", "d"].map((x) => club(x));
    const p = pairClubs({ clubs, monday: MON, lastOpponent: none });
    expect(p.pairs).toHaveLength(2);
    expect(p.alone).toEqual([]);
    expect(flat(p.pairs)).toEqual(["a", "b", "c", "d"]);
  });

  it("is the same every time it is asked for the same Monday, and changes with the week", () => {
    const clubs = Array.from({ length: 12 }, (_, i) => club(`club-${i}`));
    const one = pairClubs({ clubs, monday: MON, lastOpponent: none });
    const again = pairClubs({ clubs: [...clubs].reverse(), monday: MON, lastOpponent: none });
    expect(again).toEqual(one);
    const orders = new Set(["2026-11-23", "2026-11-30", "2026-12-07", "2026-12-14"].map((m) => weekOrder(clubs.map((c) => c.id), m).join(",")));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("keeps a county's clubs together before it looks anywhere else", () => {
    const clubs = [club("a", "va-loudoun"), club("b", "va-loudoun"), club("c", "md-howard"), club("d", "md-howard")];
    const p = pairClubs({ clubs, monday: MON, lastOpponent: none });
    expect(p.pairs).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("matches a club left over with a left-over club from another county", () => {
    const clubs = [club("a", "va-loudoun"), club("b", "va-loudoun"), club("c", "va-loudoun"), club("d", "md-howard")];
    const p = pairClubs({ clubs, monday: MON, lastOpponent: none });
    expect(p.pairs).toHaveLength(2);
    expect(p.alone).toEqual([]);
    // d is the only club of its county: it plays whichever Loudoun club was left
    const withD = p.pairs.find((x) => x.includes("d"))!;
    expect(["a", "b", "c"]).toContain(withD.find((x) => x !== "d"));
  });

  it("a club with no county is matched with the left-over clubs", () => {
    const p = pairClubs({ clubs: [club("a", null), club("b", "md-howard")], monday: MON, lastOpponent: none });
    expect(p.pairs).toEqual([["a", "b"]]);
  });

  it("with nobody left, a club has no matchup that week", () => {
    const three = pairClubs({ clubs: ["a", "b", "c"].map((x) => club(x)), monday: MON, lastOpponent: none });
    expect(three.pairs).toHaveLength(1);
    expect(three.alone).toHaveLength(1);
    expect(pairClubs({ clubs: [club("a")], monday: MON, lastOpponent: none })).toEqual({ pairs: [], alone: ["a"] });
    expect(pairClubs({ clubs: [], monday: MON, lastOpponent: none })).toEqual({ pairs: [], alone: [] });
  });

  it("never the same club two weeks running while another choice exists", () => {
    const clubs = ["a", "b", "c", "d"].map((x) => club(x));
    // whatever the week, across many weeks in a row
    let last = none as ReadonlyMap<string, string>;
    for (let w = 0; w < 30; w++) {
      const monday = new Date(Date.UTC(2026, 10, 23 + 7 * w)).toISOString().slice(0, 10);
      const p = pairClubs({ clubs, monday, lastOpponent: last });
      expect(p.pairs).toHaveLength(2);
      for (const [x, y] of p.pairs) expect(last.get(x), `${monday}: ${x} v ${y}`).not.toBe(y);
      last = new Map(p.pairs.flatMap(([x, y]) => [[x, y], [y, x]] as [string, string][]));
    }
  });

  it("the only two clubs of a county look to another county the week after they played", () => {
    const clubs = [club("a", "va-loudoun"), club("b", "va-loudoun"), club("c", "md-howard"), club("d", "md-howard")];
    const last = new Map([
      ["a", "b"],
      ["b", "a"],
      ["c", "d"],
      ["d", "c"],
    ]);
    const p = pairClubs({ clubs, monday: MON, lastOpponent: last });
    expect(p.pairs).toHaveLength(2);
    for (const [x, y] of p.pairs) expect(last.get(x)).not.toBe(y);
  });

  it("two clubs with nobody else to play do play each other again", () => {
    const last = new Map([
      ["a", "b"],
      ["b", "a"],
    ]);
    expect(pairClubs({ clubs: [club("a"), club("b")], monday: MON, lastOpponent: last })).toEqual({ pairs: [["a", "b"]], alone: [] });
  });

  it("stays inside the county when the cross-county fallback is switched off", () => {
    const clubs = [club("a", "va-loudoun"), club("b", "md-howard")];
    expect(pairClubs({ clubs, monday: MON, lastOpponent: none, crossCounty: false })).toEqual({ pairs: [], alone: weekOrder(["a", "b"], MON) });
  });

  it("needs the club ranking's own minimum of players", () => {
    expect(MATCHUP_MIN_PLAYERS).toBe(RANKING_MIN_MEMBERS);
    const run = code("lib/elite/club-matchups-server.ts");
    expect(run).toContain(">= MATCHUP_MIN_PLAYERS");
    expect(run).toContain('.is("archived_at", null)');
  });
});

describe("what is stored on Monday", () => {
  const rows = matchupRows({
    pairing: { pairs: [["a", "b"]], alone: ["c"] },
    monday: MON,
    rosterOf: (id) => ({ a: ["p2", "p1", "p1"], b: ["p3", "p4", "p5"], c: ["p6", "p7", "p8"] })[id] ?? [],
  });

  it("one row a club: its opponent and its players at that moment", () => {
    expect(rows.map((r) => [r.club_id, r.opponent_id, r.roster])).toEqual([
      ["a", "b", ["p1", "p2"]],
      ["b", "a", ["p3", "p4", "p5"]],
      ["c", null, ["p6", "p7", "p8"]],
    ]);
    for (const r of rows) expect(r).toMatchObject({ week_monday: MON, minutes: null, players: null, result: null, decided_at: null });
    expect(opponentsOf(rows)).toEqual(new Map([["a", "b"], ["b", "a"]]));
  });

  it("matching runs on Monday, and catches up a week that has none yet", () => {
    expect(matchupMonday("2026-11-25")).toBe(MON);
    expect(lastMonday(MON)).toBe("2026-11-16");
    expect(matchingDue({ today: MON, weekHasRows: true })).toBe(true);
    expect(matchingDue({ today: "2026-11-25", weekHasRows: true })).toBe(false);
    expect(matchingDue({ today: "2026-11-25", weekHasRows: false })).toBe(true);
  });
});

const row = (over: Partial<MatchupRow>): MatchupRow => ({
  week_monday: MON,
  club_id: "a",
  opponent_id: "b",
  roster: ["a1", "a2", "a3"],
  minutes: null,
  players: null,
  result: null,
  decided_at: null,
  ...over,
});
const log = (profile_id: string, trained_on: string, minutes: number, kind = "training"): MatchupLog => ({ profile_id, trained_on, minutes, kind });

describe("the score", () => {
  const a = row({});
  const b = row({ club_id: "b", opponent_id: "a", roster: ["b1", "b2", "b3", "b4"] });

  it("is training time in the week by the stored players, divided by how many they are", () => {
    const logs = [
      log("a1", "2026-11-23", 60),
      log("a2", "2026-11-29", 90), // Sunday still counts
      log("a1", "2026-11-25", 45, "gym"), // gym never counts
      log("a1", "2026-11-22", 600), // the Sunday before: another week
      log("a2", "2026-11-30", 600), // the Monday after: another week
      log("a9", "2026-11-24", 600), // joined after Monday: not on the stored list
    ];
    expect(sideMinutes(a, logs)).toBe(150);
    expect(perPlayerMinutes(150, 3)).toBe(50);
    expect(perPlayerMinutes(100, 3)).toBe(33);
    expect(perPlayerMinutes(0, 0)).toBe(0);
  });

  it("a player taken off mid-week still counts, and still divides", () => {
    // the stored list is what counts: nothing about today's members is read
    expect(code("lib/elite/club-matchups.ts")).not.toMatch(/club_members|membersOf/);
    const logs = [log("a3", "2026-11-24", 30)];
    expect(sideMinutes(a, logs)).toBe(30);
  });

  it("more time per player wins; equal to the minute is a draw", () => {
    expect(resultOf(50, 49)).toBe("win");
    expect(resultOf(49, 50)).toBe("loss");
    expect(resultOf(50, 50)).toBe("draw");
    // 150 over 3 players against 200 over 4: 50 each
    const logs = [log("a1", MON, 150), log("b1", MON, 200)];
    expect(decide({ a, b, logs })).toEqual([
      { club_id: "a", minutes: 150, players: 3, result: "draw" },
      { club_id: "b", minutes: 200, players: 4, result: "draw" },
    ]);
    // a smaller club that trains more each wins against a bigger total
    const more = [log("a1", MON, 180), log("b1", MON, 200)];
    expect(decide({ a, b, logs: more }).map((d) => d.result)).toEqual(["win", "loss"]);
  });

  it("a side already decided is never touched, and the other side mirrors it", () => {
    const decided = row({ minutes: 150, players: 3, result: "win", decided_at: "2026-11-30T05:00:00Z" });
    // the logs have changed since: the stored win stands
    const out = decide({ a: decided, b, logs: [log("b1", MON, 4000)] });
    expect(out).toEqual([{ club_id: "b", minutes: 4000, players: 4, result: "loss" }]);
    expect(decide({ a: decided, b: row({ club_id: "b", opponent_id: "a", minutes: 1, players: 4, result: "loss", decided_at: "x" }), logs: [] })).toEqual([]);
  });

  it("is decided only after its Sunday has ended in New York", () => {
    expect(weekIsOver(MON, "2026-11-29")).toBe(false); // Sunday
    expect(weekIsOver(MON, "2026-11-30")).toBe(true); // Monday
    const run = code("lib/elite/club-matchups-server.ts");
    expect(run).toContain('.lt("week_monday", monday)');
    // written once: the update only lands on a row not decided yet
    expect(run).toMatch(/\.update\(\{ minutes: d\.minutes, players: d\.players, result: d\.result, decided_at: at \}\)[\s\S]{0,160}\.is\("decided_at", null\)/);
  });
});

describe("the record is the club's own line", () => {
  it("counts weeks won, lost and drawn, and nothing else", () => {
    const rows = [row({ result: "win" }), row({ result: "win" }), row({ result: "loss" }), row({ result: "draw" }), row({}), row({ opponent_id: null })];
    expect(matchupRecord(rows)).toEqual({ wins: 2, losses: 1, draws: 1 });
    expect(matchupRecordLine({ wins: 3, losses: 1, draws: 0 })).toBe("Weeks won: 3. Weeks lost: 1. Draws: 0.");
  });

  it("is never mixed into the games record or the county ranking", () => {
    for (const f of ["lib/elite/club-teams.ts", "lib/elite/club-teams-server.ts", "lib/elite/tracker-ranking.ts"]) {
      expect(code(f), f).not.toMatch(/elite_club_matchups|club-matchups/);
    }
    expect(code("lib/elite/club-matchups.ts")).not.toMatch(/recordsOf|countyRanking|elite_club_plans/);
  });
});

describe("what a club's page shows", () => {
  const me = { id: "a", name: "Renegados FC", members: 5 };
  const nameOf = (id: string) => (id === "b" ? "Sunday Pickup" : "A club");
  const b = row({ club_id: "b", opponent_id: "a", roster: ["b1", "b2", "b3", "b4"] });
  const view = (over: Partial<Parameters<typeof matchupView>[0]>) =>
    matchupView({ club: me, today: "2026-11-25", rows: [], theirRows: [], nameOf, logs: [], ...over });

  it("this week's matchup: both times per player and who is ahead", () => {
    const v = view({ rows: [row({})], theirRows: [b], logs: [log("a1", MON, 216), log("b1", MON, 240)] });
    expect(v.state).toBe("on");
    expect(v.mine).toEqual({ id: "a", name: "Renegados FC", minutes: 72, time: "1h 12m" });
    expect(v.theirs).toEqual({ id: "b", name: "Sunday Pickup", minutes: 60, time: "1h" });
    expect(v.line).toBe("Your club is ahead by 12 minutes per player.");
    expect(v.cardLine).toBe("This week: Renegados FC vs Sunday Pickup.");
    expect(view({ rows: [row({})], theirRows: [b], logs: [log("b1", MON, 240)] }).line).toBe("Sunday Pickup is ahead by 60 minutes per player.");
    expect(view({ rows: [row({})], theirRows: [b] }).line).toBe("It is tied.");
  });

  it("says last week's result under this week's", () => {
    const before = row({ week_monday: "2026-11-16", minutes: 300, players: 3, result: "win", decided_at: "x" });
    const v = view({ rows: [row({}), before], theirRows: [b] });
    expect(v.last).toBe("Your club won the week.");
    expect(v.recordLine).toBe("Weeks won: 1. Weeks lost: 0. Draws: 0.");
  });

  it("after Sunday, until Monday's matching: the week as it was decided", () => {
    const before = row({ week_monday: "2026-11-16", minutes: 300, players: 3, result: "loss", decided_at: "x" });
    const theirs = row({ week_monday: "2026-11-16", club_id: "b", opponent_id: "a", roster: ["b1", "b2"], minutes: 300, players: 2, result: "win", decided_at: "x" });
    const v = view({ today: MON, rows: [before], theirRows: [theirs] });
    expect(v.state).toBe("over");
    expect(v.line).toBe("Sunday Pickup won the week.");
    expect([v.mine?.time, v.theirs?.time]).toEqual(["1h 40m", "2h 30m"]);
    expect(matchupResultLine("draw", "Sunday Pickup")).toBe("The week was a draw.");
  });

  it("the first hour of a Monday, before last week is decided: last week as it ended", () => {
    const before = row({ week_monday: "2026-11-16" });
    const theirs = row({ week_monday: "2026-11-16", club_id: "b", opponent_id: "a", roster: ["b1", "b2"] });
    const v = view({ today: MON, rows: [before], theirRows: [theirs], logs: [log("a1", "2026-11-18", 90), log("a1", MON, 500)] });
    expect(v.state).toBe("on");
    expect(v.mine?.minutes).toBe(30); // last week's training only
  });

  it("no matchup: one calm line, and which one is true", () => {
    expect(view({ rows: [row({ opponent_id: null })] })).toMatchObject({ state: "none", line: MATCHUP_NONE_LINE, mine: null, theirs: null, cardLine: null });
    expect(view({}).line).toBe(MATCHUP_SOON_LINE);
    expect(view({ club: { ...me, members: 2 } }).line).toBe(matchupSmallLine(3));
    expect(matchupSmallLine(MATCHUP_MIN_PLAYERS)).toBe("Matchups start when your club has 3 players.");
  });
});

// The owner's condition, Nov 24 2026: "as long as the user understands and
// details are written in copy an elementary schooler can understand."
describe("the words, for a 9 year old", () => {
  const all = everyMatchupSentence();
  const sentences = all.flatMap((line) => line.split(/(?<=[.?!])\s+/)).filter(Boolean);

  it("How it works is the owner's six lines", () => {
    expect(MATCHUP_HOW_LINES).toEqual([
      "Every Monday your club gets matched with another club.",
      "All week, both clubs train.",
      "We add up your club's training time. Then we split it by how many players are in your club. That is your club's time per player.",
      "On Sunday night the club with more time per player wins the week.",
      "Gym time does not count.",
      "Players who join your club this week start counting next Monday.",
    ]);
  });

  it("every sentence is 16 words or fewer", () => {
    expect(sentences.length).toBeGreaterThan(20);
    for (const s of sentences) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(16);
  });

  it("uses none of the words a 9 year old would not know", () => {
    for (const s of sentences) {
      expect(s, s).not.toMatch(/per capita|average|aggregate|roster|leaderboard|metric/i);
    }
    expect(all.join(" ")).toContain("time per player");
  });

  it("keeps the house rules: no long dash, no machinery, nothing about who did not train", () => {
    for (const s of sentences) {
      expect(s, s).not.toMatch(/[—–]/);
      expect(s, s).not.toMatch(/\b(AI|automated|algorithm)\b/i);
      expect(s, s).not.toMatch(/streak|missed|behind|did not train|has not trained|haven't trained|lazy|slacking/i);
      expect(s, s).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s, s).not.toMatch(/!/);
    }
  });

  it("says a minute as a minute", () => {
    expect(matchupAheadLine({ mine: 61, theirs: 60, other: "Sunday Pickup" })).toBe("Your club is ahead by 1 minute per player.");
    expect(matchupCardLine("Renegados FC", "Sunday Pickup")).toBe("This week: Renegados FC vs Sunday Pickup.");
  });

  it("the screens write no matchup word of their own: the website's card and the app's read the one file", () => {
    const web = code("components/elite/MatchupCard.tsx");
    expect(web).toContain('from "@/lib/elite/club-matchup-words"');
    expect(web).toContain("{matchup.line}");
    expect(web).not.toMatch(/ahead by|won the week|per player|Every Monday/);
    // the website's club page reads the same server function as the app's
    expect(read("app/(free)/log/club/[id]/page.tsx")).toContain("clubMatchupFor(viewer,");
    expect(code("lib/elite/club-app-server.ts")).toContain("matchupFor(admin,");
    expect(code("lib/elite/club-matchups-server.ts")).toMatch(/export async function clubMatchupFor[\s\S]{0,400}matchupFor\(admin, club, today\)/);
  });
});

describe("where it runs and what it writes to", () => {
  const sql = read("supabase/migrations/083_club_matchups.sql");
  const run = code("lib/elite/club-matchups-server.ts");
  const cron = code("app/api/elite/cron/weekly-plans/route.ts");

  it("the table: one row a club a week, row security on, a coach read, nobody writes directly", () => {
    expect(sql).toContain("create table if not exists public.elite_club_matchups");
    expect(sql).toContain("primary key (week_monday, club_id)");
    expect(sql).toContain("roster      uuid[] not null");
    expect(sql).toContain("check (result is null or result in ('win', 'loss', 'draw'))");
    expect(sql).toContain("alter table public.elite_club_matchups enable row level security;");
    expect(sql.match(/create policy/g)).toHaveLength(1);
    expect(sql).toContain("for select using (public.elite_is_coach())");
    expect(sql).not.toMatch(/for (insert|update|delete|all)\b/i);
    // safe to run twice, and drops nothing
    const statements = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(statements).not.toMatch(/\bdrop\b/i);
    expect(statements).toMatch(/create index if not exists/);
  });

  it("is its own step on the hourly run, after the plan builder, inside its own catch", () => {
    expect(cron).toContain("const clubMatchups = () => runClubMatchups({ authed }).catch(() => ({ status: \"failed\" as const }));");
    expect(cron.indexOf("await runPlanBuilder(")).toBeLessThan(cron.lastIndexOf("await clubMatchups()"));
    // the builder never waits on it and never sees it throw
    expect(run).toMatch(/export async function runClubMatchups[\s\S]*try \{[\s\S]*\} catch \(e\) \{/);
    expect(read("app/api/elite/cron/weekly-plans/route.ts")).toContain('export const dynamic = "force-dynamic";');
    expect(read("app/api/elite/cron/weekly-plans/route.ts")).toContain('export const fetchCache = "force-no-store";');
  });

  it("running it twice changes nothing: a row already there is left as it is", () => {
    expect(run).toContain('.upsert(rows.slice(i, i + 500), { onConflict: "week_monday,club_id", ignoreDuplicates: true })');
    // only clubs with no row this week are matched
    expect(run).toContain("!has.has(c.id)");
    // both sides of a matchup are stored by one statement: 500 is even, and pairs come first
    expect(500 % 2).toBe(0);
  });

  it("logs a run the way the builder does, and only when there was something to do", () => {
    expect(run).toContain("startCronRun({ job: CLUB_MATCHUPS_JOB");
    expect(run).toContain("finished: true");
    expect(run.indexOf("return NOTHING;")).toBeLessThan(run.indexOf("startCronRun({ job: CLUB_MATCHUPS_JOB"));
  });

  it("until 083 is applied: no card, nothing written, nothing fails", () => {
    expect(run).toContain('if (probe.error) return { ...NOTHING, status: "off" };');
    expect(run).toMatch(/if \(error\) return null;/);
    // every read across clubs and players pages through every row
    expect(run).toContain("everyRow<Club>");
    expect(run).toContain("everyRow<Member>");
    expect(run).toContain("everyRow<MatchupLog>");
  });

  it("sends no notification: the card is the pull", () => {
    expect(run).not.toMatch(/sendPush|sendSms|textCoaches|notice/);
    expect(code("lib/elite/push-texts.ts")).not.toMatch(/matchup/i);
  });
});
