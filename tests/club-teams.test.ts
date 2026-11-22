import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONFIRM_HOURS,
  COUNTIES,
  PLAY_ACCEPT_KINDS,
  ORGANIZER_SHEET_LINE,
  PENDING_GAMES_MAX,
  PLAYER_SHEET_LINE,
  PLAY_TERMS_VERSION,
  TOGETHER_MAX,
  cleanCounty,
  cleanEvent,
  cleanPlace,
  cleanPlanMinutes,
  cleanPlanTitle,
  cleanScore,
  cleanStart,
  cleanTags,
  clubsNearYou,
  countyRanking,
  entryLine,
  entryState,
  gameDecision,
  hasAccepted,
  looksLikeAddress,
  mayAddTogether,
  mayAnswerGame,
  mayAnswerScore,
  mayCancel,
  mayEnterScore,
  mayJoin,
  mayViewPlan,
  memberBlocked,
  namesShown,
  nearClubView,
  nyInstant,
  oldestAgeOn,
  openProblem,
  organizedBy,
  pendingGamesOf,
  playedOpponents,
  recordLabel,
  recordsOf,
  resultState,
  rosterProblem,
  sideOf,
  takingEntries,
  togetherAskLine,
  under18On,
  withLine,
  type PlanRow,
  type StriveEvent,
  type TeamClub,
} from "@/lib/elite/club-teams";
import { FREE_AGREEMENT_POINTS } from "@/lib/elite/tracker";

// Clubs as teams (077, Nov 22 2026). The owner's rules: it runs itself at
// scale (nothing waits on a Strive coach or a Strive event), it is low
// friction, and the liability is carried by the way it is built: closed
// groups, "Organized by" a club, a public place and never a home, the two
// one-time sheets, no messaging between clubs, results that confirm
// themselves.

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const sql = read("supabase/migrations/077_clubs_as_teams.sql");
const HOUR = 3_600_000;
const NOW = Date.parse("2026-11-22T17:00:00Z");

const club = (id: string, over: Partial<TeamClub> = {}): TeamClub => ({
  id,
  name: id,
  county: "va-prince-william",
  open: true,
  archived: false,
  members: 8,
  ...over,
});

const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: "p1",
  kind: "game",
  club_id: "A",
  opponent_id: "B",
  title: null,
  starts_at: new Date(NOW + 48 * HOUR).toISOString(),
  minutes: 60,
  place: "Braemar Park, Bristow",
  status: "on",
  score_by_club: null,
  score_club: null,
  score_opponent: null,
  score_entered_at: null,
  score_answer: null,
  ...over,
});

const played = (over: Partial<PlanRow>): PlanRow =>
  plan({ starts_at: new Date(NOW - 72 * HOUR).toISOString(), score_by_club: "A", score_entered_at: new Date(NOW - 70 * HOUR).toISOString(), ...over });

describe("counties", () => {
  it("is a fixed list of the DMV: Virginia, Maryland and DC, each once, in the shape the database holds", () => {
    const ids = COUNTIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const shape = /^(dc|md|va)-[a-z0-9-]{2,40}$/;
    for (const id of ids) expect(id).toMatch(shape);
    expect(sql).toContain("county ~ '^(dc|md|va)-[a-z0-9-]{2,40}$'");
    expect(new Set(COUNTIES.map((c) => c.state))).toEqual(new Set(["DC", "MD", "VA"]));
    expect(COUNTIES.filter((c) => c.state === "MD")).toHaveLength(24); // 23 counties and Baltimore City
    for (const id of ["va-prince-william", "va-fairfax-county", "va-loudoun", "va-manassas", "md-baltimore-city", "md-montgomery", "md-howard", "dc-washington"]) {
      expect(ids).toContain(id);
    }
  });

  it("takes only an id from the list, never typed text", () => {
    expect(cleanCounty("va-prince-william")).toBe("va-prince-william");
    expect(cleanCounty("Prince William")).toBeNull();
    expect(cleanCounty("va-nowhere")).toBeNull();
    expect(cleanCounty(null)).toBeNull();
  });
});

