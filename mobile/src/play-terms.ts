import { Alert } from "react-native";
import type { AppClubAnswer } from "@shared/app-contract";
import { ORGANIZER_SHEET_LINE, ORGANIZER_SHEET_TITLE, PLAYER_SHEET_LINE, PLAYER_SHEET_TITLE } from "@shared/club-teams";
import { acceptPlayTerms } from "./api/clubs";

// The two one-time sheets (077), in the website's own words
// (lib/elite/club-teams.ts) and recorded by the website's own action:
//   organizer  before a captain starts a club or plans anything:
//              "You're organizing this, not Strive."
//   player     before a player's first "I'm in":
//              "Organized by players, not by Strive."
// One tap on the phone's own box. The server decides when one is owed (an
// answer with `needs`); nothing here remembers anything.
const WORDS = {
  organizer: { title: ORGANIZER_SHEET_TITLE, line: ORGANIZER_SHEET_LINE, yes: "Got it, I'm organizing" },
  player: { title: PLAYER_SHEET_TITLE, line: PLAYER_SHEET_LINE, yes: "Got it" },
} as const;

// Shows the sheet. True once the tap is recorded.
export function askPlayTerms(kind: "organizer" | "player"): Promise<boolean> {
  const w = WORDS[kind];
  return new Promise((resolve) => {
    Alert.alert(
      w.title,
      w.line,
      [
        { text: "Not now", style: "cancel", onPress: () => resolve(false) },
        {
          text: w.yes,
          onPress: () =>
            void acceptPlayTerms(kind)
              .then((r) => resolve(r.ok))
              .catch(() => resolve(false)),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false), userInterfaceStyle: "dark" }
    );
  });
}

// Run something that may need a sheet first (starting a club, a plan, a
// first "I'm in"): when the server says one is owed it is shown, and after
// the tap the same thing runs again. Not now: nothing happened, nothing is
// said (`declined`).
export async function withPlayTerms(run: () => Promise<AppClubAnswer>): Promise<AppClubAnswer & { declined?: boolean }> {
  const first = await run();
  if (first.ok || !first.needs) return first;
  if (!(await askPlayTerms(first.needs))) return { ok: false, declined: true };
  return run();
}
