// GAMES BETWEEN CLUBS ARE NOT IN THE IPHONE APP (Coach Yinka, Nov 26 2026:
// "2 YES", to leaving club-vs-club games in person out of the first App
// Store build).
//
// Why: a game between two clubs is the app arranging an in-person meetup
// of 13 to 17 year olds from different clubs. It is the part App Review
// and a lawyer will question most, and the weekly club matchup already
// gives clubs something to win without anyone meeting.
//
// ONE SWITCH, this constant, read by the server's app routes
// (app/api/app/free/clubs, plans) and by the phone's club screens
// ("@shared/club-games"). While it is off:
//   - the app is sent nothing of games: no game in "Next up", no results,
//     no game request waiting on a captain, no games record, and "Open to
//     games" reads off. clubPageForApp / clubCardNextForApp below.
//   - the app's routes refuse everything a game needs (clubs near you,
//     sending a game, accepting or passing one, a score), and "I'm in",
//     calling off and reporting work on a club's TRAINING session only.
//   - the phone draws none of it: no "Plan a game", no clubs near you, no
//     "Open to games" switch, no games record.
// What stays: a club's own training sessions (members only, "I'm in"),
// and the weekly club matchup with its own record.
//
// THE WEBSITE IS UNCHANGED: games are planned and scored there as before,
// and nothing stored is touched. Turning this on brings games back to the
// app in a build that carries it (tests/club-games.test.ts holds both
// directions, so it is a switch and never a deletion).
//
// Pure: types only from the contract.
import type { PlanCard } from "./club-teams";

export const CLUB_GAMES_IN_APP: boolean = false;

// The switch as the server's app routes read it (a function, so a test can
// stand in for it and hold BOTH directions: tests/app-api.test.ts).
export function clubGamesInApp(): boolean {
  return CLUB_GAMES_IN_APP;
}

// What a hand-made request for something of a game is told.
export const CLUB_GAMES_OFF_MESSAGE = "Games between clubs are not in the app.";

// A plan the app may show or act on.
export function planInApp(kind: string | null | undefined, games: boolean = CLUB_GAMES_IN_APP): boolean {
  return games || kind === "training";
}

// The parts of a club's page that carry games. Generic, so the contract's
// own type (lib/elite/app-contract.ts AppClubPage) passes through whole.
type PageGames = {
  open: boolean;
  record: string;
  recordLine: string;
  next: PlanCard[];
  results: PlanCard[];
  manage: null | { games: unknown[] };
};

export function clubPageForApp<P extends PageGames>(page: P, games: boolean = CLUB_GAMES_IN_APP): P {
  if (games) return page;
  return {
    ...page,
    open: false,
    record: "",
    recordLine: "",
    next: page.next.filter((p) => planInApp(p.kind, false)),
    results: [],
    manage: page.manage ? { ...page.manage, games: [] } : null,
  };
}

// What waits on a captain, as the Clubs tab counts it: players asking to
// join always; a game request and a score only while games are in the app.
export function waitingForApp(
  counts: { requests: number; gameAsks: number; scores: number },
  games: boolean = CLUB_GAMES_IN_APP
): number {
  return counts.requests + (games ? counts.gameAsks + counts.scores : 0);
}

// The app's actions on one plan (app/api/app/free/plans/[id]): which are
// a game's alone, and so refused while games are out of the app.
const GAME_ONLY = new Set(["accept", "pass", "score", "confirm", "dispute"]);
export function planActionInApp(action: unknown, kind: string | null | undefined, games: boolean = CLUB_GAMES_IN_APP): boolean {
  if (games) return true;
  if (typeof action === "string" && GAME_ONLY.has(action)) return false;
  return kind === "training";
}

// "Clubs" under Notifications, for the app: no games to name while they
// are out of it (lib/elite/notices.ts TOPIC_CHOICE has the website's).
export const CLUBS_TOPIC_DETAIL_NO_GAMES = "Your club's sessions, and a week your club wins.";