describe("clubs near you", () => {
  const mine = club("mine");
  const clubs = [
    club("Haymarket"),
    club("Bristow"),
    club("Closed", { open: false }),
    club("Ended", { archived: true }),
    club("Fairfax", { county: "va-fairfax-county" }),
    mine,
  ];

  it("shows only other clubs in the same county that opted in, never one that ended, never itself", () => {
    const ids = clubsNearYou({ mine, clubs, records: new Map() }).map((c) => c.id);
    expect(ids).toEqual(["Bristow", "Haymarket"]);
  });

  it("puts ranked clubs first, in their order", () => {
    const records = recordsOf([played({ club_id: "Haymarket", opponent_id: "Bristow", score_club: 3, score_opponent: 1, score_answer: "confirmed" })], NOW);
    expect(clubsNearYou({ mine, clubs, records }).map((c) => c.id)).toEqual(["Haymarket", "Bristow"]);
  });

  it("a club with no county sees nobody", () => {
    expect(clubsNearYou({ mine: club("x", { county: null }), clubs, records: new Map() })).toEqual([]);
  });

  it("carries a club's name, record and player count and nothing about any player", () => {
    expect(Object.keys(nearClubView(club("H"), new Map())).sort()).toEqual(["id", "members", "name", "record"]);
  });

  it("is for the club's captain only, and reads only clubs that opted in", () => {
    const server = read("lib/elite/club-teams-server.ts");
    const near = server.slice(server.indexOf("export async function nearYouFor("));
    expect(near).toContain("row.captain_id !== viewer.profile.id");
    expect(server).toMatch(/\.eq\("open_to_games", true\)/);
  });
});

describe("planning a game", () => {
  const ok = { viewerIsCaptain: true, from: club("A"), to: club("B"), pendingFrom: 0 };

  it("captain only, same county, the other club open, neither ended", () => {
    expect(gameDecision(ok)).toBe("ok");
    expect(gameDecision({ ...ok, viewerIsCaptain: false })).toBe("not_captain");
    expect(gameDecision({ ...ok, to: club("A") })).toBe("self");
    expect(gameDecision({ ...ok, to: club("B", { open: false }) })).toBe("not_open");
    expect(gameDecision({ ...ok, to: club("B", { county: "md-howard" }) })).toBe("other_county");
    expect(gameDecision({ ...ok, from: club("A", { county: null }) })).toBe("no_county");
    expect(gameDecision({ ...ok, to: club("B", { archived: true }) })).toBe("ended");
  });

  it(`a club has ${PENDING_GAMES_MAX} game requests waiting at most, in code and in the database`, () => {
    expect(PENDING_GAMES_MAX).toBe(3);
    expect(gameDecision({ ...ok, pendingFrom: 3 })).toBe("too_many");
    expect(pendingGamesOf([plan({ status: "pending" }), plan({ status: "pending" }), plan({ status: "on" }), plan({ kind: "training", opponent_id: null })], "A")).toBe(2);
    expect(sql).toMatch(/kind = 'game' and status = 'pending'\) >= 3/);
  });

  it("a club already played can be sent another game whatever its switch says now", () => {
    expect(gameDecision({ ...ok, to: club("B", { open: false }), playedBefore: true })).toBe("ok");
    expect(gameDecision({ ...ok, to: club("B", { archived: true }), playedBefore: true })).toBe("ended");
    expect(playedOpponents([plan(), plan({ id: "p2", club_id: "C", opponent_id: "A" }), plan({ id: "p3", opponent_id: "D", status: "passed" })], "A").sort()).toEqual(["B", "C"]);
  });

  it("the other captain answers a request; nobody else", () => {
    const p = plan({ status: "pending" });
    expect(mayAnswerGame(p, new Set(["B"]))).toBe(true);
    expect(mayAnswerGame(p, new Set(["A"]))).toBe(false);
    expect(mayAnswerGame(plan({ status: "on" }), new Set(["B"]))).toBe(false);
  });

  it("a plan starts in the next 60 days, runs a length from the list, and a title is optional and filtered", () => {
    expect(cleanStart(new Date(NOW + HOUR).toISOString(), NOW)).not.toBeNull();
    expect(cleanStart(new Date(NOW - HOUR).toISOString(), NOW)).toBeNull();
    expect(cleanStart(new Date(NOW + 61 * 24 * HOUR).toISOString(), NOW)).toBeNull();
    expect(cleanPlanMinutes(60)).toBe(60);
    expect(cleanPlanMinutes(61)).toBeNull();
    expect(cleanPlanTitle("")).toBeNull();
    expect(cleanPlanTitle("Weak foot and finishing")).toBe("Weak foot and finishing");
    expect(cleanPlanTitle("see www.example.com")).toBeNull();
  });

  it("a New York wall time becomes the right instant in winter and in summer", () => {
    expect(nyInstant("2026-12-05", "18:30")).toBe("2026-12-05T23:30:00.000Z");
    expect(nyInstant("2027-06-05", "18:30")).toBe("2027-06-05T22:30:00.000Z");
    expect(nyInstant("2026-12-5", "18:30")).toBeNull();
  });
});

