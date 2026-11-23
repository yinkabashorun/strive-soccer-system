// Clubs as teams (077): what a player's own screens read. Every call
// establishes who the viewer is first and uses the service client after
// that check; the tables carry row security with coach reads only, so
// nothing here can be reached from a browser directly.
//
// CLOSED GROUPS ONLY: a session or a game is read only for the members of
// the clubs involved (mayViewPlan), and the place in it only for them. The
// one read across clubs is Clubs near you, for captains, and it carries a
// club's name, crest, county, record and player count, nothing else.
//
// With no database configured, club-teams-demo.ts stands in.
import { createServiceClient } from "./supabase/server";
import type { Viewer } from "./session";
import { avatarsOf, blocksWith, clubIdsOf, friendIdsOf, namesOf, type Admin } from "./tracker-server";
import { demoMyClubs, demoMyPhoto, demoPhotoOf } from "./tracker-demo";
import { DEMO_BIRTHS, DEMO_ENTRY, DEMO_EVENT, DEMO_RECORDS, DEMO_TEAM_CLUBS, demoPlans, demoRecordLabel } from "./club-teams-demo";
import {
  PLAY_TERMS_VERSION,
  TOGETHER_DAYS,
  cleanTags,
  clubsNearYou,
  countyName,
  countyPlaceOf,
  countyRanking,
  entryLine,
  entryState,
  eventDay,
  eventWhen,
  gameDecision,
  hasAccepted,
  mayAnswerGame,
  mayAnswerScore,
  mayCancel,
  mayEnterScore,
  mayJoin,
  mayViewPlan,
  memberBlocked,
  namesShown,
  nearClubView,
  pendingGamesOf,
  playedOpponents,
  recordLabel,
  recordOf,
  recordsOf,
  resultLine,
  resultState,
  takingEntries,
  under18On,
  type CountyRow,
  type EntryState,
  type NearClubView,
  type PlanKind,
  type PlanRefusal,
  type PlanRow,
  type PlanStatus,
  type ResultState,
  type StriveEvent,
  type TeamClub,
} from "./club-teams";
import { initialsOf, shortName, tracksGym, type Kind } from "./tracker";
import { shiftDay } from "./time";

// ---- Reads shared by the screens ------------------------------------------------

export type TeamRow = {
  id: string;
  name: string;
  kind: "player" | "coach";
  captain_id: string | null;
  archived_at: string | null;
  county: string | null;
  open_to_games: boolean;
};
export const TEAM_COLUMNS = "id, name, kind, captain_id, archived_at, county, open_to_games";
export const PLAN_COLUMNS =
  "id, kind, club_id, opponent_id, title, starts_at, minutes, place, status, score_by_club, score_club, score_opponent, score_entered_at, score_answer";
export const EVENT_COLUMNS = "id, name, starts_at, venue, price_text, roster_max, max_age, payment_url, waiver_url, open";

export async function teamRowsOf(admin: Admin, ids: string[]): Promise<TeamRow[]> {
  const out: TeamRow[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await admin.from("elite_tracker_clubs").select(TEAM_COLUMNS).in("id", unique.slice(i, i + 200));
    out.push(...((data as TeamRow[] | null) ?? []));
  }
  return out;
}

export async function memberCountsOf(admin: Admin, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("elite_tracker_club_members").select("club_id").in("club_id", ids.slice(i, i + 200));
    for (const r of (data as { club_id: string }[] | null) ?? []) out.set(r.club_id, (out.get(r.club_id) ?? 0) + 1);
  }
  return out;
}

export function toTeamClub(r: TeamRow, members: number): TeamClub {
  return {
    id: r.id,
    name: r.name,
    county: r.county,
    open: r.open_to_games && !r.archived_at,
    archived: Boolean(r.archived_at),
    members,
  };
}

// Every plan any of these clubs is in, either side, newer than a day.
export async function plansOf(admin: Admin, ids: string[], sinceIso?: string): Promise<PlanRow[]> {
  if (ids.length === 0) return [];
  const seen = new Map<string, PlanRow>();
  for (let i = 0; i < ids.length; i += 100) {
    const some = ids.slice(i, i + 100);
    for (const col of ["club_id", "opponent_id"] as const) {
      let q = admin.from("elite_club_plans").select(PLAN_COLUMNS).in(col, some);
      if (sinceIso) q = q.gte("starts_at", sinceIso);
      const { data } = await q.limit(1000);
      for (const r of (data as PlanRow[] | null) ?? []) seen.set(r.id, r);
    }
  }
  return [...seen.values()];
}

export async function planById(admin: Admin, planId: string): Promise<PlanRow | null> {
  if (!/^[0-9a-f-]{36}$/.test(planId)) return null;
  const { data } = await admin.from("elite_club_plans").select(PLAN_COLUMNS).eq("id", planId).maybeSingle();
  return (data as PlanRow | null) ?? null;
}

// The clubs of one county that chose to be open to games, with their
// player counts. The only read across clubs a player's screen makes.
async function openClubsIn(admin: Admin, county: string): Promise<TeamClub[]> {
  const { data } = await admin
    .from("elite_tracker_clubs")
    .select(TEAM_COLUMNS)
    .eq("county", county)
    .eq("open_to_games", true)
    .is("archived_at", null)
    .limit(500);
  const rows = (data as TeamRow[] | null) ?? [];
  const counts = await memberCountsOf(admin, rows.map((r) => r.id));
  return rows.map((r) => toTeamClub(r, counts.get(r.id) ?? 0));
}

