// How the member app moves between its tabs on a phone (Nov 23 2026,
// Coach Yinka: "when i am swiping through its not smooth like how
// instagram or snapchat is"): a sideways swipe follows the finger and
// snaps to the next or previous tab, a tap on the tab bar lights the tab
// at once, and the new screen comes in from the side it was asked for.
// The motion rules are experience.md's: a tap answers inside 0.15 s, a
// screen settles in 0.3 s, reduced motion is a plain fade. Pure rules here
// (unit-tested); the gesture is components/elite/SwipeTabs.tsx.

// The index of the tab this path is the root screen of, or -1. Only a
// tab's own screen swipes: inside a course or on Progress, a sideways
// swipe is left to the page (and to the phone's own swipe back).
export function tabIndex(pathname: string | null | undefined, hrefs: string[]): number {
  return hrefs.indexOf(pathname ?? "");
}

// Which way the finger is going, once it has moved far enough to say.
// Sideways only when clearly sideways, so a scroll that drifts is still a
// scroll.
export const AXIS_SLOP_PX = 10;

export function axisOf(dx: number, dy: number): "x" | "y" | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < AXIS_SLOP_PX && ay < AXIS_SLOP_PX) return null;
  return ax > ay * 1.3 ? "x" : "y";
}

// A touch that starts this close to either edge belongs to the phone (the
// swipe back in the iPhone app, the browser's own back and forward).
export const EDGE_PX = 24;

export function startsAtEdge(x: number, width: number): boolean {
  return x < EDGE_PX || x > width - EDGE_PX;
}

// Where the screen sits under the finger. Past the first or last tab it
// moves a quarter as far, so the end is felt, not hit.
export function followFinger(dx: number, hasNeighbor: boolean): number {
  return hasNeighbor ? dx : dx * 0.25;
}

// On release: a long enough drag, or a quick flick, goes to the
// neighbour; anything else springs back. dx in px (left is negative),
// dt in ms.
export const COMMIT_FRACTION = 0.28;
export const FLICK_PX_PER_MS = 0.45;
export const FLICK_MIN_PX = 40;

export function swipeOutcome(input: { dx: number; dt: number; width: number; index: number; count: number }): "next" | "prev" | null {
  const { dx, dt, width, index, count } = input;
  if (index < 0 || count < 2 || width <= 0) return null;
  const far = Math.abs(dx) >= width * COMMIT_FRACTION;
  const flick = Math.abs(dx) >= FLICK_MIN_PX && dt > 0 && Math.abs(dx) / dt >= FLICK_PX_PER_MS;
  if (!far && !flick) return null;
  // finger to the left = the next tab, as on every phone
  if (dx < 0 && index < count - 1) return "next";
  if (dx > 0 && index > 0) return "prev";
  return null;
}

// The side the next screen comes in from, told by whoever moved (the bar
// or the swipe) and read once by the screen as it mounts.
// A swipe brings the screen in from well off to the side (it is already
// moving); a tap on the bar only nudges it in, the way a tab should.
export type Entrance = "from-right" | "from-left" | "nudge-right" | "nudge-left" | "fade";

let pending: Entrance | null = null;

export function setEntrance(e: Entrance): void {
  pending = e;
}

export function takeEntrance(): Entrance {
  const e = pending ?? "fade";
  pending = null;
  return e;
}

// Going from one tab to another: the new one comes in from its own side.
export function entranceBetween(from: number, to: number, how: "swipe" | "tap" = "swipe"): Entrance {
  if (from < 0 || to < 0 || from === to) return "fade";
  if (how === "tap") return to > from ? "nudge-right" : "nudge-left";
  return to > from ? "from-right" : "from-left";
}
