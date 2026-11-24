"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "./supabase/server";
import { getViewer } from "./session";
import { nyToday } from "./time";
import { clubIdsOf, getTracker, insertLog, type Admin } from "./tracker-server";
import { APP_URL } from "./app-url";
import { textCoaches } from "./coach-alerts";
import { noticeClubPlan } from "./free-notices-server";
import {
  EVENT_COLUMNS,
  captainsOf,
  memberCountsOf,
  planById,
  plansOf,
  playAcceptancesOf,
  teamRowsOf,
  teammatesFor,
  toTeamClub,
  type Teammate,
} from "./club-teams-server";
import {
  CONFIRM_HOURS,
  COUNTY_MESSAGE,
  NEEDS_ORGANIZER_OK,
  NEEDS_PLAYER_OK,
  OPEN_NEEDS_COUNTY_MESSAGE,
  PLACE_MESSAGE,
  PLAN_REFUSED,
  PLAY_TERMS_VERSION,
  SCORE_MESSAGE,
  START_MESSAGE,
  cleanCounty,
  cleanEvent,
  cleanPlace,
  cleanPlanMinutes,
  cleanPlanReason,
  cleanPlanTitle,
  cleanScore,
  cleanStart,
  entryState,
  eventDay,
  gameDecision,
  mayAddTogether,
  mayAnswerGame,
  mayAnswerScore,
  mayCancel,
  mayEnterScore,
  mayJoin,
  mayViewPlan,
  nyInstant,
  openProblem,
  pendingGamesOf,
  planReportText,
  playedOpponents,
  rosterProblem,
  rosterProblemText,
  sideOf,
  takingEntries,
  under18On,
  type EventInput,
  type StriveEvent,
} from "./club-teams";
import { DAY_CAP_MESSAGE, FREE_HOME, FREE_WEEK, GYM_REFUSED_MESSAGE, mayLog, shortName, type Kind } from "./tracker";

// Clubs as teams (077): writing it. The same shape as tracker-actions.ts:
// the signed-in viewer is resolved first, every id that says who is acting
// comes from the session, never from the browser, and only then is the
// service client used. The example account answers ok and saves nothing.
//
// Nothing here sends a player a text or an email: every request a player
// answers is a card in the app. The one notification is noticeClubPlan
// (087): when a club's training session is planned, or a game is on, the
// members of the club(s) hear once, if they left notifications on. The one
// text is to the coaches, once, when a session or game is first reported
// (the same as a reported post or club name).
//
// Sessions and games are organized by clubs, never by Strive: a captain
// accepts that once before planning (the organizer sheet), a player once
// before their first "I'm in" (the player sheet), both recorded. They are
// closed to the clubs involved, and a place is a public field or park,
// never a street address (cleanPlace).

type Fail = { ok: false; error: string };
type Ok = { ok: true };
const fail = (error: string): Fail => ({ ok: false, error });
const OFFLINE = "We could not reach the server. Try again in a minute.";
const NOT_A_CLUB = "That club is not there any more.";
const NOT_CAPTAIN = "Only the club's captain can do that.";
const GONE = "That is not there any more.";

function touch(...paths: string[]) {
  revalidatePath(FREE_HOME);
  revalidatePath(FREE_WEEK);
  for (const p of paths) revalidatePath(p);
}

type Player = { kind: "no"; error: string } | { kind: "demo" } | { kind: "ok"; admin: Admin; profileId: string; name: string };

async function player(): Promise<Player> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "player") return { kind: "no", error: "Sign in first." };
  if (viewer.demo) return { kind: "demo" };
  const admin = createServiceClient();
  if (!admin) return { kind: "demo" };
  if (!(await getTracker(viewer.profile.id))) return { kind: "no", error: "Sign in first." };
  return { kind: "ok", admin, profileId: viewer.profile.id, name: viewer.profile.full_name };
}

type Coach = { kind: "no" } | { kind: "demo" } | { kind: "ok"; admin: Admin; profileId: string };

async function coach(): Promise<Coach> {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") return { kind: "no" };
  if (viewer.demo) return { kind: "demo" };
  const admin = createServiceClient();
  if (!admin) return { kind: "demo" };
  return { kind: "ok", admin, profileId: viewer.profile.id };
}

const ONLY_COACH = "Only a coach can do this.";
const id = (v: unknown): string | null => (typeof v === "string" && /^[0-9a-f-]{36}$/.test(v) ? v : null);