// The clubs a player captains, not ended.
export async function captainsOf(admin: Admin, profileId: string): Promise<Set<string>> {
  const { data } = await admin.from("elite_tracker_clubs").select("id").eq("captain_id", profileId).is("archived_at", null);
  return new Set(((data as { id: string }[] | null) ?? []).map((r) => r.id));
}

// A county's ranking as one of its clubs' members may see it: the clubs
// open to games there, plus the viewer's own club.
async function rankingFor(admin: Admin, county: string, own: TeamClub[], nowMs: number): Promise<CountyRow[]> {
  const open = await openClubsIn(admin, county);
  const all = new Map(open.map((x) => [x.id, x]));
  for (const o of own) if (o.county === county) all.set(o.id, o);
  const records = recordsOf(await plansOf(admin, [...all.keys()]), nowMs);
  return countyRanking({ clubs: [...all.values()], county, records, mine: new Set(own.map((o) => o.id)) });
}

async function eventsById(admin: Admin, ids: string[]): Promise<Map<string, StriveEvent>> {
  const out = new Map<string, StriveEvent>();
  if (ids.length === 0) return out;
  const { data } = await admin.from("elite_strive_events").select(EVENT_COLUMNS).in("id", [...new Set(ids)]);
  for (const e of (data as StriveEvent[] | null) ?? []) out.set(e.id, e);
  return out;
}

async function isMember(admin: Admin, clubId: string, profileId: string): Promise<boolean> {
  const { data } = await admin
    .from("elite_tracker_club_members")
    .select("club_id")
    .eq("club_id", clubId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return Boolean(data);
}

// The two one-time sheets this player has accepted (current wording).
export async function playAcceptancesOf(admin: Admin, profileId: string): Promise<{ organizer: boolean; player: boolean }> {
  const { data } = await admin
    .from("elite_play_acceptances")
    .select("kind, version")
    .eq("profile_id", profileId)
    .eq("version", PLAY_TERMS_VERSION);
  const rows = (data as { kind: string; version: string }[] | null) ?? [];
  return { organizer: hasAccepted(rows, "organizer"), player: hasAccepted(rows, "player") };
}

// ---- One session or game, as a card ----------------------------------------------------

export type PlanCard = {
  id: string;
  kind: PlanKind;
  title: string | null;
  organizer: { id: string; name: string };
  opponent: { id: string; name: string } | null;
  when: string; // "Tue, Nov 24, 6:00 PM"
  minutes: number;
  place: string;
  status: PlanStatus;
  started: boolean;
  ins: number;
  names: string[]; // only players in for the viewer's own club(s), never across a block
  imIn: boolean;
  canJoin: boolean;
  canCancel: boolean;
  canAnswer: boolean; // the other captain, on a game request
  result: null | {
    state: ResultState;
    score: [number, number] | null; // organizer first
    line: string | null;
    canEnter: boolean;
    canAnswer: boolean;
  };
};

type CardContext = {
  viewerId: string;
  clubIds: Set<string>; // the viewer's clubs
  captainOf: Set<string>;
  staff: boolean;
  nowMs: number;
  clubName: (id: string) => string;
  ins: { plan_id: string; profile_id: string; club_id: string }[];
  names: Map<string, string>;
  blocks: { blocker: string; blocked: string }[];
};

function toCard(p: PlanRow, ctx: CardContext): PlanCard {
  const mine = ctx.ins.filter((i) => i.plan_id === p.id);
  const shown = namesShown(mine, { id: ctx.viewerId, clubIds: ctx.clubIds, blocks: ctx.blocks });
  const state = p.kind === "game" ? resultState(p, ctx.nowMs) : "none";
  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    organizer: { id: p.club_id, name: ctx.clubName(p.club_id) },
    opponent: p.opponent_id ? { id: p.opponent_id, name: ctx.clubName(p.opponent_id) } : null,
    when: eventWhen(p.starts_at),
    minutes: p.minutes,
    place: p.place,
    status: p.status,
    started: Date.parse(p.starts_at) <= ctx.nowMs,
    ins: mine.length,
    names: shown.map((i) => (i.profile_id === ctx.viewerId ? "You" : ctx.names.get(i.profile_id) ?? "A teammate")),
    imIn: mine.some((i) => i.profile_id === ctx.viewerId),
    canJoin: !ctx.staff && mayJoin(p, ctx.clubIds, ctx.nowMs),
    canCancel: mayCancel(p, { captainOf: ctx.captainOf, staff: ctx.staff }, ctx.nowMs),
    canAnswer: mayAnswerGame(p, ctx.captainOf),
    result:
      p.kind === "game" && p.status === "on" && Date.parse(p.starts_at) <= ctx.nowMs
        ? {
            state,
            score: p.score_club !== null && p.score_opponent !== null ? [p.score_club, p.score_opponent] : null,
            line: resultLine(state, Boolean(p.score_by_club) && !ctx.captainOf.has(p.score_by_club!)),
            canEnter: mayEnterScore(p, ctx.captainOf, ctx.nowMs),
            canAnswer: mayAnswerScore(p, ctx.captainOf, ctx.nowMs),
          }
        : null,
  };
}

