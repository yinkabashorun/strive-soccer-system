import type {
  AppClubAnswer,
  AppClubCard,
  AppClubNear,
  AppClubPage,
  AppClubTile,
  AppClubs,
  ClubMemberRow,
  MatchupView,
  PlanCard,
} from "@shared/app-contract";
import { cardRace, clubShareText, clubWeek, splitPlans } from "@shared/club-app";
import { CLUB_GAMES_IN_APP, clubPageForApp, waitingForApp } from "@shared/club-games";
import { matchupAheadLine, matchupCardLine, matchupRecordLine, matchupResultLine, MATCHUP_NONE_LINE } from "@shared/club-matchup-words";
import { gamesRecordLine, resultLine } from "@shared/club-teams";
import { fmtDuration } from "@shared/time-trained";
import { clubRequestSentLine, initialsOf } from "@shared/tracker";
import { MEDIA_BASE } from "@/config";

// The example clubs the Clubs screens are drawn with for review
// screenshots (EXPO_PUBLIC_FIXTURES=1), answered here in place of the
// server. Never the build that goes to TestFlight.
//
// Every club and every player is made up, and every picture is a still of
// one of our own drill clips standing in for a profile photo or a training
// photo. No real club, no real logo, no real person.
//
//   Renegados FC    Marcus is a member. A week under way, a matchup that
//                   is on, a session to say "I'm in" to, this week's
//                   photos (today's locked until he posts).
//   Sunday Pickup   Marcus is the captain. A player asking to join, a game
//                   another club sent, a score to confirm, and no matchup
//                   this week.
//   Gainesville HS  opened by its own route only: a week that is decided
//                   ("Your club won the week.").
//
// What is tapped is kept in memory until the app is closed.
const m = (file: string) => `${MEDIA_BASE}/drills/posters/${file}.jpg`;
const TODAY = "2026-11-24";

const PEOPLE = {
  diego: { id: "f-diego", name: "Diego R.", photo: m("weak-foot-pop-and-juggle") },
  nico: { id: "f-nico", name: "Nico A.", photo: m("two-touch-ball-mastery-v1") },
  jalen: { id: "f-jalen", name: "Jalen T.", photo: m("speed-kneel-and-drive") },
  kai: { id: "f-kai", name: "Kai M.", photo: m("plyo-broad-jumps") },
} as const;

type Ctx = { mePhoto: string; posted: boolean };

const live = {
  organizerOk: false,
  playerOk: false,
  ins: new Set<string>(),
  answered: new Set<string>(),
  started: null as { name: string; county: string | null } | null,
};

type Seed = { key: keyof typeof PEOPLE | "me"; minutes: number; today?: boolean; captain?: boolean; starred?: boolean };

// The members as the server would rank them: most training first, one
// place each; a member with nothing yet this week after them, no place.
function members(seeds: Seed[], ctx: Ctx): ClubMemberRow[] {
  const rows = seeds.map((s) => {
    const me = s.key === "me";
    const p = me ? { id: "me", name: "Marcus B.", photo: ctx.mePhoto } : PEOPLE[s.key as keyof typeof PEOPLE];
    const minutes = s.minutes + (me && ctx.posted ? 45 : 0);
    return { ...p, me, minutes, today: me ? ctx.posted : Boolean(s.today), captain: Boolean(s.captain), starred: Boolean(s.starred) };
  });
  const ranked = rows.filter((r) => r.minutes > 0).sort((x, y) => y.minutes - x.minutes || x.name.localeCompare(y.name));
  const rest = rows.filter((r) => r.minutes === 0).sort((x, y) => x.name.localeCompare(y.name));
  return [...ranked, ...rest].map((r, i) => ({
    id: r.id,
    name: r.name,
    initials: initialsOf(r.name),
    photo: r.photo,
    you: r.me,
    captain: r.captain,
    starred: r.starred,
    place: r.minutes > 0 ? i + 1 : null,
    time: r.minutes > 0 ? fmtDuration(r.minutes) : null,
    today: r.today,
  }));
}

const totalOf = (seeds: Seed[], ctx: Ctx) => seeds.reduce((s, x) => s + x.minutes, 0) + (ctx.posted && seeds.some((x) => x.key === "me") ? 45 : 0);

function plan(over: Partial<PlanCard> & Pick<PlanCard, "id" | "organizer">): PlanCard {
  return {
    kind: "training",
    title: null,
    opponent: null,
    when: "Thu, Nov 26, 6:00 PM",
    minutes: 60,
    place: "Braemar Park, Bristow",
    status: "on",
    started: false,
    ins: 0,
    names: [],
    imIn: false,
    canJoin: true,
    canCancel: false,
    canAnswer: false,
    result: null,
    ...over,
  };
}