describe("the place: a public field or park, never a home", () => {
  it("takes a field or park and its town", () => {
    for (const ok of ["Braemar Park, Bristow", "Catharpin Park", "St. Mary's Park", "Field 3, Bull Run Regional Park", "Fairfax HS turf"]) {
      expect(cleanPlace(ok), ok).toBe(ok);
    }
  });

  it("refuses anything that looks like a street address", () => {
    for (const bad of [
      "12 Oak St",
      "4410 Bristow Rd, Bristow",
      "123 Main",
      "9 Elm Court",
      "Field by 4410 Bristow Rd",
      "The park at 15 Maple Avenue",
      "22b Baker Street",
      "7 Sunset Way",
    ]) {
      expect(looksLikeAddress(bad), bad).toBe(true);
      expect(cleanPlace(bad), bad).toBeNull();
    }
  });

  it("refuses links, handles, phone numbers and long runs of digits, and the word filter", () => {
    for (const bad of ["www.myfield.com", "https://x.co", "@coachmike", "Park 703 555 1234", "Zip 20155", "a", "x".repeat(61)]) {
      expect(cleanPlace(bad), bad).toBeNull();
    }
    expect(read("lib/elite/club-teams.ts")).toMatch(/if \(isOffensive\(place\)\) return null;/);
  });

  it("the database holds the length too, and the hint says never a home", () => {
    expect(sql).toContain("place            text not null check (char_length(place) between 2 and 60)");
    expect(read("components/elite/PlanForm.tsx")).toContain("{PLACE_HINT}");
  });
});