// Cards for plans this viewer may see. Every plan passes mayViewPlan here,
// whatever the caller asked for.
async function cardsFor(admin: Admin, viewer: Viewer, plans: PlanRow[], nowMs: number): Promise<PlanCard[]> {
  const staff = viewer.role !== "player";
  const me = viewer.profile.id;
  const clubIds = new Set(staff ? [] : await clubIdsOf(admin, me));
  const visible = plans.filter((p) => mayViewPlan(p, { clubIds, staff }));
  if (visible.length === 0) return [];
  const [captainOf, rows] = await Promise.all([
    staff ? Promise.resolve(new Set<string>()) : captainsOf(admin, me),
    teamRowsOf(admin, visible.flatMap((p) => [p.club_id, p.opponent_id].filter((x): x is string => Boolean(x)))),
  ]);
  const clubNames = new Map(rows.map((r) => [r.id, r.name]));
  const { data } = await admin.from("elite_plan_ins").select("plan_id, profile_id, club_id").in("plan_id", visible.map((p) => p.id));
  const ins = (data as { plan_id: string; profile_id: string; club_id: string }[] | null) ?? [];
  const people = [...new Set(ins.map((i) => i.profile_id))];
  const [names, blocks] = await Promise.all([namesOf(admin, people), staff ? Promise.resolve([]) : blocksWith(admin, me, people.filter((x) => x !== me))]);
  const ctx: CardContext = {
    viewerId: me,
    clubIds,
    captainOf,
    staff,
    nowMs,
    clubName: (id) => clubNames.get(id) ?? "A club",
    ins,
    names,
    blocks,
  };
  return visible.sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map((p) => toCard(p, ctx));
}

function demoCards(viewerClubIds: Set<string>, nowMs: number): PlanCard[] {
  const name = (id: string) => DEMO_TEAM_CLUBS.find((x) => x.id === id)?.name ?? "A club";
  const captainOf = new Set(["demo-club-2"]);
  return demoPlans()
    .filter((p) => mayViewPlan(p, { clubIds: viewerClubIds, staff: false }))
    .map((p) => {
      const state = p.kind === "game" ? resultState(p, nowMs) : "none";
      return {
        id: p.id,
        kind: p.kind,
        title: p.title,
        organizer: { id: p.club_id, name: name(p.club_id) },
        opponent: p.opponent_id ? { id: p.opponent_id, name: name(p.opponent_id) } : null,
        when: eventWhen(p.starts_at),
        minutes: p.minutes,
        place: p.place,
        status: p.status,
        started: Date.parse(p.starts_at) <= nowMs,
        ins: p.ins,
        names: p.names,
        imIn: p.names.includes("You"),
        canJoin: mayJoin(p, viewerClubIds, nowMs),
        canCancel: mayCancel(p, { captainOf, staff: false }, nowMs),
        canAnswer: false,
        result:
          p.kind === "game" && p.status === "on" && Date.parse(p.starts_at) <= nowMs
            ? {
                state,
                score: p.score_club !== null && p.score_opponent !== null ? [p.score_club, p.score_opponent] : null,
                line: resultLine(state, false),
                canEnter: mayEnterScore(p, captainOf, nowMs),
                canAnswer: false,
              }
            : null,
      } satisfies PlanCard;
    });
}

// ---- The club page (screen 13) ----------------------------------------------------

export type EventCard = { id: string; name: string; when: string; state: EntryState; line: string };

export type ClubTeamView = {
  county: string | null;
  countyName: string | null;
  open: boolean;
  record: string;
  place: number | null;
  canPlan: boolean; // the viewer captains it
  plans: PlanCard[]; // coming up, and games of the last week waiting on a result
  events: EventCard[];
  accepted: { organizer: boolean; player: boolean };
};

const RECENT_DAYS = 7;

// The team half of a club's page. The caller (the club page) has already
// established the viewer is a member or a coach (clubPageFor); the plans
// are checked again here, one by one.
export async function clubTeamFor(viewer: Viewer, clubId: string, captain: boolean): Promise<ClubTeamView> {
  const nowMs = Date.now();
  if (viewer.demo || !createServiceClient()) return demoClubTeam(clubId, captain, nowMs);
  const admin = createServiceClient()!;
  const [row] = await teamRowsOf(admin, [clubId]);
  const empty: ClubTeamView = {
    county: null,
    countyName: null,
    open: false,
    record: "New",
    place: null,
    canPlan: false,
    plans: [],
    events: [],
    accepted: { organizer: false, player: false },
  };
  if (!row) return empty;
  const me = toTeamClub(row, (await memberCountsOf(admin, [clubId])).get(clubId) ?? 0);
  const all = await plansOf(admin, [clubId]);
  const records = recordsOf(all, nowMs);
  const ranking = me.county ? await rankingFor(admin, me.county, [me], nowMs) : [];
  const since = nowMs - RECENT_DAYS * 86_400_000;
  // what is coming up, and the games of the last week (for their results)
  const shown = all.filter((p) => {
    if (p.status !== "on" && p.status !== "pending") return false;
    if (Date.parse(p.starts_at) + p.minutes * 60_000 > nowMs) return true;
    return p.kind === "game" && Date.parse(p.starts_at) >= since;
  });
  const plans = (await cardsFor(admin, viewer, shown, nowMs)).filter(
    (c) => c.organizer.id === clubId || c.opponent?.id === clubId
  );

  // the Strive events this club entered that have not passed
  const { data: entries } = await admin.from("elite_event_entries").select("id, event_id, sent_at, paid_at").eq("club_id", clubId);
  const entryRows = (entries as { id: string; event_id: string; sent_at: string | null; paid_at: string | null }[] | null) ?? [];
  const entryEvents = await eventsById(admin, entryRows.map((e) => e.event_id));
  const roster = await rosterOf(admin, entryRows.map((e) => e.id));
  const events: EventCard[] = [];
  for (const e of entryRows) {
    const ev = entryEvents.get(e.event_id);
    if (!ev || Date.parse(ev.starts_at) < nowMs - 86_400_000) continue;
    const players = roster.filter((r) => r.entry_id === e.id);
    const state = entryState({ roster: players, sent_at: e.sent_at, paid_at: e.paid_at });
    events.push({ id: ev.id, name: ev.name, when: `${eventWhen(ev.starts_at)} · ${ev.venue}`, state, line: entryLine(state, players.filter((p) => !p.in_at).length) });
  }

  return {
    county: me.county,
    countyName: countyName(me.county),
    open: me.open,
    record: recordLabel(recordOf(records, clubId)),
    place: countyPlaceOf(ranking, clubId),
    canPlan: captain && !me.archived,
    plans,
    events,
    accepted: viewer.role === "player" ? await playAcceptancesOf(admin, viewer.profile.id) : { organizer: true, player: true },
  };
}

