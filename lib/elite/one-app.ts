// ONE APP for a free player and a Strive Pro member who came through the
// free app (Coach Yinka, Nov 24 2026: "pro should just add tabs", after
// "why would they lose friends when they upgrade").
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
// member row, or whose member row is a Strive Pro one, whether that
// membership is on (they have Train too) or not (they are a free player).
export function keepsFreeApp(i: { hasTracker: boolean; hasPlayer: boolean; tier: string | null | undefined }): boolean {
  if (!i.hasTracker) return false;
  return !i.hasPlayer || isPro(i.tier);
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