describe("closed groups only", () => {
  const training = plan({ kind: "training", opponent_id: null });
  const clubsOf = (...ids: string[]) => ({ clubIds: new Set(ids), staff: false });

  it("a club's training is seen by its members only", () => {
    expect(mayViewPlan(training, clubsOf("A"))).toBe(true);
    expect(mayViewPlan(training, clubsOf("B"))).toBe(false);
    expect(mayViewPlan(training, clubsOf())).toBe(false);
  });

  it("a game is seen by the two clubs once accepted, by the organizing club while it waits, by nobody else", () => {
    expect(mayViewPlan(plan({ status: "pending" }), clubsOf("A"))).toBe(true);
    expect(mayViewPlan(plan({ status: "pending" }), clubsOf("B"))).toBe(false);
    expect(mayViewPlan(plan(), clubsOf("B"))).toBe(true);
    expect(mayViewPlan(plan(), clubsOf("C"))).toBe(false);
    expect(mayViewPlan(plan(), { clubIds: new Set(), staff: true })).toBe(true);
  });

  it("only members of the clubs in it can say they're in, while it is on and not over", () => {
    expect(mayJoin(plan(), new Set(["A"]), NOW)).toBe(true);
    expect(mayJoin(plan(), new Set(["B"]), NOW)).toBe(true);
    expect(mayJoin(plan(), new Set(["C"]), NOW)).toBe(false);
    expect(mayJoin(plan({ status: "pending" }), new Set(["A"]), NOW)).toBe(false);
    expect(mayJoin(plan({ status: "cancelled" }), new Set(["A"]), NOW)).toBe(false);
    expect(mayJoin(plan({ starts_at: new Date(NOW - 2 * HOUR).toISOString() }), new Set(["A"]), NOW)).toBe(false);
    expect(sideOf(plan(), new Set(["B"]))).toBe("B");
    expect(sideOf(plan(), new Set(["A", "B"]))).toBe("A");
  });

  it("names are shown only to members of the same club, never across a block; everyone else is a count", () => {
    const ins = [
      { profile_id: "me", club_id: "A" },
      { profile_id: "mate", club_id: "A" },
      { profile_id: "blocked", club_id: "A" },
      { profile_id: "rival", club_id: "B" },
    ];
    const shown = namesShown(ins, { id: "me", clubIds: new Set(["A"]), blocks: [{ blocker: "blocked", blocked: "me" }] }).map((i) => i.profile_id);
    expect(shown).toEqual(["me", "mate"]);
  });

  it("every plan the server hands out passes mayViewPlan, whatever was asked for", () => {
    const server = read("lib/elite/club-teams-server.ts");
    const cards = server.slice(server.indexOf("async function cardsFor("));
    expect(cards.slice(0, 600)).toContain("plans.filter((p) => mayViewPlan(p, { clubIds, staff }))");
    expect(server).toContain("const [card] = await cardsFor(admin, viewer, [plan], nowMs);");
  });

  it("there is no messaging between clubs and nothing is texted to a player", () => {
    const actions = read("lib/elite/club-teams-actions.ts");
    expect(actions).not.toMatch(/sendSms|sendPlayerOwnSMS|sendPushToPlayer|elite_messages/);
    expect(sql).not.toMatch(/create table[^;]*message/i);
  });
});

describe("not the organizer", () => {
  it("every session and game says which club organized it, never Strive", () => {
    expect(organizedBy("Renegados FC")).toBe("Organized by Renegados FC");
    for (const f of ["components/elite/PlanCardView.tsx", "components/elite/PlanDetail.tsx", "components/elite/PlanForm.tsx"]) {
      expect(read(f), f).toContain("organizedBy(");
    }
    expect(read("lib/elite/club-teams.ts")).not.toMatch(/organized by Strive|Organized by Strive/);
  });

  it("the two sheets say it plainly, and each acceptance is recorded with its version", () => {
    expect(ORGANIZER_SHEET_LINE).toContain("Strive doesn't run or supervise games or sessions planned in the app");
    expect(ORGANIZER_SHEET_LINE).toContain("public place");
    expect(PLAYER_SHEET_LINE).toContain("organized by players, not by Strive");
    expect(PLAYER_SHEET_LINE).toContain("at your own risk");
    expect(PLAYER_SHEET_LINE).toContain("Under 18? Tell a parent or guardian where and when you're playing.");
    expect(PLAY_ACCEPT_KINDS).toEqual(["organizer", "player"]);
    expect(sql).toContain("kind        text not null check (kind in ('organizer', 'player'))");
    expect(sql).toContain("unique (profile_id, kind, version)");
    expect(hasAccepted([{ kind: "organizer", version: PLAY_TERMS_VERSION }], "organizer")).toBe(true);
    expect(hasAccepted([{ kind: "organizer", version: "2000-01-01" }], "organizer")).toBe(false);
    expect(hasAccepted([{ kind: "player", version: PLAY_TERMS_VERSION }], "organizer")).toBe(false);
  });

  it("nothing is planned before the organizer sheet, and nobody is in before the player sheet", () => {
    const actions = read("lib/elite/club-teams-actions.ts");
    const fn = (name: string) => {
      const at = actions.indexOf(`export async function ${name}(`);
      return actions.slice(at, actions.indexOf("\nexport ", at + 10));
    };
    for (const name of ["planTraining", "planGame"]) {
      const body = fn(name);
      expect(body.indexOf("NEEDS_ORGANIZER_OK"), name).toBeGreaterThan(-1);
      expect(body.indexOf("NEEDS_ORGANIZER_OK"), name).toBeLessThan(body.indexOf(".insert("));
    }
    const join = fn("setImIn");
    expect(join.indexOf("NEEDS_PLAYER_OK")).toBeGreaterThan(-1);
    expect(join.indexOf("NEEDS_PLAYER_OK")).toBeLessThan(join.indexOf(".upsert("));
    expect(fn("acceptPlayTerms")).toContain('.from("elite_play_acceptances")');
  });

  it("the Terms, the free agreement and the Privacy Policy say who organizes and who sees what", () => {
    const terms = read("app/terms/page.tsx");
    expect(terms).toContain("does not organize, run, supervise or insure any session or");
    expect(terms).toContain("at their own risk");
    expect(terms).toContain("responsible for");
    expect(terms).toContain("A parent or");
    expect(terms).toContain("happens only at Strive");
    expect(terms).toContain("NEEDS A LAWYER'S READ");
    expect(FREE_AGREEMENT_POINTS.join(" ")).toContain("organized by players, not by Strive");
    const privacy = read("app/privacy/page.tsx");
    expect(privacy).toContain("visible to the captains of other clubs in that county");
  });
});