// ---- County and "Open to games" ---------------------------------------------

async function saveCounty(admin: Admin, clubId: string, countyInput: unknown, open: unknown): Promise<Ok | Fail> {
  const blank = countyInput === null || countyInput === "";
  const county = blank ? null : cleanCounty(countyInput);
  if (!blank && !county) return fail(COUNTY_MESSAGE);
  const isOpen = open === true;
  if (isOpen && !county) return fail(OPEN_NEEDS_COUNTY_MESSAGE);
  const { error } = await admin
    .from("elite_tracker_clubs")
    .update({ county, open_to_games: isOpen })
    .eq("id", clubId);
  return error ? fail(OFFLINE) : { ok: true };
}

// The captain sets the club's county and whether it is open to games.
// Switching off cancels nothing already on the calendar.
export async function setClubCounty(clubId: string, countyInput: string | null, open: boolean): Promise<Ok | Fail> {
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true };
  const club = id(clubId) ? (await teamRowsOf(p.admin, [clubId]))[0] : null;
  if (!club) return fail(NOT_A_CLUB);
  if (club.captain_id !== p.profileId || club.archived_at) return fail(NOT_CAPTAIN);
  const res = await saveCounty(p.admin, clubId, countyInput, open);
  if (res.ok) touch(`/log/club/${clubId}`);
  return res;
}

// A coach sets them for a club a coach made (it has no captain), or any club.
export async function setClubCountyAsCoach(clubId: string, countyInput: string | null, open: boolean): Promise<Ok | Fail> {
  const c = await coach();
  if (c.kind === "no") return fail(ONLY_COACH);
  if (c.kind === "demo") return { ok: true };
  if (!id(clubId)) return fail(NOT_A_CLUB);
  const res = await saveCounty(c.admin, clubId, countyInput, open);
  if (res.ok) revalidatePath("/coach/free");
  return res;
}

// ---- The two one-time sheets ---------------------------------------------------------

// One tap on the organizer sheet (a captain, before planning anything) or
// the player sheet (before a first "I'm in"). Recorded with the wording's
// version; asked again only when PLAY_TERMS_VERSION changes.
export async function acceptPlayTerms(kind: "organizer" | "player"): Promise<Ok | Fail> {
  if (kind !== "organizer" && kind !== "player") return fail(GONE);
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true };
  const { error } = await p.admin
    .from("elite_play_acceptances")
    .upsert({ profile_id: p.profileId, kind, version: PLAY_TERMS_VERSION }, { onConflict: "profile_id,kind,version", ignoreDuplicates: true });
  return error ? fail(OFFLINE) : { ok: true };
}




// ---- Plans: club training and games ---------------------------------------------------

export type PlanInput = { day?: unknown; time?: unknown; minutes?: unknown; place?: unknown; title?: unknown };

function checkPlan(input: PlanInput, nowMs: number): { ok: true; starts_at: string; minutes: number; place: string; title: string | null } | Fail {
  const at = typeof input.day === "string" && typeof input.time === "string" ? nyInstant(input.day, input.time) : null;
  const starts_at = at ? cleanStart(at, nowMs) : null;
  if (!starts_at) return fail(START_MESSAGE);
  const minutes = cleanPlanMinutes(input.minutes);
  if (minutes === null) return fail("Pick how long it runs.");
  const place = cleanPlace(input.place);
  if (!place) return fail(PLACE_MESSAGE);
  const blankTitle = input.title === undefined || input.title === null || (typeof input.title === "string" && !input.title.trim());
  const title = blankTitle ? null : cleanPlanTitle(input.title);
  if (!blankTitle && !title) return fail("Give it a short title, up to 40 letters, or leave it blank.");
  return { ok: true, starts_at, minutes, place, title };
}

