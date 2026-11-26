// ONE APP for a free player and a Strive Pro member (Coach Yinka, Nov 24
// 2026: "pro should just add tabs", after "why would they lose friends
// when they upgrade"; Nov 26: every member, on any membership, however they
// joined, see getsFreeApp below).
//
// The whole rule, in one place, shared with the phone ("@shared/one-app"):
//   - A free player has four tabs: Friends, Week, Clubs, You.
//   - Strive Pro ADDS ONE TAB, Train, in front. It takes nothing away and
//     moves nothing else: the same Friends, the same Week, the same Clubs,
//     the same You, with the same friends, posts and clubs in them.
//   - When Strive Pro ends, Train goes and everything else stays.
// Pure. tests/one-app.test.ts holds it: Pro's tabs are always the free
// tabs plus Train, in the free order, and never one fewer.
import { isPro } from "./tiers";
import { FREE_MIN_AGE } from "./tracker";

export type OneAppTabKey = "train" | "friends" | "week" | "clubs" | "you";
export type OneAppTab = { key: OneAppTabKey; label: string };

export const FREE_APP_TABS: readonly OneAppTab[] = [
  { key: "friends", label: "Friends" },
  { key: "week", label: "Week" },
  { key: "clubs", label: "Clubs" },
  { key: "you", label: "You" },
];

export const TRAIN_TAB: OneAppTab = { key: "train", label: "Train" };

// `pro`: Strive Pro is on for this player right now.
export function oneAppTabs(pro: boolean): OneAppTab[] {
  return pro ? [TRAIN_TAB, ...FREE_APP_TABS] : [...FREE_APP_TABS];
}

// The tab the app opens on: a Pro member opens to train, a free player to
// their friends.
export function firstTab(pro: boolean): OneAppTabKey {
  return pro ? "train" : "friends";
}

// Who keeps the free app: an account with a free app behind it that has no
// member row; or whose member row is a Strive Pro one, whether that
// membership is on (they have Train too) or not (they are a free player);
// or a member on any other membership while it is switched on (everybody
// has the whole app, getsFreeApp below). A coaching membership that is
// not on waits on the coach as it always did.
export function keepsFreeApp(i: {
  hasTracker: boolean;
  hasPlayer: boolean;
  tier: string | null | undefined;
  status?: string | null | undefined;
}): boolean {
  if (!i.hasTracker) return false;
  if (!i.hasPlayer || isPro(i.tier)) return true;
  return membershipOn(i.status);
}

function membershipOn(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

// EVERY MEMBER HAS THE WHOLE APP (Coach Yinka, Nov 26 2026: "do
// not forget the heart of the app is the free strava for soccer / social
// media version ... even improved experience if a player is on pro ...
// make it so incredibly seamless"). A player who bought Strive Pro
// straight away (on the website, never through Join free) had no free
// account behind them, so their app was Train alone: no friends, no
// clubs, no board. They now get the free app's side made for them the
// first time the app or the site reads who they are
// (lib/elite/pro-social-server.ts), with nothing to tap: the same five
// tabs as a free player who upgraded.
//
// Who: ANY membership (Coach Yinka the same day, asked whether coaching
// families get it too: "yes everybody should get it"), switched on, the
// quiz done, and 13 or older by the age they gave (the free app is 13 and
// older by its Terms; a younger member, whose parent made the account,
// keeps Train and Courses and is never put among friends). An age that
// is not known is not 13.
// Nothing of theirs is shown to anyone by this: friends are by accepted
// request, a post is their own tap, and the photo and @username are asked
// first as for everyone.
export function getsFreeApp(i: {
  tier: string | null | undefined;
  status: string | null | undefined;
  onboarded: boolean;
  age: number | null | undefined;
}): boolean {
  if (!membershipOn(i.status)) return false;
  if (!i.onboarded) return false;
  return typeof i.age === "number" && Number.isFinite(i.age) && i.age >= FREE_MIN_AGE;
}

// Strive Pro was on for this free player and is not any more: a card
// membership that was cancelled, or an earned month that ran out. A player
// who tapped Start and never paid was never on, and is told nothing.
export function proEnded(i: { tier: string | null | undefined; status: string | null | undefined; hadEarnedMonth: boolean }): boolean {
  if (!isPro(i.tier)) return false;
  if (i.status === "active" || i.status === "trialing") return false; // it is on
  return i.status === "canceled" || i.hadEarnedMonth;
}

// Said once, calmly, at the top of Week, and put away with one tap. It
// sells nothing: the one upgrade card on Week is the only prompt.
export const PRO_ENDED_LINE = "Your Strive Pro ended. Your training, your friends and your clubs are all still here.";
export const PRO_ENDED_DISMISS = "Got it";

// The finish screen's one quiet row for a member with friends in the app.
export const POST_SESSION_ROW = "Post it to your friends";
export const POST_SESSION_DETAIL = "Add a photo. Your time is already on your week.";
export const POST_SESSION_NOT_READY = "This session has not saved yet. Give it a moment and try again.";
