// THE DOOR (Coach Yinka, Nov 26 2026: "yes 1 is great", "clubs at the
// door"): the one screen a NEW free account in the iPhone app meets right
// after its photo, before anything else is asked.
//
//   "Have a code from a teammate or a club?"
//
// Why it exists: a link opens the website, not the app, so a player who
// was invited has nothing to tap inside the app. The invite carries a code
// to type instead (a teammate's own code, or a club's). And the free app
// is empty with no friends, so the player who was invited should reach
// their friends first and be asked about their game later.
//
//   a real code   asks the way the website's link does: a teammate gets a
//                 friend request to accept (072), a club's captain gets a
//                 request to let the player in (073). Then the player goes
//                 STRAIGHT to the free app: no quiz, no offer, no week
//                 set-up. The quiz and the offer wait behind the one
//                 upgrade card on Week (lib/elite/upgrade-card.ts).
//   no code       exactly the path as it always was: the quiz, the offer,
//                 the week's set-up, the free app.
//
// The server decides who skips (migration 090: one mark on the free
// account's own row, written only in the same call that accepted a real
// code; lib/elite/free-door-server.ts). Until 090 is applied a code still
// asks, and nobody skips.
//
// Pure, and shared with the phone ("@shared/free-door").
import { cleanReferralCode } from "./tracker";

export const DOOR_TITLE = "Have a code from a teammate or a club?";
export const DOOR_BODY = "Type the code and you go straight to your friends. It is in the invite your teammate or your captain sent you.";
export const DOOR_FIELD = "Code from a teammate or a club";
export const DOOR_PLACEHOLDER = "Code";
export const DOOR_USE = "Use my code";
export const DOOR_NO_CODE = "I do not have a code";
// after a code that asked: the small line over what it did, and where the
// one button goes
export const DOOR_WORKED = "Your code worked";
export const DOOR_TO_FRIENDS = "Go to my friends";
export const DOOR_KEEP_GOING = "Keep going";

export const DOOR_NOT_A_CODE = "That is not a code. A code is 8 letters and numbers, like the one in your invite.";
export const DOOR_NO_MATCH = "That code did not match a teammate or a club. Check it and try again.";
export const DOOR_OWN_CODE = "That is your own code. Send it to a teammate, and type the one a teammate sent you here.";

// What a typed or pasted code is. A pasted link (or the whole invite, link
// included) says which kind it is: ?ref= is a teammate's, ?club= a club's.
// A bare code says nothing, so the server tries both.
export type DoorCode = { code: string; kind: "friend" | "club" | null };

export function doorCodeFrom(raw: unknown): DoorCode | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > 600) return null;
  const club = cleanReferralCode(/[?&]club=([A-Za-z0-9]+)/.exec(text)?.[1]);
  if (club) return { code: club, kind: "club" };
  const ref = cleanReferralCode(/[?&]ref=([A-Za-z0-9]+)/.exec(text)?.[1]);
  if (ref) return { code: ref, kind: "friend" };
  // a whole invite pasted with no link in it: the code after "code:"
  const said = cleanReferralCode(/\bcode:\s*([A-Za-z0-9]+)/i.exec(text)?.[1]);
  if (said) return { code: said, kind: /\bclub code:/i.test(text) ? "club" : null };
  const bare = cleanReferralCode(text);
  return bare ? { code: bare, kind: null } : null;
}

// What a player sends a teammate: the code to type in the app AND the
// link, so a teammate with the app types the code and one without it
// opens the link. (A club's invite is clubShareText, lib/elite/club-app.ts,
// the same shape.)
export function friendShareText(input: { code: string; link: string }): string {
  return `Train with me on Strive Elite.\nMy code: ${input.code}\n${input.link}`;
}

// What the door answers.
//   skipped   the server let this player past the quiz (090): the free app
//             is next. false: the code asked, and the quiz comes next as it
//             always did.
export type DoorAnswer =
  | { ok: true; kind: "friend" | "club"; line: string; skipped: boolean }
  | { ok: false; error: string };

// The target a player who skipped the quiz trains toward until they set
// their own: the in-season row of the coaches' own table (Coach Yinka,
// Nov 18 2026: "in season 4 extra hours a week"). Never a number made up
// here: the caller reads the table (recommendation(table, DOOR_SEASON)).
export const DOOR_SEASON = "in_season" as const;