// The captain plans a club training session: members only.
export async function planTraining(clubId: string, input: PlanInput): Promise<{ ok: true; id: string } | Fail> {
  const checked = checkPlan(input, Date.now());
  if (!checked.ok) return checked;
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true, id: "demo-plan-1" };
  const club = id(clubId) ? (await teamRowsOf(p.admin, [clubId]))[0] : null;
  if (!club) return fail(NOT_A_CLUB);
  if (club.captain_id !== p.profileId || club.archived_at) return fail(NOT_CAPTAIN);
  if (!(await playAcceptancesOf(p.admin, p.profileId)).organizer) return fail(NEEDS_ORGANIZER_OK);
  const { data, error } = await p.admin
    .from("elite_club_plans")
    .insert({
      kind: "training",
      club_id: clubId,
      title: checked.title,
      starts_at: checked.starts_at,
      minutes: checked.minutes,
      place: checked.place,
      status: "on",
      created_by: p.profileId,
    })
    .select("id")
    .single();
  if (error || !data) return fail(OFFLINE);
  touch(`/log/club/${clubId}`);
  // the club's members hear about it, once (best effort)
  await noticeClubPlan({ planId: data.id as string, byId: p.profileId }).catch(() => 0);
  return { ok: true, id: data.id as string };
}

// The captain sends another club a game: day, time, length, place. That
// club's captain accepts or passes; until then only this club sees it.
export async function planGame(clubId: string, opponentId: string, input: PlanInput): Promise<{ ok: true; id: string } | Fail> {
  const nowMs = Date.now();
  const checked = checkPlan({ ...input, title: null }, nowMs);
  if (!checked.ok) return checked;
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true, id: "demo-plan-3" };
  if (!id(clubId) || !id(opponentId)) return fail(NOT_A_CLUB);
  const rows = await teamRowsOf(p.admin, [clubId, opponentId]);
  const fromRow = rows.find((r) => r.id === clubId);
  const toRow = rows.find((r) => r.id === opponentId);
  if (!fromRow || !toRow) return fail(NOT_A_CLUB);
  if (!(await playAcceptancesOf(p.admin, p.profileId)).organizer && fromRow.captain_id === p.profileId) return fail(NEEDS_ORGANIZER_OK);
  const counts = await memberCountsOf(p.admin, [clubId, opponentId]);
  const own = await plansOf(p.admin, [clubId]);
  const decision = gameDecision({
    viewerIsCaptain: fromRow.captain_id === p.profileId,
    from: toTeamClub(fromRow, counts.get(clubId) ?? 0),
    to: toTeamClub(toRow, counts.get(opponentId) ?? 0),
    pendingFrom: pendingGamesOf(own, clubId),
    playedBefore: playedOpponents(own, clubId).includes(opponentId),
  });
  if (decision !== "ok") return fail(PLAN_REFUSED[decision]);
  const { data, error } = await p.admin
    .from("elite_club_plans")
    .insert({
      kind: "game",
      club_id: clubId,
      opponent_id: opponentId,
      starts_at: checked.starts_at,
      minutes: checked.minutes,
      place: checked.place,
      status: "pending",
      created_by: p.profileId,
    })
    .select("id")
    .single();
  if (error?.message?.includes("games_pending_full")) return fail(PLAN_REFUSED.too_many);
  if (error || !data) return fail(OFFLINE);
  touch(`/log/club/${clubId}`);
  return { ok: true, id: data.id as string };
}

// The other captain accepts the game (once they accepted the organizer
// sheet: their club is in it too) or passes.
export async function answerGame(planId: string, accept: boolean): Promise<Ok | Fail> {
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true };
  const plan = await planById(p.admin, planId);
  if (!plan) return fail(GONE);
  if (!mayAnswerGame(plan, await captainsOf(p.admin, p.profileId))) return fail(NOT_CAPTAIN);
  if (Date.parse(plan.starts_at) <= Date.now()) return fail("That game's start time has passed.");
  if (accept === true && !(await playAcceptancesOf(p.admin, p.profileId)).organizer) return fail(NEEDS_ORGANIZER_OK);
  const { error } = await p.admin
    .from("elite_club_plans")
    .update({ status: accept === true ? "on" : "passed", answered_by: p.profileId, answered_at: new Date().toISOString() })
    .eq("id", plan.id)
    .eq("status", "pending");
  if (error) return fail(OFFLINE);
  touch(`/log/club/${plan.club_id}`, `/log/club/${plan.opponent_id}`, `/log/plan/${plan.id}`);
  // the game is on: both clubs' members hear about it, once (best effort)
  if (accept === true) await noticeClubPlan({ planId: plan.id, byId: p.profileId }).catch(() => 0);
  return { ok: true };
}

