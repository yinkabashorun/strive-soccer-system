// The weekly club matchup (083): reading it for a club's page, and the two
// things the hourly run does with it (decide the weeks that have ended,
// match the clubs on Monday). The rules are pure in club-matchups.ts.
//
// UNTIL MIGRATION 083 IS APPLIED the table is not there: every read here
// answers null or "off", so no card is drawn, nothing is written and
// nothing fails. Everything is exactly as it was.
//
// What a club's members are shown of the other club: its name, its crest
// and its training time per player. Never a player, never a list.
import { createServiceClient } from "./supabase/server";
import { everyRow } from "./supabase/every-row";
import { nyToday, shiftDay } from "./time";
import { startCronRun, updateCronRun } from "./cron-log";
import type { Admin } from "./tracker-server";
import {
  MATCHUP_MIN_PLAYERS,
  decide,
  lastMonday,
  matchingDue,
  matchupMonday,
  matchupRows,
  matchupView,
  opponentsOf,
  pairClubs,
  type MatchupLog,
  type MatchupRow,
  type MatchupView,
} from "./club-matchups";

const TABLE = "elite_club_matchups";
const COLUMNS = "week_monday, club_id, opponent_id, roster, minutes, players, result, decided_at";
export const CLUB_MATCHUPS_JOB = "club-matchups";

type Raw = Omit<MatchupRow, "roster"> & { roster: string[] | null };
const clean = (r: Raw): MatchupRow => ({ ...r, roster: r.roster ?? [] });

// Training these players logged between two days. Paged: a busy week of
// forty players can pass a thousand rows.
async function trainingOf(admin: Admin, ids: string[], since: string, until: string): Promise<MatchupLog[]> {
  const out: MatchupLog[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 200) {
    const some = unique.slice(i, i + 200);
    out.push(
      ...(await everyRow<MatchupLog>((from, to) =>
        admin
          .from("elite_training_logs")
          .select("profile_id, trained_on, minutes, kind")
          .in("profile_id", some)
          .eq("kind", "training")
          .gte("trained_on", since)
          .lte("trained_on", until)
          .order("id")
          .range(from, to)
      ))
    );
  }
  return out;
}

// A club's matchup, for its page and its card: this week's, last week's
// result and the record. null when the matchup table is not there.
export async function matchupFor(
  admin: Admin,
  club: { id: string; name: string; members: number },
  today: string
): Promise<MatchupView | null> {
  const { data, error } = await admin
    .from(TABLE)
    .select(COLUMNS)
    .eq("club_id", club.id)
    .order("week_monday", { ascending: false })
    .limit(600);
  if (error) return null;
  const rows = ((data as Raw[] | null) ?? []).map(clean);
  const monday = matchupMonday(today);
  const recent = rows.filter((r) => r.opponent_id && r.week_monday >= lastMonday(monday));
  const theirRows: MatchupRow[] = [];
  for (const r of recent) {
    const { data: other } = await admin
      .from(TABLE)
      .select(COLUMNS)
      .eq("club_id", r.opponent_id!)
      .eq("week_monday", r.week_monday)
      .maybeSingle();
    if (other) theirRows.push(clean(other as Raw));
  }
  const names = new Map<string, string>();
  const otherIds = [...new Set(recent.map((r) => r.opponent_id!))];
  if (otherIds.length) {
    const { data: clubs } = await admin.from("elite_tracker_clubs").select("id, name").in("id", otherIds);
    for (const c of (clubs as { id: string; name: string }[] | null) ?? []) names.set(c.id, c.name);
  }
  // only a week not decided yet is read from the logs
  const open = [...recent, ...theirRows].filter((r) => !r.decided_at);
  const logs = open.length
    ? await trainingOf(admin, open.flatMap((r) => r.roster), lastMonday(monday), shiftDay(monday, 6))
    : [];
  return matchupView({ club, today, rows, theirRows, nameOf: (id) => names.get(id) ?? "A club", logs });
}