describe("the result", () => {
  const entered = (hoursAgo: number, answer: PlanRow["score_answer"] = null) =>
    played({ score_club: 4, score_opponent: 2, score_entered_at: new Date(NOW - hoursAgo * HOUR).toISOString(), score_answer: answer });

  it(`counts once the other captain confirms, or after ${CONFIRM_HOURS} hours with no answer; never when disputed`, () => {
    expect(CONFIRM_HOURS).toBe(24);
    expect(resultState(plan(), NOW)).toBe("none");
    expect(resultState(entered(1), NOW)).toBe("waiting");
    expect(resultState(entered(23.99), NOW)).toBe("waiting");
    expect(resultState(entered(24), NOW)).toBe("confirmed");
    expect(resultState(entered(1, "confirmed"), NOW)).toBe("confirmed");
    expect(resultState(entered(100, "disputed"), NOW)).toBe("disputed");
  });

  it("either captain enters it once the game has started, once; only the other captain answers, within the window", () => {
    const started = plan({ starts_at: new Date(NOW - HOUR).toISOString() });
    expect(mayEnterScore(plan(), new Set(["A"]), NOW)).toBe(false); // not started
    expect(mayEnterScore(started, new Set(["A"]), NOW)).toBe(true);
    expect(mayEnterScore(started, new Set(["B"]), NOW)).toBe(true);
    expect(mayEnterScore(started, new Set(["C"]), NOW)).toBe(false);
    expect(mayEnterScore(entered(1), new Set(["A"]), NOW)).toBe(false); // already entered
    expect(mayEnterScore(plan({ kind: "training", opponent_id: null, starts_at: started.starts_at }), new Set(["A"]), NOW)).toBe(false);
    expect(mayAnswerScore(entered(1), new Set(["B"]), NOW)).toBe(true);
    expect(mayAnswerScore(entered(1), new Set(["A"]), NOW)).toBe(false); // the one who entered it
    expect(mayAnswerScore(entered(25), new Set(["B"]), NOW)).toBe(false); // it counted already
    expect(cleanScore("4")).toBe(4);
    expect(cleanScore("100")).toBeNull();
    expect(cleanScore("")).toBeNull();
  });

  it("records count confirmed results only, a draw included", () => {
    const records = recordsOf(
      [
        entered(1, "confirmed"), // A beats B
        played({ id: "x2", club_id: "B", opponent_id: "A", score_club: 1, score_opponent: 1, score_answer: "confirmed" }), // draw
        played({ id: "x3", club_id: "A", opponent_id: "C", score_club: 0, score_opponent: 5, score_entered_at: new Date(NOW - 30 * HOUR).toISOString() }), // auto
        played({ id: "x4", club_id: "A", opponent_id: "D", score_club: 9, score_opponent: 0, score_answer: "disputed" }), // not counted
        { ...entered(2), id: "x5" }, // still waiting
        { ...entered(1, "confirmed"), id: "x6", status: "cancelled" as const }, // called off
      ],
      NOW
    );
    expect(records.get("A")).toEqual({ wins: 1, losses: 1, draws: 1, played: 3 });
    expect(records.get("B")).toEqual({ wins: 0, losses: 1, draws: 1, played: 2 });
    expect(records.get("C")).toEqual({ wins: 1, losses: 0, draws: 0, played: 1 });
    expect(records.has("D")).toBe(false);
    expect(recordLabel(records.get("A")!)).toBe("1-1-1");
    expect(recordLabel({ wins: 4, losses: 1, draws: 0, played: 5 })).toBe("4-1");
    expect(recordLabel({ wins: 0, losses: 0, draws: 0, played: 0 })).toBe("New");
  });

  it("the county ranking: most wins, then fewer losses, then name; clubs with a game only", () => {
    const records = new Map([
      ["b", { wins: 5, losses: 1, draws: 0, played: 6 }],
      ["a", { wins: 5, losses: 1, draws: 0, played: 6 }],
      ["c", { wins: 5, losses: 0, draws: 0, played: 5 }],
      ["d", { wins: 2, losses: 0, draws: 0, played: 2 }],
    ]);
    const rows = countyRanking({
      clubs: [club("a", { name: "Alpha" }), club("b", { name: "Bravo" }), club("c", { name: "Charlie" }), club("d", { name: "Delta" }), club("e", { name: "Echo" }), club("f", { name: "Far", county: "md-howard" })],
      county: "va-prince-william",
      records,
      mine: new Set(["a"]),
    });
    expect(rows.map((r) => [r.place, r.id])).toEqual([
      [1, "c"],
      [2, "a"],
      [3, "b"],
      [4, "d"],
    ]);
    expect(rows[1].mine).toBe(true);
  });

  it("nothing waits on a coach: no coach score, no queue for a disputed result", () => {
    const actions = read("lib/elite/club-teams-actions.ts");
    expect(actions).not.toMatch(/recordScore|voidChallenge|attachChallenge/);
    expect(sql).not.toMatch(/challenge/i);
  });
});