function demoClubTeam(clubId: string, captain: boolean, nowMs: number): ClubTeamView {
  const club = DEMO_TEAM_CLUBS.find((x) => x.id === clubId);
  const ranked = club?.county ? countyRanking({ clubs: DEMO_TEAM_CLUBS, county: club.county, records: DEMO_RECORDS, mine: new Set([clubId]) }) : [];
  return {
    county: club?.county ?? null,
    countyName: countyName(club?.county),
    open: club?.open ?? false,
    record: demoRecordLabel(clubId),
    place: countyPlaceOf(ranked, clubId),
    canPlan: captain,
    plans: demoCards(new Set(["demo-club-1", "demo-club-2"]), nowMs).filter((c) => c.organizer.id === clubId || c.opponent?.id === clubId),
    events:
      clubId === DEMO_ENTRY.clubId
        ? [{ id: DEMO_EVENT.id, name: DEMO_EVENT.name, when: `${eventWhen(DEMO_EVENT.starts_at)} · ${DEMO_EVENT.venue}`, state: DEMO_ENTRY.state, line: entryLine(DEMO_ENTRY.state, DEMO_ENTRY.waiting) }]
        : [],
    // the example captain sees the organizer sheet on Plan, as a new captain does
    accepted: { organizer: false, player: true },
  };
}

// ---- One plan's page (screen 18) --------------------------------------------------------

export type PlanPage = { card: PlanCard; countyName: string | null; ranking: CountyRow[]; accepted: { organizer: boolean; player: boolean } };

// Only for the members of the clubs involved (and coaches). Anyone else
// gets nothing back at all.
export async function planPageFor(viewer: Viewer, planId: string): Promise<PlanPage | null> {
  const nowMs = Date.now();
  if (viewer.demo || !createServiceClient()) {
    const card = demoCards(new Set(["demo-club-1", "demo-club-2"]), nowMs).find((c) => c.id === planId);
    if (!card) return null;
    return {
      card,
      countyName: countyName("va-prince-william"),
      ranking: card.kind === "game" ? countyRanking({ clubs: DEMO_TEAM_CLUBS, county: "va-prince-william", records: DEMO_RECORDS, mine: new Set(["demo-club-2"]) }) : [],
      accepted: { organizer: true, player: true },
    };
  }
  const admin = createServiceClient()!;
  const plan = await planById(admin, planId);
  if (!plan) return null;
  const [card] = await cardsFor(admin, viewer, [plan], nowMs);
  if (!card) return null;
  let ranking: CountyRow[] = [];
  let county: string | null = null;
  if (plan.kind === "game") {
    const rows = await teamRowsOf(admin, [plan.club_id, plan.opponent_id!]);
    const counts = await memberCountsOf(admin, rows.map((r) => r.id));
    const teams = rows.map((r) => toTeamClub(r, counts.get(r.id) ?? 0));
    const myClubs = new Set(viewer.role === "player" ? await clubIdsOf(admin, viewer.profile.id) : []);
    county = teams.find((t) => myClubs.has(t.id))?.county ?? teams[0]?.county ?? null;
    if (county) ranking = await rankingFor(admin, county, teams.filter((t) => myClubs.has(t.id)), nowMs);
  }
  return {
    card,
    countyName: countyName(county),
    ranking,
    accepted: viewer.role === "player" ? await playAcceptancesOf(admin, viewer.profile.id) : { organizer: true, player: true },
  };
}

// ---- Clubs near you (screen 16) ----------------------------------------------------

export type NearRow = NearClubView & { refusal: PlanRefusal | null };
export type NearYouView = {
  club: { id: string; name: string; county: string | null; countyName: string | null; open: boolean };
  pending: number; // game requests this club has waiting
  rows: NearRow[];
};