// A captain of a club in it calls it off before it starts.
export async function cancelPlan(planId: string): Promise<Ok | Fail> {
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true };
  const plan = await planById(p.admin, planId);
  if (!plan) return fail(GONE);
  if (!mayCancel(plan, { captainOf: await captainsOf(p.admin, p.profileId), staff: false }, Date.now())) return fail(NOT_CAPTAIN);
  const { error } = await p.admin
    .from("elite_club_plans")
    .update({ status: "cancelled", cancelled_by: p.profileId, cancelled_at: new Date().toISOString() })
    .eq("id", plan.id);
  if (error) return fail(OFFLINE);
  touch(`/log/club/${plan.club_id}`, `/log/plan/${plan.id}`, ...(plan.opponent_id ? [`/log/club/${plan.opponent_id}`] : []));
  return { ok: true };
}

// "I'm in", or out again. Members of the clubs in it only, after the
// one-time player sheet.
export async function setImIn(planId: string, isIn: boolean): Promise<Ok | Fail> {
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true };
  const plan = await planById(p.admin, planId);
  if (!plan) return fail(GONE);
  const clubIds = new Set(await clubIdsOf(p.admin, p.profileId));
  if (isIn !== true) {
    await p.admin.from("elite_plan_ins").delete().eq("plan_id", plan.id).eq("profile_id", p.profileId);
    touch(`/log/plan/${plan.id}`, `/log/club/${plan.club_id}`);
    return { ok: true };
  }
  if (!mayJoin(plan, clubIds, Date.now())) return fail(GONE);
  if (!(await playAcceptancesOf(p.admin, p.profileId)).player) return fail(NEEDS_PLAYER_OK);
  const side = sideOf(plan, clubIds);
  if (!side) return fail(GONE);
  const { error } = await p.admin
    .from("elite_plan_ins")
    .upsert({ plan_id: plan.id, profile_id: p.profileId, club_id: side }, { onConflict: "plan_id,profile_id", ignoreDuplicates: true });
  if (error) return fail(OFFLINE);
  touch(`/log/plan/${plan.id}`, `/log/club/${plan.club_id}`, ...(plan.opponent_id ? [`/log/club/${plan.opponent_id}`] : []));
  return { ok: true };
}

// Either captain enters the score once the game has started; the other
// confirms it or says it is not right. No answer in 24 hours (CONFIRM_HOURS): it counts.
// scoreClub is the club that organized it, scoreOpponent the other.
export async function enterScore(planId: string, scoreClub: unknown, scoreOpponent: unknown): Promise<Ok | Fail> {
  const a = cleanScore(scoreClub);
  const b = cleanScore(scoreOpponent);
  if (a === null || b === null) return fail(SCORE_MESSAGE);
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true };
  const plan = await planById(p.admin, planId);
  if (!plan) return fail(GONE);
  const captainOf = await captainsOf(p.admin, p.profileId);
  if (!mayEnterScore(plan, captainOf, Date.now())) return fail("Only a captain of either club enters the score, once the game has started.");
  const side = captainOf.has(plan.club_id) ? plan.club_id : plan.opponent_id;
  const { error } = await p.admin
    .from("elite_club_plans")
    .update({ score_club: a, score_opponent: b, score_by_club: side, score_entered_by: p.profileId, score_entered_at: new Date().toISOString() })
    .eq("id", plan.id)
    .is("score_entered_at", null);
  if (error) return fail(OFFLINE);
  touch(`/log/plan/${plan.id}`, `/log/club/${plan.club_id}`, `/log/club/${plan.opponent_id}`);
  return { ok: true };
}

export async function answerScore(planId: string, confirm: boolean): Promise<Ok | Fail> {
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true };
  const plan = await planById(p.admin, planId);
  if (!plan) return fail(GONE);
  if (!mayAnswerScore(plan, await captainsOf(p.admin, p.profileId), Date.now())) return fail(`Only the other club's captain answers, within ${CONFIRM_HOURS} hours.`);
  const { error } = await p.admin
    .from("elite_club_plans")
    .update({ score_answer: confirm === true ? "confirmed" : "disputed", score_answered_at: new Date().toISOString() })
    .eq("id", plan.id)
    .is("score_answer", null);
  if (error) return fail(OFFLINE);
  touch(`/log/plan/${plan.id}`, `/log/club/${plan.club_id}`, `/log/club/${plan.opponent_id}`);
  return { ok: true };
}