describe("cancelling and reporting", () => {
  it("a captain of a club in it calls it off before it starts; a coach any time", () => {
    const who = (ids: string[], staff = false) => ({ captainOf: new Set(ids), staff });
    expect(mayCancel(plan(), who(["A"]), NOW)).toBe(true);
    expect(mayCancel(plan(), who(["B"]), NOW)).toBe(true);
    expect(mayCancel(plan({ status: "pending" }), who(["B"]), NOW)).toBe(false);
    expect(mayCancel(plan(), who(["C"]), NOW)).toBe(false);
    expect(mayCancel(plan({ starts_at: new Date(NOW - HOUR).toISOString() }), who(["A"]), NOW)).toBe(false);
    expect(mayCancel(plan({ starts_at: new Date(NOW - HOUR).toISOString() }), who([], true), NOW)).toBe(true);
    expect(mayCancel(plan({ status: "cancelled" }), who([], true), NOW)).toBe(false);
  });

  it("a report needs a player who can see it, and goes to the coach queue", () => {
    const actions = read("lib/elite/club-teams-actions.ts");
    const report = actions.slice(actions.indexOf("export async function reportPlan("));
    expect(report.indexOf("mayViewPlan(")).toBeLessThan(report.indexOf('.from("elite_plan_reports")'));
    expect(read("components/elite/TeamsAdmin.tsx")).toContain("cancelPlanAsCoach(p.id)");
    expect(read("app/(coach)/coach/free/page.tsx")).toContain("<TeamsAdmin data={teams} />");
  });
});