// Only for the club's captain. Anyone else gets nothing back.
export async function nearYouFor(viewer: Viewer, clubId: string): Promise<NearYouView | null> {
  if (viewer.demo || !createServiceClient()) {
    const mine = DEMO_TEAM_CLUBS.find((x) => x.id === clubId);
    if (!mine || clubId !== "demo-club-2") return null;
    const pending = pendingGamesOf(demoPlans(), clubId);
    return {
      club: { id: mine.id, name: mine.name, county: mine.county, countyName: countyName(mine.county), open: mine.open },
      pending,
      rows: clubsNearYou({ mine, clubs: DEMO_TEAM_CLUBS, records: DEMO_RECORDS }).map((x) => ({ ...nearClubView(x, DEMO_RECORDS), refusal: null })),
    };
  }
  const admin = createServiceClient()!;
  const [row] = await teamRowsOf(admin, [clubId]);
  if (!row || row.captain_id !== viewer.profile.id || row.archived_at) return null;
  const mine = toTeamClub(row, (await memberCountsOf(admin, [clubId])).get(clubId) ?? 0);
  const view = { id: mine.id, name: mine.name, county: mine.county, countyName: countyName(mine.county), open: mine.open };
  const own = await plansOf(admin, [clubId]);
  const pending = pendingGamesOf(own, clubId);
  if (!mine.county) return { club: view, pending, rows: [] };
  const clubs = await openClubsIn(admin, mine.county);
  const records = recordsOf(await plansOf(admin, [mine.id, ...clubs.map((x) => x.id)]), Date.now());
  return {
    club: view,
    pending,
    rows: clubsNearYou({ mine, clubs, records }).map((x) => {
      const decision = gameDecision({ viewerIsCaptain: true, from: mine, to: x, pendingFrom: pending });
      return { ...nearClubView(x, records), refusal: decision === "ok" ? null : decision };
    }),
  };
}