// Report a session or game the player can see. It goes to the coach queue
// (one text to the coaches the first time), so a coach can act; nothing in
// the app waits on it.
export async function reportPlan(planId: string, reasonInput: string): Promise<Ok | Fail> {
  const reason = cleanPlanReason(reasonInput);
  if (!reason) return fail("Pick what is wrong.");
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true };
  const plan = await planById(p.admin, planId);
  if (!plan) return fail(GONE);
  if (!mayViewPlan(plan, { clubIds: new Set(await clubIdsOf(p.admin, p.profileId)), staff: false })) return fail(GONE);
  const { count } = await p.admin.from("elite_plan_reports").select("id", { count: "exact", head: true }).eq("plan_id", plan.id);
  const { error } = await p.admin
    .from("elite_plan_reports")
    .upsert({ plan_id: plan.id, reporter_id: p.profileId, reason }, { onConflict: "plan_id,reporter_id", ignoreDuplicates: true });
  if (error) return fail(OFFLINE);
  if (!count) await textCoaches(planReportText(plan.kind, `${APP_URL}/coach/free`)).catch(() => 0);
  return { ok: true };
}

// ---- Strive events: entering ---------------------------------------------------------

async function eventById(admin: Admin, eventId: string): Promise<StriveEvent | null> {
  if (!id(eventId)) return null;
  const { data } = await admin.from("elite_strive_events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  return (data as StriveEvent | null) ?? null;
}

// The captain enters the club with a roster picked from its members, or
// changes the roster before it is paid. Every player on it then says
// "I'm in" on a card of their own before the entry goes to the coaches
// for payment. A player kept on the roster keeps their "I'm in".
export async function enterEvent(eventId: string, clubId: string, picked: string[]): Promise<Ok | Fail> {
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true };
  const event = await eventById(p.admin, eventId);
  if (!event || !takingEntries(event, Date.now())) return fail("That event is not taking entries.");
  const club = id(clubId) ? (await teamRowsOf(p.admin, [clubId]))[0] : null;
  if (!club) return fail(NOT_A_CLUB);
  if (club.captain_id !== p.profileId || club.archived_at) return fail(NOT_CAPTAIN);

  const { data: memberRows } = await p.admin.from("elite_tracker_club_members").select("profile_id").eq("club_id", clubId);
  const memberIds = ((memberRows as { profile_id: string }[] | null) ?? []).map((r) => r.profile_id);
  const { data: births } = await p.admin.from("elite_trackers").select("profile_id, birth_month, birth_year").in("profile_id", memberIds);
  const members = ((births as { profile_id: string; birth_month: number | null; birth_year: number | null }[] | null) ?? []).map((b) => ({
    id: b.profile_id,
    birth: b.birth_month && b.birth_year ? { month: b.birth_month, year: b.birth_year } : null,
  }));

  const { data: existing } = await p.admin
    .from("elite_event_entries")
    .select("id, paid_at")
    .eq("event_id", eventId)
    .eq("club_id", clubId)
    .maybeSingle();
  const entry = existing as { id: string; paid_at: string | null } | null;
  if (entry?.paid_at) return fail("Your spot is paid. Ask the coaches to change the roster.");

  const { data: others } = await p.admin.from("elite_event_roster").select("profile_id, entry_id").eq("event_id", eventId);
  const onOther = new Set(
    ((others as { profile_id: string; entry_id: string }[] | null) ?? []).filter((r) => r.entry_id !== entry?.id).map((r) => r.profile_id)
  );
  const list = Array.isArray(picked) ? picked.filter((x): x is string => typeof x === "string") : [];
  const problem = rosterProblem({ picked: list, members, event, onOtherRosters: onOther });
  if (problem) {
    const names = new Map<string, string>();
    const { data: ps } = await p.admin.from("elite_profiles").select("id, full_name").in("id", memberIds);
    for (const r of (ps as { id: string; full_name: string | null }[] | null) ?? []) names.set(r.id, shortName(r.full_name ?? ""));
    return fail(rosterProblemText(problem, (x) => names.get(x) ?? "A player"));
  }
  const roster = [...new Set(list)];

  let entryId = entry?.id ?? null;
  if (!entryId) {
    const { data, error } = await p.admin
      .from("elite_event_entries")
      .insert({ event_id: eventId, club_id: clubId, entered_by: p.profileId })
      .select("id")
      .single();
    if (error || !data) return fail((error as { code?: string } | null)?.code === "23505" ? "Your club is already entered." : OFFLINE);
    entryId = data.id as string;
  }
  // take off whoever is no longer picked, add whoever is new
  const { data: now } = await p.admin.from("elite_event_roster").select("profile_id").eq("entry_id", entryId);
  const current = new Set(((now as { profile_id: string }[] | null) ?? []).map((r) => r.profile_id));
  const drop = [...current].filter((x) => !roster.includes(x));
  if (drop.length) await p.admin.from("elite_event_roster").delete().eq("entry_id", entryId).in("profile_id", drop);
  const add = roster.filter((x) => !current.has(x));
  if (add.length) {
    const { error } = await p.admin
      .from("elite_event_roster")
      .insert(add.map((profile_id) => ({ entry_id: entryId, event_id: eventId, profile_id })));
    if (error) {
      const m = error.message ?? "";
      if (m.includes("roster_full")) return fail(`A roster holds ${event.roster_max} players at most.`);
      if ((error as { code?: string }).code === "23505") return fail("One of those players is already on another club's roster for this event.");
      return fail(OFFLINE);
    }
  }
  await settleEntry(p.admin, entryId);
  touch(`/log/events`, `/log/events/${eventId}`, `/log/club/${clubId}`);
  return { ok: true };
}

