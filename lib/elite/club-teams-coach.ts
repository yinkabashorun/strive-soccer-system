// Clubs as teams (077): the COACH's view at /coach/free. The only place
// that reads every club's sessions, games and event entries, and only the
// coach page imports it. Nothing a player sees comes from here.
//
// Nothing in the app waits on this page: games confirm themselves and
// clubs plan for themselves. It is where a coach CAN act: a reported
// session or game (cancel it, or no action), any session or game (cancel
// it), the Strive events (make, open, mark entries paid), and the county
// and "Open to games" of the clubs a coach made.
import { createServiceClient } from "./supabase/server";
import { namesOf } from "./tracker-server";
import { EVENT_COLUMNS, PLAN_COLUMNS } from "./club-teams-server";
import { DEMO_ENTRY, DEMO_EVENT, DEMO_TEAM_CLUBS, demoPlans } from "./club-teams-demo";
import {
  PLAN_REPORT_REASONS,
  entryLine,
  entryState,
  eventWhen,
  resultLine,
  resultState,
  type EntryState,
  type PlanKind,
  type PlanRow,
  type PlanStatus,
  type StriveEvent,
} from "./club-teams";

export type CoachPlan = {
  id: string;
  kind: PlanKind;
  organizer: string;
  opponent: string | null;
  when: string;
  place: string;
  status: PlanStatus;
  ins: number;
  result: string | null;
  reports: { reporter: string; reason: string; at: string }[]; // open ones
};

export type CoachEntry = {
  id: string;
  club: string;
  state: EntryState;
  line: string;
  roster: { name: string; in: boolean }[];
  waivers: number; // "I'm in" acceptances recorded for this entry
};

export type CoachEvent = StriveEvent & { when: string; entries: CoachEntry[] };

export type TeamsOverview = {
  plans: CoachPlan[]; // reported first, then by start
  events: CoachEvent[]; // newest first
  coachClubs: { id: string; name: string; county: string | null; open: boolean }[];
};

const label = (id: string) => PLAN_REPORT_REASONS.find((r) => r.id === id)?.label ?? "Something else";

export function demoTeamsOverview(): TeamsOverview {
  const name = (id: string | null) => (id ? DEMO_TEAM_CLUBS.find((c) => c.id === id)?.name ?? "A club" : null);
  const nowMs = Date.now();
  return {
    plans: demoPlans().map((p, i) => ({
      id: p.id,
      kind: p.kind,
      organizer: name(p.club_id) ?? "A club",
      opponent: name(p.opponent_id),
      when: eventWhen(p.starts_at),
      place: p.place,
      status: p.status,
      ins: p.ins,
      result: p.kind === "game" ? resultLine(resultState(p, nowMs), false) : null,
      reports: i === 1 ? [{ reporter: "Dani Ramos", reason: label("place"), at: new Date().toISOString() }] : [],
    })),
    events: [
      {
        ...DEMO_EVENT,
        when: eventWhen(DEMO_EVENT.starts_at),
        entries: [
          {
            id: "demo-entry-1",
            club: name(DEMO_ENTRY.clubId) ?? "A club",
            state: DEMO_ENTRY.state,
            line: entryLine(DEMO_ENTRY.state, DEMO_ENTRY.waiting),
            roster: [
              { name: "Example Player", in: true },
              { name: "Dani Ramos", in: true },
            ],
            waivers: 2,
          },
        ],
      },
    ],
    coachClubs: [{ id: "demo-club-1", name: "Strive Elite 5v5: Team 7", county: null, open: false }],
  };
}