// The clubs a captain may send a game to: the open clubs in the county
// (Clubs near you), and any club this club already played that has not
// ended. Name only.
export async function opponentsFor(viewer: Viewer, clubId: string): Promise<{ id: string; name: string; played: boolean }[]> {
  const near = await nearYouFor(viewer, clubId);
  if (!near) return [];
  const out = new Map(near.rows.filter((r) => !r.refusal || r.refusal === "too_many").map((r) => [r.id, { id: r.id, name: r.name, played: false }]));
  if (viewer.demo || !createServiceClient()) return [...out.values()];
  const admin = createServiceClient()!;
  const played = playedOpponents(await plansOf(admin, [clubId]), clubId);
  for (const row of await teamRowsOf(admin, played)) {
    if (!row.archived_at) out.set(row.id, { id: row.id, name: row.name, played: true });
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Requests on the Friends tab ----------------------------------------------------

export type GameAsk = { id: string; from: string; fromId: string; to: string; when: string; minutes: number; place: string };
export type ScoreAsk = { id: string; from: string; to: string; score: [number, number]; enteredBy: string };
export type RosterAsk = { entryId: string; event: string; when: string; club: string; waiverUrl: string; minor: boolean };
export type TogetherAsk = { logId: string; from: string; initials: string; minutes: number; kind: Kind; day: string };
export type TeamAsks = { games: GameAsk[]; scores: ScoreAsk[]; rosters: RosterAsk[]; together: TogetherAsk[]; organizerOk: boolean };

// The example account's cards: one of each kind a player meets.
function demoAsks(): TeamAsks {
  const nowMs = Date.now();
  return {
    games: [{ id: "demo-plan-2", from: "Sunday Pickup", fromId: "demo-near-4", to: "Bull Run 2010s", when: eventWhen(new Date(nowMs + 6 * 86_400_000).toISOString()), minutes: 60, place: "Braemar Park, Bristow" }],
    scores: [],
    rosters: [
      {
        entryId: "demo-entry-1",
        event: DEMO_EVENT.name,
        when: `${eventWhen(DEMO_EVENT.starts_at)} · ${DEMO_EVENT.venue}`,
        club: "Bull Run 2010s",
        waiverUrl: DEMO_EVENT.waiver_url ?? "https://example.com/waiver",
        minor: true,
      },
    ],
    together: [{ logId: "demo-log-1", from: "Dani R.", initials: "DR", minutes: 60, kind: "training", day: new Date(nowMs).toISOString().slice(0, 10) }],
    organizerOk: true,
  };
}

export async function teamAsksFor(viewer: Viewer, today: string): Promise<TeamAsks> {
  if (viewer.demo || !createServiceClient()) return demoAsks();
  const admin = createServiceClient()!;
  const me = viewer.profile.id;
  const nowMs = Date.now();

  // game requests and results waiting on a club this player captains
  const captainOf = await captainsOf(admin, me);
  const games: GameAsk[] = [];
  const scores: ScoreAsk[] = [];
  if (captainOf.size) {
    const plans = await plansOf(admin, [...captainOf], new Date(nowMs - RECENT_DAYS * 86_400_000).toISOString());
    const names = new Map((await teamRowsOf(admin, plans.flatMap((p) => [p.club_id, p.opponent_id ?? p.club_id]))).map((r) => [r.id, r.name]));
    const n = (id: string | null) => (id ? names.get(id) ?? "A club" : "A club");
    for (const p of plans) {
      if (mayAnswerGame(p, captainOf) && Date.parse(p.starts_at) > nowMs) {
        games.push({ id: p.id, from: n(p.club_id), fromId: p.club_id, to: n(p.opponent_id), when: eventWhen(p.starts_at), minutes: p.minutes, place: p.place });
      }
      if (mayAnswerScore(p, captainOf, nowMs) && p.score_club !== null && p.score_opponent !== null) {
        scores.push({ id: p.id, from: n(p.club_id), to: n(p.opponent_id), score: [p.score_club, p.score_opponent], enteredBy: n(p.score_by_club) });
      }
    }
  }

  // rosters this player was put on and has not answered, for events that
  // are still taking entries
  const rosters: RosterAsk[] = [];
  const { data: rosterRows } = await admin.from("elite_event_roster").select("entry_id, event_id").eq("profile_id", me).is("in_at", null).limit(10);
  const rr = (rosterRows as { entry_id: string; event_id: string }[] | null) ?? [];
  if (rr.length) {
    const events = await eventsById(admin, rr.map((r) => r.event_id));
    const { data: entryRows } = await admin.from("elite_event_entries").select("id, club_id").in("id", rr.map((r) => r.entry_id));
    const clubOf = new Map(((entryRows as { id: string; club_id: string }[] | null) ?? []).map((e) => [e.id, e.club_id]));
    const clubs = new Map((await teamRowsOf(admin, [...clubOf.values()])).map((r) => [r.id, r.name]));
    const { data: t } = await admin.from("elite_trackers").select("birth_month, birth_year").eq("profile_id", me).maybeSingle();
    const b = t as { birth_month: number | null; birth_year: number | null } | null;
    const birth = b?.birth_month && b.birth_year ? { month: b.birth_month, year: b.birth_year } : null;
    for (const r of rr) {
      const ev = events.get(r.event_id);
      if (!ev || !ev.waiver_url || !takingEntries(ev, nowMs)) continue;
      rosters.push({
        entryId: r.entry_id,
        event: ev.name,
        when: `${eventWhen(ev.starts_at)} · ${ev.venue}`,
        club: clubs.get(clubOf.get(r.entry_id) ?? "") ?? "Your club",
        waiverUrl: ev.waiver_url,
        minor: under18On(birth, eventDay(ev.starts_at)),
      });
    }
  }

  // teammates who tagged this player on a post in the last seven days
  const together: TogetherAsk[] = [];
  const { data: tagRows } = await admin
    .from("elite_trained_together")
    .select("log_id, tagger")
    .eq("tagged", me)
    .is("answer", null)
    .gte("created_at", new Date(nowMs - TOGETHER_DAYS * 86_400_000).toISOString())
    .limit(20);
  const tags = (tagRows as { log_id: string; tagger: string }[] | null) ?? [];
  if (tags.length) {
    const blocks = await blocksWith(admin, me, tags.map((t) => t.tagger));
    const blocked = new Set(blocks.flatMap((b) => [b.blocker, b.blocked]));
    const { data: logs } = await admin.from("elite_training_logs").select("id, minutes, kind, trained_on, removed_at").in("id", tags.map((t) => t.log_id));
    const logOf = new Map(
      ((logs as { id: string; minutes: number; kind: Kind; trained_on: string; removed_at: string | null }[] | null) ?? []).map((l) => [l.id, l])
    );
    const names = await namesOf(admin, tags.map((t) => t.tagger));
    for (const t of tags) {
      const log = logOf.get(t.log_id);
      if (!log || log.removed_at || blocked.has(t.tagger) || log.trained_on < shiftDay(today, -TOGETHER_DAYS + 1)) continue;
      const name = names.get(t.tagger) ?? "A teammate";
      together.push({ logId: log.id, from: name, initials: initialsOf(name), minutes: log.minutes, kind: log.kind, day: log.trained_on });
    }
  }
  const organizerOk = games.length === 0 || (await playAcceptancesOf(admin, me)).organizer;
  return { games, scores, rosters, together, organizerOk };
}

// ---- Teammates to tag on a post ------------------------------------------------------

export type Teammate = { id: string; name: string; initials: string; photo: string | null };

// Everyone on the viewer's clubs, never across a block, each once. A photo
// only where the viewer may see one (friends, the same rule as a club page).
export async function teammatesFor(viewer: Viewer): Promise<Teammate[]> {
  if (viewer.demo || !createServiceClient()) {
    const seen = new Map<string, Teammate>();
    for (const club of demoMyClubs({ id: viewer.profile.id, name: shortName(viewer.profile.full_name) })) {
      for (const m of club.members) {
        if (m.you || seen.has(m.id)) continue;
        seen.set(m.id, { id: m.id, name: m.name, initials: initialsOf(m.name), photo: demoPhotoOf(m.name) });
      }
    }
    return [...seen.values()];
  }
  const admin = createServiceClient()!;
  const me = viewer.profile.id;
  const clubIds = await clubIdsOf(admin, me);
  if (clubIds.length === 0) return [];
  const { data } = await admin.from("elite_tracker_club_members").select("profile_id").in("club_id", clubIds);
  const ids = [...new Set(((data as { profile_id: string }[] | null) ?? []).map((r) => r.profile_id))].filter((x) => x !== me);
  const blocks = await blocksWith(admin, me, ids);
  const blocked = new Set(blocks.flatMap((b) => [b.blocker, b.blocked]));
  const ok = ids.filter((x) => !blocked.has(x));
  const [names, friends] = await Promise.all([namesOf(admin, ok), friendIdsOf(admin, me)]);
  const friendSet = new Set(friends);
  const photos = await avatarsOf(admin, ok.filter((x) => friendSet.has(x)));
  return ok
    .map((id) => {
      const name = names.get(id) ?? "A teammate";
      return { id, name, initials: initialsOf(name), photo: photos.get(id) ?? null };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Strive events (screen 14) ------------------------------------------------------------

export type EventClub = {
  clubId: string;
  clubName: string;
  captain: boolean;
  entered: boolean;
  state: EntryState | null;
  line: string | null;
};
export type EventView = StriveEvent & { when: string; day: string; clubs: EventClub[] };

async function rosterOf(admin: Admin, entryIds: string[]): Promise<{ entry_id: string; profile_id: string; in_at: string | null }[]> {
  if (entryIds.length === 0) return [];
  const { data } = await admin.from("elite_event_roster").select("entry_id, profile_id, in_at").in("entry_id", entryIds);
  return (data as { entry_id: string; profile_id: string; in_at: string | null }[] | null) ?? [];
}

// Events that are taking entries, and any event one of the viewer's clubs
// entered that has not passed. For each, the viewer's clubs and where their
// entry stands.
export async function eventsFor(viewer: Viewer): Promise<EventView[]> {
  const nowMs = Date.now();
  if (viewer.demo || !createServiceClient()) {
    const clubs = demoMyClubs({ id: viewer.profile.id, name: shortName(viewer.profile.full_name) });
    return [
      {
        ...DEMO_EVENT,
        when: eventWhen(DEMO_EVENT.starts_at),
        day: eventDay(DEMO_EVENT.starts_at),
        clubs: clubs.map((c) => {
          const entered = c.id === DEMO_ENTRY.clubId;
          return {
            clubId: c.id,
            clubName: c.name,
            captain: c.captain,
            entered,
            state: entered ? DEMO_ENTRY.state : null,
            line: entered ? entryLine(DEMO_ENTRY.state, DEMO_ENTRY.waiting) : null,
          };
        }).filter((c) => c.entered || c.captain),
      },
    ];
  }
  const admin = createServiceClient()!;
  const me = viewer.profile.id;
  const clubIds = await clubIdsOf(admin, me);
  const myClubs = await teamRowsOf(admin, clubIds);
  const { data: openRows } = await admin
    .from("elite_strive_events")
    .select(EVENT_COLUMNS)
    .eq("open", true)
    .gt("starts_at", new Date(nowMs).toISOString())
    .order("starts_at")
    .limit(20);
  const events = new Map(((openRows as StriveEvent[] | null) ?? []).map((e) => [e.id, e]));
  const { data: entryRows } = clubIds.length
    ? await admin.from("elite_event_entries").select("id, event_id, club_id, sent_at, paid_at").in("club_id", clubIds)
    : { data: [] };
  const entries = (entryRows as { id: string; event_id: string; club_id: string; sent_at: string | null; paid_at: string | null }[] | null) ?? [];
  for (const [id, e] of await eventsById(admin, entries.map((x) => x.event_id).filter((x) => !events.has(x)))) {
    if (Date.parse(e.starts_at) > nowMs - 86_400_000) events.set(id, e);
  }
  const roster = await rosterOf(admin, entries.map((e) => e.id));
  return [...events.values()]
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((e) => ({
      ...e,
      // the payment and waiver links are handed out on the event's own page
      when: eventWhen(e.starts_at),
      day: eventDay(e.starts_at),
      clubs: myClubs
        .filter((c) => !c.archived_at)
        .map((c) => {
          const entry = entries.find((x) => x.event_id === e.id && x.club_id === c.id);
          const players = entry ? roster.filter((r) => r.entry_id === entry.id) : [];
          const state = entry ? entryState({ roster: players, sent_at: entry.sent_at, paid_at: entry.paid_at }) : null;
          return {
            clubId: c.id,
            clubName: c.name,
            captain: c.captain_id === me,
            entered: Boolean(entry),
            state,
            line: state ? entryLine(state, players.filter((p) => !p.in_at).length) : null,
          };
        })
        .filter((c) => c.entered || (c.captain && takingEntries(e, nowMs))),
    }));
}

// ---- One club's entry in one event (screen 15) --------------------------------------------

export type EntryMember = {
  id: string;
  name: string;
  initials: string;
  photo: string | null;
  captain: boolean;
  you: boolean;
  blocked: string | null; // why this member cannot be picked, in a word
};
export type EntryView = {
  event: StriveEvent & { when: string };
  club: { id: string; name: string };
  captain: boolean;
  members: EntryMember[];
  entry: null | {
    state: EntryState;
    line: string;
    roster: { id: string; name: string; in: boolean }[];
    paymentUrl: string | null; // only once every player is in
  };
  canEdit: boolean; // the captain, before payment, while entries are open
};

// Only for the club's members and coaches.
export async function entryFor(viewer: Viewer, eventId: string, clubId: string): Promise<EntryView | null> {
  const nowMs = Date.now();
  if (viewer.demo || !createServiceClient()) {
    const club = demoMyClubs({ id: viewer.profile.id, name: shortName(viewer.profile.full_name) }).find((c) => c.id === clubId);
    if (!club || eventId !== DEMO_EVENT.id) return null;
    const entered = clubId === DEMO_ENTRY.clubId;
    const members = club.members.map((m) => {
      const birth = m.you ? { month: 3, year: 2010 } : DEMO_BIRTHS[m.name] ?? null;
      return {
        id: m.id,
        name: m.name,
        initials: initialsOf(m.name),
        photo: m.you ? demoMyPhoto() : demoPhotoOf(m.name),
        captain: m.captain,
        you: m.you,
        blocked: memberBlocked({ id: m.id, birth }, DEMO_EVENT, new Set()),
      };
    });
    return {
      event: { ...DEMO_EVENT, when: eventWhen(DEMO_EVENT.starts_at) },
      club: { id: club.id, name: club.name },
      captain: club.captain,
      members,
      entry: entered
        ? {
            state: DEMO_ENTRY.state,
            line: entryLine(DEMO_ENTRY.state, DEMO_ENTRY.waiting),
            roster: members.filter((m) => !m.blocked).map((m) => ({ id: m.id, name: m.you ? "You" : m.name, in: true })),
            paymentUrl: DEMO_EVENT.payment_url,
          }
        : null,
      canEdit: club.captain && DEMO_ENTRY.state !== "paid",
    };
  }
  const admin = createServiceClient()!;
  const me = viewer.profile.id;
  const staff = viewer.role !== "player";
  if (!staff && !(await isMember(admin, clubId, me))) return null;
  const [club] = await teamRowsOf(admin, [clubId]);
  const event = (await eventsById(admin, [eventId])).get(eventId);
  if (!club || !event) return null;

  const { data: memberRows } = await admin.from("elite_tracker_club_members").select("profile_id").eq("club_id", clubId);
  const memberIds = ((memberRows as { profile_id: string }[] | null) ?? []).map((r) => r.profile_id);
  // a block hides each from the other here too
  const blocks = staff ? [] : await blocksWith(admin, me, memberIds.filter((x) => x !== me));
  const hidden = new Set(blocks.flatMap((b) => [b.blocker, b.blocked]).filter((x) => x !== me));
  const visible = memberIds.filter((x) => !hidden.has(x));
  const [names, friends, births] = await Promise.all([
    namesOf(admin, visible),
    staff ? Promise.resolve([] as string[]) : friendIdsOf(admin, me),
    admin.from("elite_trackers").select("profile_id, birth_month, birth_year").in("profile_id", visible),
  ]);
  const birthOf = new Map(
    ((births.data as { profile_id: string; birth_month: number | null; birth_year: number | null }[] | null) ?? []).map((b) => [
      b.profile_id,
      b.birth_month && b.birth_year ? { month: b.birth_month, year: b.birth_year } : null,
    ])
  );
  const friendSet = new Set(friends);
  const photos = await avatarsOf(admin, visible.filter((x) => staff || x === me || friendSet.has(x)));

  // who is already on another club's roster for this event
  const { data: elsewhere } = await admin.from("elite_event_roster").select("profile_id, entry_id").eq("event_id", eventId).in("profile_id", visible);
  const { data: entryRow } = await admin
    .from("elite_event_entries")
    .select("id, sent_at, paid_at")
    .eq("event_id", eventId)
    .eq("club_id", clubId)
    .maybeSingle();
  const entry = entryRow as { id: string; sent_at: string | null; paid_at: string | null } | null;
  const onOther = new Set(
    ((elsewhere as { profile_id: string; entry_id: string }[] | null) ?? []).filter((r) => r.entry_id !== entry?.id).map((r) => r.profile_id)
  );

  const members: EntryMember[] = visible
    .map((id) => {
      const name = id === me ? shortName(viewer.profile.full_name) : names.get(id) ?? "A teammate";
      return {
        id,
        name,
        initials: initialsOf(name),
        photo: photos.get(id) ?? null,
        captain: club.captain_id === id,
        you: id === me,
        blocked: memberBlocked({ id, birth: birthOf.get(id) ?? null }, event, onOther),
      };
    })
    .sort((a, b) => Number(b.captain) - Number(a.captain) || a.name.localeCompare(b.name));

  let view: EntryView["entry"] = null;
  if (entry) {
    const players = (await rosterOf(admin, [entry.id])).filter((r) => !hidden.has(r.profile_id));
    const state = entryState({ roster: players, sent_at: entry.sent_at, paid_at: entry.paid_at });
    view = {
      state,
      line: entryLine(state, players.filter((p) => !p.in_at).length),
      roster: players.map((p) => ({ id: p.profile_id, name: p.profile_id === me ? "You" : names.get(p.profile_id) ?? "A teammate", in: Boolean(p.in_at) })),
      paymentUrl: state === "waiting" ? null : event.payment_url,
    };
  }
  const captain = club.captain_id === me && !club.archived_at;
  return {
    event: { ...event, when: eventWhen(event.starts_at) },
    club: { id: club.id, name: club.name },
    captain,
    members,
    entry: view,
    canEdit: captain && !entry?.paid_at && takingEntries(event, nowMs),
  };
}

// ---- Trained together: the tags on a post ---------------------------------------------------

// The ids on every club this player is on, the player left out.
async function clubmateIdsOf(admin: Admin, profileId: string): Promise<string[]> {
  const clubIds = await clubIdsOf(admin, profileId);
  if (clubIds.length === 0) return [];
  const { data } = await admin.from("elite_tracker_club_members").select("profile_id").in("club_id", clubIds);
  return [...new Set(((data as { profile_id: string }[] | null) ?? []).map((r) => r.profile_id))].filter((x) => x !== profileId);
}

// Tag the teammates who trained with the poster. NOT a server action:
// called only by the post route, with the id it took from the session and
// the post it just stored. Clubmates only, never across a block, at most
// eight (cleanTags; the database holds eight too); a gym post skips a
// teammate who does not log gym, so nobody gets a card they cannot use.
export async function tagTogether(input: { posterId: string; logId: string; kind: Kind; raw: unknown }): Promise<number> {
  const admin = createServiceClient();
  if (!admin) return 0;
  const mates = await clubmateIdsOf(admin, input.posterId);
  if (mates.length === 0) return 0;
  const blocks = await blocksWith(admin, input.posterId, mates);
  let ids = cleanTags({ raw: input.raw, posterId: input.posterId, teammates: new Set(mates), blocks });
  if (ids.length && input.kind === "gym") {
    const { data } = await admin.from("elite_trackers").select("profile_id, grade").in("profile_id", ids);
    const gym = new Set(((data as { profile_id: string; grade: string | null }[] | null) ?? []).filter((t) => tracksGym(t.grade)).map((t) => t.profile_id));
    ids = ids.filter((x) => gym.has(x));
  }
  if (ids.length === 0) return 0;
  const { error } = await admin
    .from("elite_trained_together")
    .insert(ids.map((tagged) => ({ log_id: input.logId, tagged, tagger: input.posterId })));
  return error ? 0 : ids.length;
}
