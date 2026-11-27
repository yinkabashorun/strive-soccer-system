// ADD A FRIEND IN PERSON (Nov 26 2026). Until now a friend was added by
// sending a link or typing an 8 character code. Two players standing next
// to each other get two more ways, in the iPhone app:
//
//   their @username   typed EXACTLY, on the "Add a friend" screen
//                     (mobile/app/friend/add.tsx). The server looks up that
//                     one username and sends that player a friend request.
//   my code           the player's own invite link as a QR code
//                     (mobile/app/friend/code.tsx). The other player's
//                     iPhone camera reads it and opens the app on the
//                     invite (lib/elite/friend-link.ts).
//
// NOTHING ABOUT WHO CAN BE A FRIEND CHANGES. A request is still a request:
// the other player accepts it or declines it (072). It goes through the
// one function every request goes through (tracker-server.ts
// requestFriend), so a block, a player who was taken off (071) and the 30
// waiting requests all hold. And nobody can look for players:
//   - only the exact username is looked up, never part of one, and the
//     answer is never a list
//   - a username that does not exist, a player who blocked the one asking
//     (or was blocked by them) and a player who took them off all get the
//     SAME line, so nobody learns which it was
//   - a caller gets a few tries a minute and a few more a day
//
// Pure, and shared with the phone ("@shared/friend-add"). The lookups are
// lib/elite/friend-add-server.ts.
import { FRIEND_REQUESTS_FULL_MESSAGE, requestSentLine } from "./tracker";
import { USERNAME_PATTERN, normalizeUsername } from "./username";

// ---- The words ----------------------------------------------------------
// Coach Yinka, Nov 26 2026, on the You page: "the copy on this page is shit
// when you keep saying they ... it should be like share with your QR code".
// So every line names who it means ("your friend") and never says they,
// them or their; tests/add-friend.test.ts holds it.

export const ADD_ROW = "Add a friend";
export const ADD_ROW_DETAIL = "Type a friend's @username, or share your QR code.";
export const ADD_TITLE = "Add a friend";
export const ADD_BODY = "Type your friend's @username exactly. Once your friend accepts, you see each other's training.";
export const ADD_FIELD = "Your friend's @username";
export const ADD_PLACEHOLDER = "@username";
export const ADD_SEND = "Send a friend request";
export const ADD_SENT_EYEBROW = "Asked";
// each had already asked the other, so the two are friends at once
export const ADD_FRIENDS_EYEBROW = "Friends";
export const ADD_ANOTHER = "Add another friend";
export const ADD_DONE = "Done";
export const ADD_MY_CODE = "Show my QR code";
export const ADD_MY_CODE_DETAIL = "Standing next to a friend? Share your QR code.";

export const ADD_EMPTY = "Type your friend's @username first.";
// ONE line for a username nobody has, a block either way and a player who
// took the one asking off: which of the three it was is never said.
export const ADD_NOT_FOUND = "We could not find that @username. Check the spelling.";
export const ADD_SELF = "That is your own @username.";
export const ADD_ALREADY = "You are already friends.";
export const ADD_WAITING = "You already asked. Your friend has not answered yet.";
export const ADD_DAY_FULL = "That is a lot of friend requests for one day. Send more tomorrow.";
export const ADD_OFFLINE = "We could not reach the server. Try again in a minute.";

export const MY_CODE_TITLE = "My QR code";
export const MY_CODE_BODY = "Your friend points an iPhone camera at this code. You accept the request, and you see each other's training.";
export const MY_CODE_SEND = "Send my link";
// the invite row on the You page, beside My QR code
export const SEND_LINK_ROW = "Send my link to a teammate";
export const SEND_LINK_DETAIL = "Your teammate joins, you accept, and you see each other's training.";
// what a screen reader says for the picture (and what the tapped pass looks for)
export const MY_CODE_SAID = "Your QR code. A teammate scans it to send you a friend request.";
export function myCodeLine(code: string): string {
  return `My code: ${code}`;
}

// ---- How often ------------------------------------------------------------

// Tries, not requests sent: a username that matched nobody counts too, so
// nobody can try names one after another.
export const ADD_TRIES_PER_MINUTE = 10;
export const ADD_TRIES_PER_DAY = 30;
export const DAY_MS = 24 * 60 * 60_000;

// ---- The username that was typed -----------------------------------------

// The username to look up, or null when what was typed cannot be one. The
// @ is optional and capitals do not matter (a username is stored in lower
// case). Nothing is trimmed off the middle and nothing is guessed: what is
// looked up is exactly what was typed.
export function usernameToFind(raw: unknown): string | null {
  const name = normalizeUsername(raw);
  return USERNAME_PATTERN.test(name) ? name : null;
}

// ---- What the player is told ------------------------------------------------

// What the one request function answered (tracker-server.ts requestFriend).
export type RequestResult = "sent" | "friends" | "already" | "blocked" | "too_many" | "error";

export type FriendAddFacts =
  // nobody has that username, or the one who has it is not in the free app
  | { found: false }
  | {
      found: true;
      // it is the caller's own
      self: boolean;
      // "Marcus B.": said only once a request went through
      name: string;
      // the other player once took the caller off (071): the request
      // function answers "sent" and stores nothing
      removedBefore: boolean;
      // a request from the caller was already waiting on them
      waitingBefore: boolean;
      result: RequestResult | null;
    };

export type FriendAddAnswer = { ok: true; result: "sent" | "friends"; line: string } | { ok: false; error: string };

export function friendAddAnswer(facts: FriendAddFacts): FriendAddAnswer {
  const no = (error: string): FriendAddAnswer => ({ ok: false, error });
  if (!facts.found) return no(ADD_NOT_FOUND);
  if (facts.self) return no(ADD_SELF);
  switch (facts.result) {
    case "already":
      return no(ADD_ALREADY);
    case "blocked":
      return no(ADD_NOT_FOUND);
    case "friends":
      // each had asked the other: both wanted it
      return { ok: true, result: "friends", line: `You and ${facts.name} are friends.` };
    case "too_many":
      return no(facts.waitingBefore ? ADD_WAITING : FRIEND_REQUESTS_FULL_MESSAGE);
    case "sent":
      if (facts.removedBefore) return no(ADD_NOT_FOUND);
      if (facts.waitingBefore) return no(ADD_WAITING);
      return { ok: true, result: "sent", line: requestSentLine(facts.name) };
    default:
      return no(ADD_OFFLINE);
  }
}