// Once every player on the roster is in, the entry goes to the coaches for
// payment (sent_at). A roster change before payment can take it back.
async function settleEntry(admin: Admin, entryId: string): Promise<void> {
  const { data: e } = await admin.from("elite_event_entries").select("sent_at, paid_at").eq("id", entryId).maybeSingle();
  const entry = e as { sent_at: string | null; paid_at: string | null } | null;
  if (!entry || entry.paid_at) return;
  const { data } = await admin.from("elite_event_roster").select("in_at").eq("entry_id", entryId);
  const roster = (data as { in_at: string | null }[] | null) ?? [];
  const ready = entryState({ roster, sent_at: null, paid_at: null }) === "sent";
  if (ready && !entry.sent_at) await admin.from("elite_event_entries").update({ sent_at: new Date().toISOString() }).eq("id", entryId);
  if (!ready && entry.sent_at) await admin.from("elite_event_entries").update({ sent_at: null }).eq("id", entryId);
}

// The captain takes the club out of an event before it is paid.
export async function withdrawEntry(eventId: string, clubId: string): Promise<Ok | Fail> {
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true };
  const club = id(clubId) ? (await teamRowsOf(p.admin, [clubId]))[0] : null;
  if (!club || club.captain_id !== p.profileId) return fail(NOT_CAPTAIN);
  const { data } = await p.admin
    .from("elite_event_entries")
    .select("id, paid_at")
    .eq("event_id", eventId)
    .eq("club_id", clubId)
    .maybeSingle();
  const entry = data as { id: string; paid_at: string | null } | null;
  if (!entry) return fail(GONE);
  if (entry.paid_at) return fail("Your spot is paid. Ask the coaches to take the club out.");
  const { error } = await p.admin.from("elite_event_entries").delete().eq("id", entry.id);
  if (error) return fail(OFFLINE);
  touch(`/log/events`, `/log/events/${eventId}`, `/log/club/${clubId}`);
  return { ok: true };
}

