import type { Href, useRouter } from "expo-router";
import type { AppFreeFeed, AppOpenCard } from "@shared/app-contract";
import type { Kind } from "@shared/tracker";
import { queryClient } from "./api/queryClient";
import { freeKeys } from "./api/free";
import { MEDIA_BASE } from "./config";

// WHICH POST THE TRAINING CARD IS MADE FROM (app/card.tsx). The card screen
// is opened with what it needs held here, in memory, not in the screen's
// address: a photo just taken is a data URI or a file on this phone, far
// too big for a route, and never something to leave in the router's
// history.
//
//   key     the post, for "saved to Photos once per version"
//   photo   the photo itself: the finish photo just taken (a data URI), the
//           camera's file, or the post's signed link from the server
//   day     the entry's day, YYYY-MM-DD
//   minutes the entry's own minutes, as the server counted them
//   askAfter  opened straight after a post: whatever followed a post before
//           (the notifications ask, once) follows the card now
export type CardSource = { key: string; photo: string; day: string; minutes: number; kind: Kind; note: string | null; askAfter: boolean };

let source: CardSource | null = null;

export function cardSource(): CardSource | null {
  return source;
}

export function forgetCardSource(): void {
  source = null;
}

type Nav = Pick<ReturnType<typeof useRouter>, "push" | "replace">;

// Opened over the screen that was showing. `replace`: from the post screen,
// which is done, so closing the card goes back to where posting started.
export function openCard(router: Nav, next: CardSource, how: "push" | "replace" = "push"): void {
  source = next;
  const to = "/card" as Href;
  if (how === "replace") router.replace(to);
  else router.push(to);
}

// "Make my card" on one of your own posts in the feed.
export function cardFromFeed(card: Pick<AppOpenCard, "id" | "photoUrl" | "day" | "minutes" | "kind" | "caption">): CardSource {
  return { key: `post:${card.id}`, photo: card.photoUrl, day: card.day, minutes: card.minutes, kind: card.kind, note: card.caption ?? null, askAfter: false };
}

// "Make my card" on one of your own photos on You. A profile's grid carries
// no line, so the line is read from the feed when the post is in it.
export function cardFromProfile(post: { id: string; day: string; minutes: number; kind: Kind; photoUrl: string }): CardSource {
  const feed = queryClient.getQueryData<AppFreeFeed>(freeKeys.feed);
  const same = feed?.cards.find((c): c is AppOpenCard => c.state === "open" && c.mine && c.id === post.id);
  return { key: `post:${post.id}`, photo: post.photoUrl, day: post.day, minutes: post.minutes, kind: post.kind, note: same?.caption ?? null, askAfter: false };
}

// A finished session's photo was just posted: its time is the session's,
// written by the server, so it is read back from the feed once the post is
// in it. Null when it is not (the card is then not offered; nothing else
// about the post changes).
export function sessionCardFrom(feed: AppFreeFeed | undefined, postId: string | null | undefined, photo: string): CardSource | null {
  if (!feed || !postId) return null;
  const c = feed.cards.find((x): x is AppOpenCard => x.state === "open" && x.mine && x.id === postId);
  if (!c || !(c.minutes > 0)) return null;
  return { key: `post:${c.id}`, photo, day: c.day, minutes: c.minutes, kind: c.kind, note: c.caption ?? null, askAfter: true };
}

// The example build (the simulator, the browser preview) opens the card on
// its own, from a still that is already one of ours.
export function exampleCardSource(day: string): CardSource {
  return {
    key: "example",
    photo: `${MEDIA_BASE}/drills/posters/weak-foot-tap-pull-push.jpg`,
    day,
    minutes: 45,
    kind: "training",
    note: "Weak foot only.",
    askAfter: false,
  };
}
