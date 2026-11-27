// Clubs as the native iPhone app reads them (app/api/app/free/clubs/*):
// the website's own readers, shaped as lib/elite/app-contract.ts says.
//
// No rule is written a second time here. Who is on a club and whose photo
// a member may see: myClubsFor (tracker-server.ts). A club's sessions,
// games, record and county: clubTeamFor, nearYouFor, teamAsksFor
// (club-teams-server.ts), each of which checks every plan again with
// mayViewPlan. A training photo: the feed's own rule (buildFeed,
// mayViewPhoto), so a teammate's post from today is locked until the
// viewer has posted a photo today, and a locked post is sent with no
// photo of it at all. The weekly matchup: club-matchups-server.ts.
//
// Runs inside an app request (lib/elite/app-api.ts), after its gate has
// established that the caller is a free account in the free app. A club
// is only ever read for one of its own members.
import { APP_URL } from "./app-url";
import { createServiceClient } from "./supabase/server";
import type { Viewer } from "./session";
import { fmtDuration } from "./time-trained";
import {
  clubByCode,
  clubIdsOf,
  clubRequestsFor,
  clubStartedAt,
  entriesOf,
  friendIdsOf,
  membersOf,
  myClubsFor,
  reportedBy,
  signPhotos,
  type Admin,
} from "./tracker-server";
import { clubTeamFor, nearYouFor, opponentsFor, planById, playAcceptancesOf, teamAsksFor, teamRowsOf, type TeamAsks } from "./club-teams-server";
import { setClubCounty } from "./club-teams-actions";
import { confirmClub, startClub } from "./tracker-actions";
import { matchupFor } from "./club-matchups-server";
import { NEEDS_ORGANIZER_OK, PENDING_GAMES_MAX, PLAN_REFUSED, eventDay } from "./club-teams";
import { CLUB_CODE_MESSAGE, clubBoard, clubShareText, clubWeek, clubWeeks, clubWeeksSince, cardRace, nextLine, splitPlans, trainedToday } from "./club-app";
import {
  GRID_MAX,
  buildFeed,
  clubLink,
  clubRequestSentLine,
  mayStartClub,
  postedPhotoToday,
  weekOf,
  type MyClub,
  type OpenCard,
  type PhotoViewer,
} from "./tracker";
import type { AppClubNear, AppClubPage, AppClubTile, AppClubs } from "./app-contract";
import { clubGamesInApp, clubPageForApp, planInApp, waitingForApp } from "./club-games";

// What waits on a captain for one club: players asking to join, a game
// another club sent, and a score to enter or confirm.
// While games are out of the app (lib/elite/club-games.ts) only the players
// asking to join are counted: a captain is never told something waits that
// the app has no screen for.
function waitingFor(clubId: string, input: { requests: { clubId: string }[]; asks: TeamAsks | null; toEnter: number }): number {
  return waitingForApp({
    requests: input.requests.filter((r) => r.clubId === clubId).length,
    gameAsks: input.asks?.games.filter((g) => g.toId === clubId).length ?? 0,
    scores: (input.asks?.scores.filter((s) => s.toId === clubId).length ?? 0) + input.toEnter,
  });
}

const weekMinutesOf = (club: MyClub) => club.members.reduce((s, m) => s + (m.minutes ?? 0), 0);

// The Clubs tab: the player's own clubs (three at most), each with its
// week, who trained today, what is next and this week's matchup.
export async function appClubsFor(viewer: Viewer, today: string): Promise<AppClubs> {
  const admin = createServiceClient();
  const clubs = await myClubsFor(viewer, today);
  const captains = clubs.some((c) => c.captain);
  const [requests, asks] = await Promise.all([
    captains ? clubRequestsFor(viewer) : Promise.resolve([]),
    captains ? teamAsksFor(viewer, today) : Promise.resolve(null),
  ]);
  const cards = await Promise.all(
    clubs.map(async (c) => {
      const [team, matchup, photos] = await Promise.all([
        clubTeamFor(viewer, c.id, c.captain),
        admin && !c.ended ? matchupFor(admin, { id: c.id, name: c.name, members: c.members.length }, today) : Promise.resolve(null),
        admin ? clubPhotosFor(admin, viewer, c, today) : Promise.resolve([]),
      ]);
      const newest = photos.find((t) => t.state === "open");
      const plans = splitPlans(team.plans);
      const next = plans.next.find((p) => p.status === "on" && planInApp(p.kind)) ?? null;
      return {
        id: c.id,
        name: c.name,
        captain: c.captain,
        ended: c.ended,
        members: c.members.length,
        weekTime: fmtDuration(weekMinutesOf(c)),
        photo: newest?.state === "open" ? newest.photoUrl : null,
        today: trainedToday(c.members, today),
        next: next ? nextLine(next, c.id) : null,
        matchup: matchup?.cardLine ?? null,
        ...(cardRace(matchup) ? { race: cardRace(matchup)! } : {}),
        ...(matchup?.champs ? { champs: true } : {}),
        waiting: c.captain
          ? waitingFor(c.id, { requests, asks, toEnter: plans.results.filter((p) => p.result?.canEnter).length })
          : 0,
      };
    })
  );
  return { clubs: cards, canStart: mayStartClub(clubs.length) };
}