// A player on a roster answers their card. "I'm in" accepts the event's
// waiver, and the acceptance is recorded (who, when, which event and club,
// the exact waiver link). "Not this time" takes them off the roster.
export async function answerRoster(entryId: string, isIn: boolean): Promise<Ok | Fail> {
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true };
  if (!id(entryId)) return fail(GONE);
  const { data: rowData } = await p.admin
    .from("elite_event_roster")
    .select("entry_id, event_id, in_at")
    .eq("entry_id", entryId)
    .eq("profile_id", p.profileId)
    .maybeSingle();
  const row = rowData as { entry_id: string; event_id: string; in_at: string | null } | null;
  if (!row) return fail(GONE);
  const event = await eventById(p.admin, row.event_id);
  if (!event || !event.waiver_url || !takingEntries(event, Date.now())) return fail("That event is not taking entries.");
  const { data: entryData } = await p.admin.from("elite_event_entries").select("club_id, paid_at").eq("id", entryId).maybeSingle();
  const entry = entryData as { club_id: string; paid_at: string | null } | null;
  if (!entry) return fail(GONE);

  if (isIn !== true) {
    if (entry.paid_at) return fail("The spot is paid. Ask your captain or the coaches to take you off.");
    await p.admin.from("elite_event_roster").delete().eq("entry_id", entryId).eq("profile_id", p.profileId);
    await settleEntry(p.admin, entryId);
    touch(`/log/events/${row.event_id}`);
    return { ok: true };
  }
  if (row.in_at) return { ok: true };
  const tracker = await getTracker(p.profileId);
  const birth = tracker?.birth_month && tracker.birth_year ? { month: tracker.birth_month, year: tracker.birth_year } : null;
  const { error: waiverError } = await p.admin.from("elite_event_waivers").insert({
    event_id: row.event_id,
    entry_id: entryId,
    club_id: entry.club_id,
    profile_id: p.profileId,
    waiver_url: event.waiver_url,
    under_18: under18On(birth, eventDay(event.starts_at)),
  });
  if (waiverError) return fail(OFFLINE);
  const { error } = await p.admin
    .from("elite_event_roster")
    .update({ in_at: new Date().toISOString() })
    .eq("entry_id", entryId)
    .eq("profile_id", p.profileId);
  if (error) return fail(OFFLINE);
  await settleEntry(p.admin, entryId);
  touch(`/log/events/${row.event_id}`, `/log/club/${entry.club_id}`);
  return { ok: true };
}

// ---- Trained together -------------------------------------------------------------------

// The composer's teammate chips: clubmates only, never across a block.
export async function teammatesToTag(): Promise<{ ok: true; teammates: Teammate[] } | Fail> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "player") return fail("Sign in first.");
  return { ok: true, teammates: await teammatesFor(viewer) };
}

// A tagged teammate answers the card. Add puts the same time, kind and day
// in their own week through the usual logging path (the day's 8 hours and
// the gym rule hold); Decline does nothing else. Claimed first, so two taps
// can never add the time twice.
export async function answerTogether(logId: string, add: boolean): Promise<Ok | Fail> {
  const p = await player();
  if (p.kind === "no") return fail(p.error);
  if (p.kind === "demo") return { ok: true };
  if (!id(logId)) return fail(GONE);
  const { data: tagData } = await p.admin
    .from("elite_trained_together")
    .select("tagged, tagger, answer")
    .eq("log_id", logId)
    .eq("tagged", p.profileId)
    .maybeSingle();
  const tag = tagData as { tagged: string; tagger: string; answer: string | null } | null;
  if (!tag) return fail(GONE);
  const { data: logData } = await p.admin
    .from("elite_training_logs")
    .select("minutes, kind, trained_on, removed_at")
    .eq("id", logId)
    .maybeSingle();
  const log = logData as { minutes: number; kind: Kind; trained_on: string; removed_at: string | null } | null;
  if (!log || log.removed_at) return fail(GONE);
  if (!mayAddTogether({ tag, viewerId: p.profileId, day: log.trained_on, today: nyToday() })) return fail(GONE);

  if (add !== true) {
    await p.admin
      .from("elite_trained_together")
      .update({ answer: "declined", answered_at: new Date().toISOString() })
      .eq("log_id", logId)
      .eq("tagged", p.profileId)
      .is("answer", null);
    touch();
    return { ok: true };
  }
  const tracker = await getTracker(p.profileId);
  if (!tracker) return fail("Sign in first.");
  if (!mayLog(log.kind, tracker.grade)) return fail(GYM_REFUSED_MESSAGE);
  const { data: claimed } = await p.admin
    .from("elite_trained_together")
    .update({ answer: "added", answered_at: new Date().toISOString() })
    .eq("log_id", logId)
    .eq("tagged", p.profileId)
    .is("answer", null)
    .select("log_id");
  if (!claimed || (claimed as unknown[]).length === 0) return { ok: true };
  const saved = await insertLog(p.admin, {
    profileId: p.profileId,
    day: log.trained_on,
    minutes: log.minutes,
    kind: log.kind,
    weekTarget: tracker.target_minutes,
  });
  if (!saved.ok) {
    await p.admin.from("elite_trained_together").update({ answer: null, answered_at: null }).eq("log_id", logId).eq("tagged", p.profileId);
    return fail(saved.dayCap ? DAY_CAP_MESSAGE : OFFLINE);
  }
  await p.admin.from("elite_trained_together").update({ added_log_id: saved.id }).eq("log_id", logId).eq("tagged", p.profileId);
  touch();
  return { ok: true };
}