// The same, for a page that has only the viewer (the website's club page).
// The example account and a build with no database have no matchup.
export async function clubMatchupFor(
  viewer: { demo?: boolean },
  club: { id: string; name: string; members: number; ended: boolean },
  today: string
): Promise<MatchupView | null> {
  if (viewer.demo || club.ended) return null;
  const admin = createServiceClient();
  return admin ? matchupFor(admin, club, today) : null;
}

// ---- The hourly run ----------------------------------------------------------

export type MatchupRun = {
  status: "off" | "idle" | "done" | "failed";
  matched: number; // matchups made this run
  alone: number; // clubs with nobody to play
  decided: number; // matchups decided this run
  left: number; // matchups still to decide (the next run goes on)
};

const NOTHING: MatchupRun = { status: "idle", matched: 0, alone: 0, decided: 0, left: 0 };
// A run stops deciding after this long and goes on next hour, so this step
// can never eat the time of anything else on the hourly run.
const DECIDE_BUDGET_MS = 60_000;

type Club = { id: string; county: string | null };
type Member = { club_id: string; profile_id: string };

async function rowsOfWeek(admin: Admin, monday: string): Promise<MatchupRow[]> {
  return (
    await everyRow<Raw>((from, to) =>
      admin.from(TABLE).select(COLUMNS).eq("week_monday", monday).order("club_id").range(from, to)
    )
  ).map(clean);
}

// The matchups to make now: every club that can be matched and has no row
// for this week, paired by the week's own order.
async function toMatch(admin: Admin, monday: string): Promise<MatchupRow[]> {
  const [clubs, members, thisWeek, lastWeek] = await Promise.all([
    everyRow<Club>((from, to) =>
      admin.from("elite_tracker_clubs").select("id, county").is("archived_at", null).order("id").range(from, to)
    ),
    everyRow<Member>((from, to) =>
      admin.from("elite_tracker_club_members").select("club_id, profile_id").order("club_id").order("profile_id").range(from, to)
    ),
    rowsOfWeek(admin, monday),
    rowsOfWeek(admin, lastMonday(monday)),
  ]);
  const roster = new Map<string, string[]>();
  for (const m of members) roster.set(m.club_id, [...(roster.get(m.club_id) ?? []), m.profile_id]);
  const has = new Set(thisWeek.map((r) => r.club_id));
  const ready = clubs.filter((c) => !has.has(c.id) && (roster.get(c.id)?.length ?? 0) >= MATCHUP_MIN_PLAYERS);
  if (ready.length === 0) return [];
  const pairing = pairClubs({ clubs: ready, monday, lastOpponent: opponentsOf(lastWeek) });
  return matchupRows({ pairing, monday, rosterOf: (id) => roster.get(id) ?? [] });
}

// Decide the matchups of weeks that have ended. Each side is written once
// (the update only lands on a row not decided yet) and never again.
async function decideOpen(admin: Admin, monday: string): Promise<{ decided: number; left: number }> {
  const open = (
    await everyRow<Raw>((from, to) =>
      admin
        .from(TABLE)
        .select(COLUMNS)
        .is("decided_at", null)
        .not("opponent_id", "is", null)
        .lt("week_monday", monday)
        .order("week_monday")
        .order("club_id")
        .range(from, to)
    )
  ).map(clean);
  const key = (week: string, x: string, y: string) => `${week}:${x < y ? x : y}:${x < y ? y : x}`;
  const pairs = new Map<string, MatchupRow[]>();
  for (const r of open) {
    const k = key(r.week_monday, r.club_id, r.opponent_id!);
    pairs.set(k, [...(pairs.get(k) ?? []), r]);
  }
  const started = Date.now();
  let decided = 0;
  let left = pairs.size;
  for (const sides of pairs.values()) {
    if (Date.now() - started > DECIDE_BUDGET_MS) break;
    const a = sides[0];
    let b: MatchupRow | null = sides[1] ?? null;
    if (!b) {
      // the other side was decided by an earlier run: read it as stored
      const { data } = await admin.from(TABLE).select(COLUMNS).eq("week_monday", a.week_monday).eq("club_id", a.opponent_id!).maybeSingle();
      b = data ? clean(data as Raw) : null;
    }
    left--;
    if (!b) continue; // the other club is gone: nothing to decide against
    const logs = await trainingOf(admin, [...a.roster, ...b.roster], a.week_monday, shiftDay(a.week_monday, 6));
    const at = new Date().toISOString();
    for (const d of decide({ a, b, logs })) {
      await admin
        .from(TABLE)
        .update({ minutes: d.minutes, players: d.players, result: d.result, decided_at: at })
        .eq("week_monday", a.week_monday)
        .eq("club_id", d.club_id)
        .is("decided_at", null);
    }
    decided++;
  }
  return { decided, left };
}