const RENEGADOS = { id: "c-renegados", name: "Renegados FC" };
const PICKUP = { id: "c-pickup", name: "Sunday Pickup" };
const GAINESVILLE = { id: "c-gainesville", name: "Gainesville HS" };
const HAYMARKET = { id: "n-haymarket", name: "Haymarket 08s" };
const CATHARPIN = { id: "n-catharpin", name: "Catharpin Crew" };
const BRISTOW = { id: "n-bristow", name: "Bristow Boys" };
const NORTHSIDE = { id: "n-northside", name: "North Side FC" };

const RENEGADOS_SEEDS: Seed[] = [
  { key: "diego", minutes: 195, today: true, captain: true, starred: true },
  { key: "nico", minutes: 150, today: true },
  { key: "me", minutes: 120 },
  { key: "jalen", minutes: 90 },
  { key: "kai", minutes: 0 },
];
const PICKUP_SEEDS: Seed[] = [
  { key: "me", minutes: 120, captain: true },
  { key: "jalen", minutes: 90 },
  { key: "nico", minutes: 150, today: true },
  { key: "kai", minutes: 0 },
];
const GAINESVILLE_SEEDS: Seed[] = [
  { key: "diego", minutes: 195, today: true },
  { key: "me", minutes: 120, captain: true },
  { key: "kai", minutes: 60 },
];

function matchupOn(mine: { id: string; name: string }, theirs: { id: string; name: string }, perMine: number, perTheirs: number, record: { wins: number; losses: number; draws: number }): MatchupView {
  return {
    state: "on",
    mine: { ...mine, minutes: perMine, time: fmtDuration(perMine) },
    theirs: { ...theirs, minutes: perTheirs, time: fmtDuration(perTheirs) },
    line: matchupAheadLine({ mine: perMine, theirs: perTheirs, other: theirs.name, club: mine.name, seed: `${mine.id}:example` }),
    last: matchupResultLine("win", CATHARPIN.name),
    cardLine: matchupCardLine(mine.name, theirs.name),
    recordLine: matchupRecordLine(record),
    // last week was won: the gold mark for this week
    champs: true,
  };
}

function photos(ctx: Ctx): AppClubTile[] {
  const open = (id: string, first: string, file: string, time: string, mine = false): AppClubTile => ({ state: "open", id, first, mine, time, photoUrl: m(file) });
  const today: AppClubTile[] = ctx.posted
    ? [open("t-me", "You", "weak-foot-tap-pull-push", "45m", true), open("t-diego", "Diego", "wall-pass-touch-stepover", "1h 15m"), open("t-nico", "Nico", "l-turn-roll-touch", "45m")]
    : [
        { state: "locked", id: "t-diego", first: "Diego", initials: "DR", photo: PEOPLE.diego.photo, time: "1h 15m" },
        { state: "locked", id: "t-nico", first: "Nico", initials: "NA", photo: PEOPLE.nico.photo, time: "45m" },
      ];
  return [
    ...today,
    open("t-jalen-y", "Jalen", "speed-zigzag-sprint", "1h"),
    open("t-diego-y", "Diego", "juggling-thighs-high", "1h"),
    open("t-me-y", "You", "two-touch-passing", "2h", true),
    open("t-nico-y", "Nico", "triangle-turning", "1h 45m"),
  ];
}

