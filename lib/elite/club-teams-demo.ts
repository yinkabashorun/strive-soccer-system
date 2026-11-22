// Clubs as teams (077): the example account's data, shown only when there
// is no database at all (a local build), the same as tracker-demo.ts. The
// club names, places, records, scores and the event are examples, never
// served to a real account.
import { recordLabel, type ClubRecord, type EntryState, type PlanRow, type StriveEvent, type TeamClub } from "./club-teams";

// The example player captains demo-club-2 (Bull Run 2010s) and is on the
// coach-made demo-club-1.
export const DEMO_TEAM_CLUBS: TeamClub[] = [
  { id: "demo-club-2", name: "Bull Run 2010s", county: "va-prince-william", open: true, archived: false, members: 3 },
  { id: "demo-club-1", name: "Strive Elite 5v5: Team 7", county: null, open: false, archived: false, members: 5 },
  { id: "demo-near-1", name: "Haymarket 08s", county: "va-prince-william", open: true, archived: false, members: 10 },
  { id: "demo-near-2", name: "Bristow Boys", county: "va-prince-william", open: true, archived: false, members: 8 },
  { id: "demo-near-3", name: "Catharpin Crew", county: "va-prince-william", open: true, archived: false, members: 7 },
  { id: "demo-near-4", name: "Sunday Pickup", county: "va-prince-william", open: true, archived: false, members: 12 },
];

export const DEMO_RECORDS = new Map<string, ClubRecord>([
  ["demo-club-2", { wins: 4, losses: 1, draws: 0, played: 5 }],
  ["demo-near-1", { wins: 5, losses: 1, draws: 0, played: 6 }],
  ["demo-near-2", { wins: 3, losses: 2, draws: 0, played: 5 }],
  ["demo-near-3", { wins: 1, losses: 1, draws: 0, played: 2 }],
]);

export const demoRecordLabel = (id: string) =>
  recordLabel(DEMO_RECORDS.get(id) ?? { wins: 0, losses: 0, draws: 0, played: 0 });

// A day this many days from now at a New York hour, as an instant.
function at(days: number, hour: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  const day = d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return new Date(`${day}T${String(hour).padStart(2, "0")}:00:00-05:00`).toISOString();
}

const blank = { score_by_club: null, score_club: null, score_opponent: null, score_entered_at: null, score_answer: null };

// The example club's plans: a training session, an accepted game, a game
// request waiting on the other captain, and last week's game, confirmed.
export function demoPlans(): (PlanRow & { ins: number; names: string[] })[] {
  return [
    { id: "demo-plan-1", kind: "training", club_id: "demo-club-2", opponent_id: null, title: "Weak foot and finishing", starts_at: at(2, 18), minutes: 60, place: "Catharpin Park, Gainesville", status: "on", ...blank, ins: 3, names: ["You", "Dani R.", "Jalen T."] },
    { id: "demo-plan-2", kind: "game", club_id: "demo-club-2", opponent_id: "demo-near-2", title: null, starts_at: at(5, 11), minutes: 90, place: "Braemar Park, Bristow", status: "on", ...blank, ins: 8, names: ["You", "Dani R."] },
    { id: "demo-plan-3", kind: "game", club_id: "demo-club-2", opponent_id: "demo-near-3", title: null, starts_at: at(9, 10), minutes: 60, place: "Catharpin Park, Gainesville", status: "pending", ...blank, ins: 0, names: [] },
    {
      id: "demo-plan-4",
      kind: "game",
      club_id: "demo-club-2",
      opponent_id: "demo-near-1",
      title: null,
      starts_at: at(-3, 11),
      minutes: 90,
      place: "Braemar Park, Bristow",
      status: "on",
      score_by_club: "demo-club-2",
      score_club: 4,
      score_opponent: 2,
      score_entered_at: at(-3, 13),
      score_answer: "confirmed",
      ins: 9,
      names: ["You", "Dani R.", "Jalen T."],
    },
  ];
}

export const DEMO_EVENT: StriveEvent = {
  id: "demo-event-1",
  name: "Strive Winter 5v5",
  starts_at: "2027-01-23T23:00:00.000Z",
  venue: "Example venue",
  price_text: "$450 a team",
  roster_max: 9,
  max_age: 21,
  payment_url: "https://example.com/pay",
  waiver_url: "https://example.com/waiver",
  open: true,
};

// The example club's entry in the example event.
export const DEMO_ENTRY: { clubId: string; state: EntryState; waiting: number } = {
  clubId: "demo-club-2",
  state: "sent",
  waiting: 0,
};

// The example teammates' birth month and year (for the age limit on the
// roster screen): the example player was born March 2010.
export const DEMO_BIRTHS: Record<string, { month: number; year: number } | null> = {
  "Dani R.": { month: 7, year: 2010 },
  "Jalen T.": { month: 1, year: 2003 },
};