describe("Strive events", () => {
  const event: StriveEvent = {
    id: "e",
    name: "Strive Winter 5v5",
    starts_at: "2027-01-23T23:00:00.000Z",
    venue: "A venue",
    price_text: "$450 a team",
    roster_max: 3,
    max_age: 21,
    payment_url: "https://pay.example.com/x",
    waiver_url: "https://example.com/waiver",
    open: true,
  };

  it("a coach's event is checked field by field; links are https only", () => {
    const base = { name: "Strive Winter 5v5", startsAt: "2027-01-23T23:00:00.000Z", venue: "A venue", price: "$450", rosterMax: 9, maxAge: 21, paymentUrl: "https://pay.example.com" };
    expect(cleanEvent(base).ok).toBe(true);
    expect(cleanEvent({ ...base, paymentUrl: "http://pay.example.com" }).ok).toBe(false);
    expect(cleanEvent({ ...base, waiverUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(cleanEvent({ ...base, rosterMax: 0 }).ok).toBe(false);
  });

  it("an event cannot open without its waiver link, in code and in the database", () => {
    expect(openProblem({ ...event, waiver_url: null }, NOW)).toMatch(/waiver/);
    expect(openProblem(event, NOW)).toBeNull();
    expect(takingEntries({ ...event, waiver_url: null }, NOW)).toBe(false);
    expect(sql).toContain("check (not open or waiver_url is not null)");
  });

  it("a roster: up to its size, members only, at or under the age limit (checked the strict way), on one roster per event", () => {
    const members = [
      { id: "a", birth: { month: 3, year: 2010 } },
      { id: "b", birth: { month: 1, year: 2005 } }, // 22 in January 2027
      { id: "c", birth: { month: 1, year: 2006 } }, // 20 or 21 on Jan 23, depending on the day
      { id: "d", birth: null },
      { id: "e", birth: { month: 6, year: 2009 } },
    ];
    const none = new Set<string>();
    expect(rosterProblem({ picked: ["a"], members, event, onOtherRosters: none })).toBeNull();
    expect(rosterProblem({ picked: [], members, event, onOtherRosters: none })).toEqual({ kind: "empty" });
    expect(rosterProblem({ picked: ["a", "e", "x", "y"], members, event, onOtherRosters: none })).toEqual({ kind: "too_many", max: 3 });
    expect(rosterProblem({ picked: ["zz"], members, event, onOtherRosters: none })).toEqual({ kind: "not_member" });
    expect(rosterProblem({ picked: ["b"], members, event, onOtherRosters: none })).toEqual({ kind: "too_old", id: "b", max: 21 });
    expect(rosterProblem({ picked: ["d"], members, event, onOtherRosters: none })).toEqual({ kind: "no_birth", id: "d" });
    expect(rosterProblem({ picked: ["a"], members, event, onOtherRosters: new Set(["a"]) })).toEqual({ kind: "taken", id: "a" });
    expect(oldestAgeOn({ month: 1, year: 2005 }, "2027-01-23")).toBe(22);
    // with only a month and a year, the age limit counts the oldest the
    // player could be: born January 2006 could be 21 on Jan 23 2027
    expect(memberBlocked(members[2], event, none)).toBeNull();
    expect(memberBlocked(members[2], { ...event, max_age: 20 }, none)).toBe("Over 20");
    expect(sql).toContain("unique (event_id, profile_id)");
  });

  it("nothing says a spot is held before it is paid; every player says they're in first", () => {
    expect(entryState({ roster: [{ in_at: null }, { in_at: "x" }], sent_at: null, paid_at: null })).toBe("waiting");
    expect(entryState({ roster: [{ in_at: "x" }], sent_at: null, paid_at: null })).toBe("sent");
    expect(entryState({ roster: [{ in_at: "x" }], sent_at: "x", paid_at: "x" })).toBe("paid");
    expect(entryLine("waiting", 2)).toBe("Waiting on 2 players to say they're in.");
    expect(entryLine("sent", 0)).toBe("Entered. Pay to lock your spot.");
    expect(entryLine("paid", 0)).toBe("Spot locked.");
    expect(entryLine("sent", 0)).not.toMatch(/held|locked/);
  });

  it("each I'm in records the waiver accepted; under 18 is told to show a parent", () => {
    expect(under18On({ month: 3, year: 2010 }, "2027-01-23")).toBe(true);
    expect(under18On({ month: 1, year: 2000 }, "2027-01-23")).toBe(false);
    expect(under18On(null, "2027-01-23")).toBe(true);
    const actions = read("lib/elite/club-teams-actions.ts");
    const answer = actions.slice(actions.indexOf("export async function answerRoster("));
    expect(answer.indexOf('.from("elite_event_waivers").insert(')).toBeLessThan(answer.indexOf("in_at: new Date().toISOString()"));
    expect(answer).toContain("waiver_url: event.waiver_url");
    expect(read("components/elite/TeamRequests.tsx")).toContain("WAIVER_MINOR_LINE");
  });

  it("the Dec 19 5v5 is not created as an event (it stays on its form)", () => {
    expect(sql).not.toMatch(/insert into public\.elite_strive_events/i);
  });
});

describe("trained together", () => {
  const teammates = new Set(["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9"]);

  it("tags clubmates only, never the poster, never across a block, each once, eight at most", () => {
    expect(cleanTags({ raw: "t1,t2,t1,me,stranger", posterId: "me", teammates, blocks: [] })).toEqual(["t1", "t2"]);
    expect(cleanTags({ raw: ["t1", "t2"], posterId: "me", teammates, blocks: [{ blocker: "t2", blocked: "me" }] })).toEqual(["t1"]);
    expect(cleanTags({ raw: [...teammates], posterId: "me", teammates, blocks: [] })).toHaveLength(TOGETHER_MAX);
    expect(TOGETHER_MAX).toBe(8);
    expect(sql).toMatch(/where log_id = new\.log_id\) >= 8/);
  });

  it("a card is for the tagged player only, once, within the week", () => {
    const tag = { tagged: "me", answer: null };
    expect(mayAddTogether({ tag, viewerId: "me", day: "2026-11-20", today: "2026-11-22" })).toBe(true);
    expect(mayAddTogether({ tag, viewerId: "other", day: "2026-11-20", today: "2026-11-22" })).toBe(false);
    expect(mayAddTogether({ tag: { ...tag, answer: "added" }, viewerId: "me", day: "2026-11-20", today: "2026-11-22" })).toBe(false);
    expect(mayAddTogether({ tag, viewerId: "me", day: "2026-11-10", today: "2026-11-22" })).toBe(false);
  });

  it("adding goes through the usual logging path, so the day's 8 hours and the gym rule hold", () => {
    const actions = read("lib/elite/club-teams-actions.ts");
    const add = actions.slice(actions.indexOf("export async function answerTogether("));
    expect(add.indexOf("mayLog(log.kind, tracker.grade)")).toBeLessThan(add.indexOf("insertLog("));
    expect(add).toContain("DAY_CAP_MESSAGE");
    expect(add).not.toMatch(/\.from\("elite_training_logs"\)\s*\.insert/);
  });

  it("the lines read as plain words, with no place in them", () => {
    expect(togetherAskLine("Marcus Bell", 60, "training")).toBe("Marcus says you trained together, 1h. Add it to your week?");
    expect(withLine(["Diego", "Nico"])).toBe("with Diego, Nico");
    expect(withLine(["Diego"], 2)).toBe("with Diego and 2 more");
    expect(withLine([], 0)).toBeNull();
  });
});

describe("the database", () => {
  const tables = [
    "elite_club_plans",
    "elite_plan_ins",
    "elite_play_acceptances",
    "elite_plan_reports",
    "elite_strive_events",
    "elite_event_entries",
    "elite_event_roster",
    "elite_event_waivers",
    "elite_trained_together",
  ];

  it("row security is on for every new table", () => {
    for (const t of tables) expect(sql, t).toContain(`alter table public.${t} enable row level security;`);
  });

  it("no write policy anywhere: the only policies are coach reads", () => {
    expect(sql).not.toMatch(/for (insert|update|delete|all)\b/i);
    expect(sql).toContain("for select using (public.elite_is_coach())");
    for (const t of tables) expect(sql).toContain(`'${t}'`);
  });

  it("is written to run twice and drops nothing that holds data", () => {
    expect(sql).not.toMatch(/drop table|drop column|truncate/i);
    expect((sql.match(/create table if not exists/g) ?? []).length).toBe(tables.length);
  });

  it("a training session has no other club and no score; a game has another club", () => {
    expect(sql).toContain("check ((kind = 'training') = (opponent_id is null))");
    expect(sql).toContain("check (kind = 'game' or score_entered_at is null)");
  });
});