function page(id: string, ctx: Ctx): AppClubPage | null {
  const base = { today: TODAY, ended: false, byCoach: false, county: "va-prince-william", countyName: "Prince William County", accepted: { organizer: live.organizerOk, player: live.playerOk } };
  const share = (club: { name: string }, code: string) => ({ code, link: `https://thestriveapp.com/join?club=${code}`, text: clubShareText({ name: club.name, code, appUrl: "https://thestriveapp.com" }) });

  if (id === RENEGADOS.id) {
    const total = totalOf(RENEGADOS_SEEDS, ctx);
    const per = Math.round(total / RENEGADOS_SEEDS.length);
    const training = plan({
      id: "p-finishing",
      organizer: RENEGADOS,
      title: "Finishing night",
      ins: 3 + (live.ins.has("p-finishing") ? 1 : 0),
      names: [...(live.ins.has("p-finishing") ? ["You"] : []), "Diego R.", "Nico A.", "Jalen T."],
      imIn: live.ins.has("p-finishing"),
    });
    const game = plan({
      id: "p-game",
      kind: "game",
      organizer: RENEGADOS,
      opponent: CATHARPIN,
      when: "Sat, Nov 28, 10:00 AM",
      minutes: 90,
      place: "Long Park, Haymarket",
      ins: 7 + (live.ins.has("p-game") ? 1 : 0),
      names: [...(live.ins.has("p-game") ? ["You"] : []), "Diego R.", "Kai M."],
      imIn: live.ins.has("p-game"),
    });
    return {
      ...base,
      ...RENEGADOS,
      captain: false,
      open: true,
      record: "4-1",
      recordLine: gamesRecordLine({ wins: 4, losses: 1, draws: 0, played: 5 }),
      membersCount: RENEGADOS_SEEDS.length,
      week: clubWeek({ minutes: total, best: 1140 }),
      matchup: matchupOn(RENEGADOS, HAYMARKET, per, 99, { wins: 3, losses: 1, draws: 0 }),
      members: members(RENEGADOS_SEEDS, ctx),
      ...splitPlans([training, game]),
      photos: photos(ctx),
      share: share(RENEGADOS, "RENE2345"),
      manage: null,
    };
  }

  if (id === PICKUP.id) {
    const total = totalOf(PICKUP_SEEDS, ctx);
    const settled = live.answered.has("p-score");
    const toConfirm = plan({
      id: "p-score",
      kind: "game",
      organizer: HAYMARKET,
      opponent: PICKUP,
      when: "Sun, Nov 22, 4:00 PM",
      started: true,
      canJoin: false,
      ins: 11,
      names: ["You", "Jalen T.", "Nico A."],
      imIn: true,
      // the organizing club's score first: Haymarket 2, Sunday Pickup 3
      result: { state: settled ? "confirmed" : "waiting", score: [2, 3], line: resultLine(settled ? "confirmed" : "waiting", true), canEnter: false, canAnswer: !settled },
    });
    return {
      ...base,
      ...PICKUP,
      captain: true,
      open: true,
      record: "1-1",
      recordLine: gamesRecordLine({ wins: 1, losses: 1, draws: 0, played: 2 }),
      membersCount: PICKUP_SEEDS.length,
      week: clubWeek({ minutes: total, best: 300 }),
      matchup: { state: "none", mine: null, theirs: null, line: MATCHUP_NONE_LINE, last: matchupResultLine("draw", BRISTOW.name), cardLine: null, recordLine: matchupRecordLine({ wins: 1, losses: 1, draws: 1 }), champs: false },
      members: members(PICKUP_SEEDS, ctx),
      ...splitPlans([toConfirm]),
      photos: [],
      share: share(PICKUP, "PKUP2345"),
      manage: {
        requests: live.answered.has("r-andre") ? [] : [{ id: "r-andre", name: "Andre S.", initials: "AS" }],
        games: live.answered.has("g-catharpin")
          ? []
          : [{ id: "g-catharpin", from: CATHARPIN.name, fromId: CATHARPIN.id, when: "Sun, Nov 29, 4:00 PM", minutes: 60, place: "Braemar Park, Bristow" }],
      },
    };
  }

  if (id === GAINESVILLE.id) {
    const total = totalOf(GAINESVILLE_SEEDS, ctx);
    return {
      ...base,
      ...GAINESVILLE,
      captain: true,
      open: false,
      record: "New",
      recordLine: gamesRecordLine({ wins: 0, losses: 0, draws: 0, played: 0 }),
      membersCount: GAINESVILLE_SEEDS.length,
      week: clubWeek({ minutes: total, best: null }),
      // a week that is decided, before the next one is matched
      matchup: {
        state: "over",
        mine: { ...GAINESVILLE, minutes: 125, time: fmtDuration(125) },
        theirs: { ...NORTHSIDE, minutes: 98, time: fmtDuration(98) },
        line: matchupResultLine("win", NORTHSIDE.name),
        last: null,
        cardLine: null,
        recordLine: matchupRecordLine({ wins: 1, losses: 0, draws: 0 }),
        champs: true,
      },
      members: members(GAINESVILLE_SEEDS, ctx),
      next: [],
      results: [],
      photos: [],
      share: share(GAINESVILLE, "GVHS2345"),
      manage: { requests: [], games: [] },
    };
  }

  // the club the run just started
  if (id === "c-new" && live.started) {
    return {
      ...base,
      id,
      name: live.started.name,
      county: live.started.county,
      countyName: live.started.county ? "Prince William County" : null,
      captain: true,
      open: false,
      record: "New",
      recordLine: gamesRecordLine({ wins: 0, losses: 0, draws: 0, played: 0 }),
      membersCount: 1,
      week: clubWeek({ minutes: 0, best: null }),
      matchup: null,
      members: members([{ key: "me", minutes: 0, captain: true }], { ...ctx, posted: false }),
      next: [],
      results: [],
      photos: [],
      share: share(live.started, "STRV2345"),
      manage: { requests: [], games: [] },
    };
  }
  return null;
}