// This week's training photos from the club's members, by the feed's own
// rule. Only members the viewer is friends with right now are in it (a
// block, or a friend taken off, keeps the club and not the photos).
async function clubPhotosFor(admin: Admin, viewer: Viewer, club: MyClub, today: string): Promise<AppClubTile[]> {
  const me = viewer.profile.id;
  const memberIds = club.members.map((m) => m.id);
  const { monday } = weekOf(today);
  const [friendIds, rows, reported] = await Promise.all([
    friendIdsOf(admin, me),
    entriesOf(admin, [...new Set([me, ...memberIds])], monday, today),
    reportedBy(admin, me),
  ]);
  const onClub = new Set(memberIds);
  const photoViewer: PhotoViewer = {
    id: me,
    staff: false,
    friendIds: new Set(friendIds.filter((id) => onClub.has(id))),
    // any photo the viewer posted today opens today's, as on Friends
    unlocked: postedPhotoToday(rows, me, today),
    reported,
  };
  const names = new Map(club.members.map((m) => [m.id, m.name]));
  const avatar = new Map(club.members.map((m) => [m.id, m.photo ?? null]));
  const cards = buildFeed({ rows: rows.filter((r) => r.kind === "training"), viewer: photoViewer, names, today }).slice(0, GRID_MAX);
  const urls = await signPhotos(
    admin,
    cards.filter((c): c is OpenCard => c.state === "open").map((c) => c.photoPath)
  );
  return cards.flatMap((c): AppClubTile[] => {
    const time = fmtDuration(c.minutes);
    if (c.state === "locked") {
      return [{ state: "locked", id: c.id, first: c.first, initials: c.initials, photo: avatar.get(c.ownerId) ?? null, time }];
    }
    const photoUrl = urls.get(c.photoPath);
    return photoUrl ? [{ state: "open", id: c.id, first: c.first, mine: c.mine, time, photoUrl }] : [];
  });
}

// One club's page, for one of its members. Anyone else gets nothing back.
export async function appClubPageFor(viewer: Viewer, clubId: string, today: string): Promise<AppClubPage | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  const club = (await myClubsFor(viewer, today)).find((c) => c.id === clubId);
  if (!club) return null;
  const visible = new Set(club.members.map((m) => m.id));
  const [team, joined, startedAt, requests, asks, matchup, photos] = await Promise.all([
    clubTeamFor(viewer, clubId, club.captain),
    membersOf(admin, clubId),
    clubStartedAt(admin, clubId),
    club.captain ? clubRequestsFor(viewer) : Promise.resolve([]),
    club.captain ? teamAsksFor(viewer, today) : Promise.resolve(null),
    club.ended ? Promise.resolve(null) : matchupFor(admin, { id: club.id, name: club.name, members: club.members.length }, today),
    clubPhotosFor(admin, viewer, club, today),
  ]);
  // the club's weeks, from its start: this week next to its best
  const since = clubWeeksSince(startedAt ? eventDay(startedAt) : today);
  const logs = await entriesOf(admin, [...visible], since, today);
  const weeks = clubWeeks({
    logs,
    members: joined.filter((m) => visible.has(m.profile_id)).map((m) => ({ id: m.profile_id, joinedOn: eventDay(m.joined_at) })),
    today,
  });
  const plans = splitPlans(team.plans);
  // clubPageForApp: nothing of games reaches the app while they are out
  // of it (lib/elite/club-games.ts)
  return clubPageForApp<AppClubPage>({
    id: club.id,
    name: club.name,
    today,
    captain: club.captain,
    ended: club.ended,
    byCoach: club.kind === "coach",
    county: team.county,
    countyName: team.countyName,
    open: team.open,
    record: team.record,
    recordLine: team.recordLine,
    membersCount: club.members.length,
    week: clubWeek(weeks),
    matchup,
    members: clubBoard(club.members, today),
    next: plans.next,
    results: plans.results,
    accepted: team.accepted,
    photos,
    share: club.ended
      ? null
      : { code: club.code, link: clubLink(APP_URL, club.code), text: clubShareText({ name: club.name, code: club.code, appUrl: APP_URL }) },
    manage: club.captain
      ? {
          requests: requests.filter((r) => r.clubId === clubId).map((r) => ({ id: r.id, name: r.name, initials: r.initials })),
          games: (asks?.games ?? [])
            .filter((g) => g.toId === clubId)
            .map((g) => ({ id: g.id, from: g.from, fromId: g.fromId, when: g.when, minutes: g.minutes, place: g.place })),
        }
      : null,
  });
}