// ---- Coach side (/coach/free) -------------------------------------------------------------

// Make or change a Strive event. It is saved closed; opening is its own
// step and needs the waiver link.
export async function saveEvent(eventId: string | null, input: EventInput): Promise<Ok | Fail> {
  const checked = cleanEvent(input);
  if (!checked.ok) return fail(checked.error);
  const c = await coach();
  if (c.kind === "no") return fail(ONLY_COACH);
  if (c.kind === "demo") return { ok: true };
  if (eventId) {
    if (!id(eventId)) return fail(GONE);
    const before = await eventById(c.admin, eventId);
    if (!before) return fail(GONE);
    // an open event that loses its waiver link closes
    const open = before.open && Boolean(checked.fields.waiver_url);
    const { error } = await c.admin.from("elite_strive_events").update({ ...checked.fields, open }).eq("id", eventId);
    if (error) return fail(OFFLINE);
  } else {
    const { error } = await c.admin.from("elite_strive_events").insert({ ...checked.fields, open: false, created_by: c.profileId });
    if (error) return fail(OFFLINE);
  }
  revalidatePath("/coach/free");
  touch("/log/events");
  return { ok: true };
}

export async function setEventOpen(eventId: string, open: boolean): Promise<Ok | Fail> {
  const c = await coach();
  if (c.kind === "no") return fail(ONLY_COACH);
  if (c.kind === "demo") return { ok: true };
  const event = await eventById(c.admin, eventId);
  if (!event) return fail(GONE);
  if (open === true) {
    const problem = openProblem(event, Date.now());
    if (problem) return fail(problem);
  }
  const { error } = await c.admin.from("elite_strive_events").update({ open: open === true }).eq("id", eventId);
  if (error) return fail(OFFLINE);
  revalidatePath("/coach/free");
  touch("/log/events");
  return { ok: true };
}

// The coaches mark an entry paid (registration = payment: only then is the
// spot held), or take the mark back.
export async function markEntryPaid(entryId: string, paid: boolean): Promise<Ok | Fail> {
  const c = await coach();
  if (c.kind === "no") return fail(ONLY_COACH);
  if (c.kind === "demo") return { ok: true };
  if (!id(entryId)) return fail(GONE);
  const { error } = await c.admin
    .from("elite_event_entries")
    .update(paid === true ? { paid_at: new Date().toISOString(), paid_by: c.profileId } : { paid_at: null, paid_by: null })
    .eq("id", entryId);
  if (error) return fail(OFFLINE);
  revalidatePath("/coach/free");
  touch("/log/events");
  return { ok: true };
}

async function closePlanReports(c: { admin: Admin; profileId: string }, planId: string, action: "cancelled" | "none") {
  return c.admin
    .from("elite_plan_reports")
    .update({ resolved_at: new Date().toISOString(), resolved_by: c.profileId, action })
    .eq("plan_id", planId)
    .is("resolved_at", null);
}

// A coach cancels any session or game (a reported one, or any), and its
// reports close.
export async function cancelPlanAsCoach(planId: string): Promise<Ok | Fail> {
  const c = await coach();
  if (c.kind === "no") return fail(ONLY_COACH);
  if (c.kind === "demo") return { ok: true };
  const plan = await planById(c.admin, planId);
  if (!plan) return fail(GONE);
  if (plan.status !== "cancelled") {
    const { error } = await c.admin
      .from("elite_club_plans")
      .update({ status: "cancelled", cancelled_by: c.profileId, cancelled_at: new Date().toISOString() })
      .eq("id", plan.id);
    if (error) return fail(OFFLINE);
  }
  await closePlanReports(c, plan.id, "cancelled");
  revalidatePath("/coach/free");
  touch(`/log/club/${plan.club_id}`, `/log/plan/${plan.id}`);
  return { ok: true };
}

// "No action": the reports close and the plan stays.
export async function dismissPlanReports(planId: string): Promise<Ok | Fail> {
  const c = await coach();
  if (c.kind === "no") return fail(ONLY_COACH);
  if (c.kind === "demo") return { ok: true };
  if (!id(planId)) return fail(GONE);
  const { error } = await closePlanReports(c, planId, "none");
  if (error) return fail(OFFLINE);
  revalidatePath("/coach/free");
  return { ok: true };
}