// The example answers as the real server does: nothing of games reaches
// the app while they are out of it (lib/elite/club-games.ts).
function card(id: string, ctx: Ctx): AppClubCard {
  const p = clubPageForApp(page(id, ctx)!);
  const next = p.next.find((x) => x.status === "on");
  const first = p.photos.find((t) => t.state === "open");
  return {
    id: p.id,
    name: p.name,
    captain: p.captain,
    ended: p.ended,
    members: p.membersCount,
    weekTime: p.week.time,
    photo: first?.state === "open" ? first.photoUrl : null,
    today: p.members.filter((x) => x.today).map((x) => ({ id: x.id, first: x.you ? "You" : x.name.split(" ")[0], initials: x.initials, photo: x.photo, you: x.you })),
    next: next ? `${next.kind === "training" ? next.title ?? "Club training" : `Game against ${(next.opponent ?? next.organizer).name}`} · ${next.when}` : null,
    matchup: p.matchup?.cardLine ?? null,
    ...(cardRace(p.matchup) ? { race: cardRace(p.matchup)! } : {}),
    ...(p.matchup?.champs ? { champs: true } : {}),
    waiting: p.manage
      ? waitingForApp({
          requests: p.manage.requests.length,
          gameAsks: p.manage.games.length,
          scores: p.results.filter((x) => x.result?.canAnswer || x.result?.canEnter).length,
        })
      : 0,
  };
}

const NEAR: AppClubNear = {
  club: { id: PICKUP.id, name: PICKUP.name, county: "va-prince-william", countyName: "Prince William County", open: true },
  fullLine: null,
  rows: [
    { ...HAYMARKET, record: "3-1", members: 9, refusal: null, played: false },
    { ...CATHARPIN, record: "2-0", members: 7, refusal: null, played: false },
    { ...BRISTOW, record: "New", members: 4, refusal: null, played: false },
  ],
};

const notFound = () => Object.assign(new Error("not_found"), { status: 404 });
const needs = (kind: "organizer" | "player"): AppClubAnswer => ({ ok: false, needs: kind });

// Every clubs call (app/api/app/free/clubs, /plans, /play-terms), answered
// from the example and moved on by what was tapped.
export function fixtureClubs(at: string, method: string, body: unknown, ctx: Ctx): unknown {
  const b = (body ?? {}) as Record<string, unknown>;
  if (at === "play-terms") {
    if (b.kind === "organizer") live.organizerOk = true;
    if (b.kind === "player") live.playerOk = true;
    return { ok: true } satisfies AppClubAnswer;
  }
  if (at === "clubs") {
    if (method === "GET") {
      const ids = [RENEGADOS.id, PICKUP.id, ...(live.started ? ["c-new"] : [])];
      return { clubs: ids.map((id) => card(id, ctx)), canStart: ids.length < 3 } satisfies AppClubs;
    }
    if (!live.organizerOk) return needs("organizer");
    live.started = { name: String(b.name ?? "").trim().replace(/\s+/g, " "), county: typeof b.county === "string" ? b.county : null };
    return { ok: true, id: "c-new", code: "STRV2345" } satisfies AppClubAnswer;
  }
  if (at === "clubs/join") return { ok: true, line: clubRequestSentLine(CATHARPIN.name, false) } satisfies AppClubAnswer;
  if (at === "plans") return live.organizerOk ? ({ ok: true, id: "p-new" } satisfies AppClubAnswer) : needs("organizer");
  if (at.startsWith("plans/")) {
    const id = at.slice("plans/".length);
    if (b.do === "in") {
      if (!live.playerOk) return needs("player");
      live.ins.add(id);
    } else if (b.do === "out") live.ins.delete(id);
    else if (b.do === "accept" && !live.organizerOk) return needs("organizer");
    else live.answered.add(id);
    return { ok: true } satisfies AppClubAnswer;
  }
  if (at.startsWith("clubs/")) {
    const [id, more] = at.slice("clubs/".length).split("/");
    if (more === "near") {
      if (!CLUB_GAMES_IN_APP || id !== PICKUP.id) throw notFound();
      return { near: NEAR };
    }
    if (method === "GET") {
      const raw = page(id, ctx);
      if (!raw) throw notFound();
      return { club: clubPageForApp(raw) };
    }
    if (b.do === "request" && typeof b.player === "string") live.answered.add(b.player);
    return { ok: true, ...(b.do === "link" ? { code: "NEWC2345" } : {}) } satisfies AppClubAnswer;
  }
  return { ok: true };
}