// Clubs near you, for the club's captain only: the clubs in its county
// that chose to be open to games, and any club it already played.
export async function appClubNearFor(viewer: Viewer, clubId: string): Promise<AppClubNear | null> {
  // clubs near you exist to send a game: nothing while games are out of the app
  if (!clubGamesInApp()) return null;
  const near = await nearYouFor(viewer, clubId);
  if (!near) return null;
  const listed = new Set(near.rows.map((r) => r.id));
  const again = (await opponentsFor(viewer, clubId)).filter((o) => o.played && !listed.has(o.id));
  const full = near.pending >= PENDING_GAMES_MAX;
  return {
    club: near.club,
    fullLine: full ? PLAN_REFUSED.too_many : null,
    rows: [
      ...near.rows.map((r) => ({
        id: r.id,
        name: r.name,
        record: r.record,
        members: r.members,
        refusal: r.refusal ? PLAN_REFUSED[r.refusal] : null,
        played: false,
      })),
      // a club already played can be sent another game whatever its switch
      // says now; its record and size are not read for it
      ...again.map((o) => ({ id: o.id, name: o.name, record: "", members: 0, refusal: null, played: true })),
    ],
  };
}

// ---- Games out of the app (lib/elite/club-games.ts) ---------------------------

// What kind of plan this is ("training" or "game"), or null when it is not
// there: the app's plan route asks before it acts, so a game made on the
// website can never be joined, answered or scored from the app while games
// are out of it.
export async function planKindFor(planId: string): Promise<string | null> {
  const admin = createServiceClient();
  if (!admin) return null;
  return (await planById(admin, planId).catch(() => null))?.kind ?? null;
}

// The captain sets the club's county from the app. "Open to games" is the
// app's to change only while games are in it; otherwise the county is
// saved and the switch stays as the website left it (off with no county,
// as the database requires).
export async function setClubCountyFromApp(clubId: string, county: string | null, open: boolean) {
  if (clubGamesInApp()) return setClubCounty(clubId, county, open);
  const admin = createServiceClient();
  const stored = admin ? (await teamRowsOf(admin, [clubId]).catch(() => []))[0]?.open_to_games === true : false;
  return setClubCounty(clubId, county, county !== null && stored);
}

// ---- Two writes the app makes in one step -------------------------------------

const OFFLINE = "We could not reach the server. Try again in a minute.";
type Step = { ok: true; id?: string; code?: string; line?: string } | { ok: false; error: string; needs?: "organizer" };

// Start a club from the app: the captain's one-time organizer acceptance
// first (recorded exactly as before a first plan, acceptPlayTerms), then
// the name (the website's own rule and word filter) and its county when
// one was picked. The website's own actions do each part.
export async function startClubInApp(viewer: Viewer, name: string, county: string | null): Promise<Step> {
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: OFFLINE };
  if (!(await playAcceptancesOf(admin, viewer.profile.id)).organizer) {
    return { ok: false, error: NEEDS_ORGANIZER_OK, needs: "organizer" };
  }
  const started = await startClub(name);
  if (!started.ok) return started;
  // the club is started either way; its county can be set again from Manage
  if (county) await setClubCounty(started.id, county, false).catch(() => undefined);
  return { ok: true, id: started.id, code: started.code };
}

// "Have a club code?": ask to join the club behind a code. The captain
// lets the player in (073); nothing here puts anyone on a club.
export async function askToJoinByCode(viewer: Viewer, code: string): Promise<Step> {
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: OFFLINE };
  const club = await clubByCode(admin, code);
  if (!club) return { ok: false, error: CLUB_CODE_MESSAGE };
  if ((await clubIdsOf(admin, viewer.profile.id)).includes(club.id)) {
    return { ok: true, id: club.id, line: `You are already in ${club.name}.` };
  }
  const asked = await confirmClub(code);
  if (!asked.ok) return asked;
  return { ok: true, line: clubRequestSentLine(club.name, club.kind === "coach") };
}