// One hourly run: decide what has ended, then match (on Monday, or when
// the week has no matchups at all yet). Never throws. A run that has
// nothing to do writes nothing and logs nothing; one that does leaves a
// row in elite_cron_runs the way the plan builder does (written at the
// start, finished at the end, so a crash shows as "started, never
// finished").
export async function runClubMatchups(opts: { authed: boolean; today?: string }): Promise<MatchupRun> {
  const admin = createServiceClient();
  if (!admin) return { ...NOTHING, status: "off" };
  const today = opts.today ?? nyToday();
  const monday = matchupMonday(today);
  let runId: string | null = null;
  try {
    const probe = await admin.from(TABLE).select("club_id", { count: "exact", head: true }).eq("week_monday", monday);
    if (probe.error) return { ...NOTHING, status: "off" }; // 083 is not applied
    const waiting = await admin
      .from(TABLE)
      .select("club_id", { count: "exact", head: true })
      .is("decided_at", null)
      .not("opponent_id", "is", null)
      .lt("week_monday", monday);
    const rows = matchingDue({ today, weekHasRows: (probe.count ?? 0) > 0 }) ? await toMatch(admin, monday) : [];
    if (rows.length === 0 && !(waiting.count ?? 0)) return NOTHING;

    runId = await startCronRun({ job: CLUB_MATCHUPS_JOB, trigger: "cron", authed: opts.authed });
    // last week is decided before this week is matched
    const { decided, left } = await decideOpen(admin, monday);
    // Both sides of a matchup go in the same statement, so a matchup is
    // stored whole or not at all; a row already there is left as it is.
    let failed: string | null = null;
    for (let i = 0; i < rows.length && !failed; i += 500) {
      const { error } = await admin
        .from(TABLE)
        .upsert(rows.slice(i, i + 500), { onConflict: "week_monday,club_id", ignoreDuplicates: true });
      if (error) failed = error.message;
    }
    const alone = rows.filter((r) => !r.opponent_id).length;
    const matched = (rows.length - alone) / 2;
    const parts = [
      matched ? `${matched} matchups made` : null,
      alone ? `${alone} clubs with nobody to play` : null,
      decided ? `${decided} decided` : null,
      left ? `${left} still to decide` : null,
    ].filter(Boolean);
    await updateCronRun(runId, {
      built: matched,
      skipped: alone,
      errors: failed ? [{ name: "club matchups", error: failed }] : [],
      summary: failed ? "could not store this week's matchups" : parts.join(", ") || "nothing to do",
      finished: true,
    });
    return { status: failed ? "failed" : "done", matched: failed ? 0 : matched, alone: failed ? 0 : alone, decided, left };
  } catch (e) {
    const error = e instanceof Error ? e.message : "unknown error";
    await updateCronRun(runId, { errors: [{ name: "club matchups", error }], summary: "failed", finished: true }).catch(() => undefined);
    return { ...NOTHING, status: "failed" };
  }
}
