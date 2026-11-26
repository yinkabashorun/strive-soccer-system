// The weekly club matchup: every word a player reads about it, in one
// place, for the iPhone app and the website alike.
//
// The owner's condition (Nov 24 2026): "as long as the user understands
// and details are written in copy an elementary schooler can understand."
// So every sentence here is short, uses common words and carries one idea.
// tests/club-matchups.test.ts reads all of them: 16 words or fewer a
// sentence, none of the words a 9 year old would not know, no long dashes,
// and nothing that names or counts who did not train.
//
// Pure: no imports.

export const MATCHUP_TITLE = "This week's matchup";
// A week that is decided, shown until the next one is matched on Monday.
export const MATCHUP_TITLE_OVER = "Last week's matchup";
export function matchupTitle(state: "on" | "over" | "none"): string {
  return state === "over" ? MATCHUP_TITLE_OVER : MATCHUP_TITLE;
}
export const MATCHUP_LAST_WEEK = "Last week";
export const MATCHUP_PER_PLAYER = "time per player";
export const MATCHUP_HOW_LINK = "How it works";

export const MATCHUP_HOW_TITLE = "How it works";
// The owner's own six lines.
export const MATCHUP_HOW_LINES: readonly string[] = [
  "Every Monday your club gets matched with another club.",
  "All week, both clubs train.",
  "We add up your club's training time. Then we split it by how many players are in your club. That is your club's time per player.",
  "On Sunday night the club with more time per player wins the week.",
  "Gym time does not count.",
  "Players who join your club this week start counting next Monday.",
];

const minutesWord = (n: number) => `${n} ${n === 1 ? "minute" : "minutes"}`;

// While the week is on: who is ahead, by how many minutes per player.
export function matchupAheadLine(input: { mine: number; theirs: number; other: string }): string {
  const gap = Math.abs(input.mine - input.theirs);
  if (gap === 0) return "It is tied.";
  return input.mine > input.theirs
    ? `Your club is ahead by ${minutesWord(gap)} per player.`
    : `${input.other} is ahead by ${minutesWord(gap)} per player.`;
}

// Once the week is over.
export type MatchupResult = "win" | "loss" | "draw";
export function matchupResultLine(result: MatchupResult, other: string): string {
  if (result === "win") return "Your club won the week.";
  if (result === "loss") return `${other} won the week.`;
  return "The week was a draw.";
}

// CHAMPS OF THE WEEK (Coach Yinka, Nov 26 2026: "your club won the week
// need to be hype like. (CLUB NAME IS STRIVE CHAMPS OF THE WEEK)"). A club
// that won its matchup carries this mark, in gold, for the week after it,
// and its players are told once (lib/elite/notices.ts clubChampsNotice).
export const CHAMPS_MARK = "Strive champs of the week";
// By how much, in the words of the matchup card.
export function champsBeatLine(input: { who: string; other: string; gap: number }): string {
  return `${input.who} beat ${input.other} by ${minutesWord(input.gap)} per player.`;
}

// A week with nobody to play, a club still too small, and a club that
// reached its size after Monday.
export const MATCHUP_NONE_LINE = "No matchup this week. There was no other club to play.";
export function matchupSmallLine(minPlayers: number): string {
  return `Matchups start when your club has ${minPlayers} players.`;
}
export const MATCHUP_SOON_LINE = "Your club's first matchup starts Monday.";

// The club's matchup record, its own line under the games record.
export function matchupRecordLine(r: { wins: number; losses: number; draws: number }): string {
  return `Weeks won: ${r.wins}. Weeks lost: ${r.losses}. Draws: ${r.draws}.`;
}

// The one line on a club's card on the Clubs tab.
export function matchupCardLine(mine: string, other: string): string {
  return `This week: ${mine} vs ${other}.`;
}

// Every fixed sentence, and every built one with example names, for the
// test that holds the words.
export function everyMatchupSentence(): string[] {
  const other = "Sunday Pickup";
  return [
    MATCHUP_TITLE,
    MATCHUP_TITLE_OVER,
    MATCHUP_LAST_WEEK,
    MATCHUP_PER_PLAYER,
    MATCHUP_HOW_LINK,
    MATCHUP_HOW_TITLE,
    ...MATCHUP_HOW_LINES,
    matchupAheadLine({ mine: 72, theirs: 60, other }),
    matchupAheadLine({ mine: 60, theirs: 61, other }),
    matchupAheadLine({ mine: 60, theirs: 60, other }),
    matchupResultLine("win", other),
    matchupResultLine("loss", other),
    matchupResultLine("draw", other),
    MATCHUP_NONE_LINE,
    matchupSmallLine(3),
    MATCHUP_SOON_LINE,
    matchupRecordLine({ wins: 3, losses: 1, draws: 0 }),
    matchupCardLine("Renegados FC", other),
    CHAMPS_MARK,
    champsBeatLine({ who: "You", other, gap: 12 }),
  ];
}