export async function getTeamsOverview(): Promise<TeamsOverview> {
  const admin = createServiceClient();
  if (!admin) return demoTeamsOverview();
  const nowMs = Date.now();
  const since = new Date(nowMs - 14 * 86_400_000).toISOString();

  const [{ data: planData }, { data: reportData }, { data: eventData }, { data: clubData }] = await Promise.all([
    admin.from("elite_club_plans").select(PLAN_COLUMNS).gte("starts_at", since).order("starts_at").limit(500),
    admin.from("elite_plan_reports").select("plan_id, reporter_id, reason, created_at").is("resolved_at", null).order("created_at").limit(500),
    admin.from("elite_strive_events").select(EVENT_COLUMNS).order("starts_at", { ascending: false }).limit(50),
    admin.from("elite_tracker_clubs").select("id, name, county, open_to_games").eq("kind", "coach").is("archived_at", null).limit(500),
  ]);
  const reports = (reportData as { plan_id: string; reporter_id: string; reason: string; created_at: string }[] | null) ?? [];
  const plans = new Map(((planData as PlanRow[] | null) ?? []).map((p) => [p.id, p]));
  // a reported plan older than the window still shows
  const missing = [...new Set(reports.map((r) => r.plan_id))].filter((id) => !plans.has(id));
  if (missing.length) {
    const { data } = await admin.from("elite_club_plans").select(PLAN_COLUMNS).in("id", missing);
    for (const p of (data as PlanRow[] | null) ?? []) plans.set(p.id, p);
  }
  const planList = [...plans.values()];
  const clubIds = [...new Set(planList.flatMap((p) => [p.club_id, p.opponent_id].filter((x): x is string => Boolean(x))))];
  const { data: clubNames } = clubIds.length ? await admin.from("elite_tracker_clubs").select("id, name").in("id", clubIds) : { data: [] };
  const clubName = new Map(((clubNames as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name]));
  const { data: insData } = planList.length
    ? await admin.from("elite_plan_ins").select("plan_id").in("plan_id", planList.map((p) => p.id))
    : { data: [] };
  const insOf = new Map<string, number>();
  for (const r of (insData as { plan_id: string }[] | null) ?? []) insOf.set(r.plan_id, (insOf.get(r.plan_id) ?? 0) + 1);

  // events and their entries
  const events = (eventData as StriveEvent[] | null) ?? [];
  const { data: entryData } = events.length
    ? await admin.from("elite_event_entries").select("id, event_id, club_id, sent_at, paid_at").in("event_id", events.map((e) => e.id))
    : { data: [] };
  const entries = (entryData as { id: string; event_id: string; club_id: string; sent_at: string | null; paid_at: string | null }[] | null) ?? [];
  const { data: rosterData } = entries.length
    ? await admin.from("elite_event_roster").select("entry_id, profile_id, in_at").in("entry_id", entries.map((e) => e.id))
    : { data: [] };
  const roster = (rosterData as { entry_id: string; profile_id: string; in_at: string | null }[] | null) ?? [];
  const { data: waiverData } = entries.length
    ? await admin.from("elite_event_waivers").select("entry_id").in("entry_id", entries.map((e) => e.id))
    : { data: [] };
  const waiversOf = new Map<string, number>();
  for (const w of (waiverData as { entry_id: string }[] | null) ?? []) waiversOf.set(w.entry_id, (waiversOf.get(w.entry_id) ?? 0) + 1);
  const entryClubIds = entries.map((e) => e.club_id).filter((id) => !clubName.has(id));
  if (entryClubIds.length) {
    const { data } = await admin.from("elite_tracker_clubs").select("id, name").in("id", entryClubIds);
    for (const c of (data as { id: string; name: string }[] | null) ?? []) clubName.set(c.id, c.name);
  }
  const names = await namesOf(admin, [...new Set([...roster.map((r) => r.profile_id), ...reports.map((r) => r.reporter_id)])]);

  const coachPlans: CoachPlan[] = planList
    .map((p) => ({
      id: p.id,
      kind: p.kind,
      organizer: clubName.get(p.club_id) ?? "A club",
      opponent: p.opponent_id ? clubName.get(p.opponent_id) ?? "A club" : null,
      when: eventWhen(p.starts_at),
      place: p.place,
      status: p.status,
      ins: insOf.get(p.id) ?? 0,
      result: p.kind === "game" ? resultLine(resultState(p, nowMs), false) : null,
      reports: reports
        .filter((r) => r.plan_id === p.id)
        .map((r) => ({ reporter: names.get(r.reporter_id) ?? "A player", reason: label(r.reason), at: r.created_at })),
      _start: p.starts_at,
    }))
    .sort((a, b) => Number(b.reports.length > 0) - Number(a.reports.length > 0) || a._start.localeCompare(b._start))
    .map(({ _start, ...rest }) => {
      void _start;
      return rest;
    });

  return {
    plans: coachPlans,
    events: events.map((e) => ({
      ...e,
      when: eventWhen(e.starts_at),
      entries: entries
        .filter((x) => x.event_id === e.id)
        .map((x) => {
          const players = roster.filter((r) => r.entry_id === x.id);
          const state = entryState({ roster: players, sent_at: x.sent_at, paid_at: x.paid_at });
          return {
            id: x.id,
            club: clubName.get(x.club_id) ?? "A club",
            state,
            line: entryLine(state, players.filter((r) => !r.in_at).length),
            roster: players.map((r) => ({ name: names.get(r.profile_id) ?? "A player", in: Boolean(r.in_at) })),
            waivers: waiversOf.get(x.id) ?? 0,
          };
        }),
    })),
    coachClubs: ((clubData as { id: string; name: string; county: string | null; open_to_games: boolean }[] | null) ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      county: c.county,
      open: c.open_to_games,
    })),
  };
}
