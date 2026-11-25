import { CLOCK_CAP_MINUTES, CLOCK_LESS_STEP, CLOCK_LIVE_SECONDS, CLOCK_WORDS, clockState, lessApplied, lessMax } from "@shared/training-clock";

// The training clock as this phone keeps it (the rules are in
// lib/elite/training-clock.ts; the store is src/clock.ts). Pure, so the
// app's tests can run it.
//
// A clock is two photos and the phone's own time at each. It lives on the
// phone from the start photo until the post reaches the server, so:
//   - no signal at the field changes nothing: the clock runs, both photos
//     are kept, and the post goes up when the phone is back online
//   - closing the app, or the phone restarting, loses nothing
//   - nobody types how long they trained
export type Shot = {
  atMs: number; // this phone's clock when the photo was taken
  b64: string | null; // the photo, already shrunk, as base64 JPEG
  uri: string | null; // where the picked photo is (the example build only)
};

// What the player chose when they tapped Post. Kept with the clock, so a
// post that could not be sent (no signal) is sent later BY THE APP, with
// nothing for the player to do again.
export type Pending = { kind: "training" | "gym"; caption: string; less: number };

export type Clock = {
  owner: string; // whose clock it is: a phone follows whoever is signed in
  start: Shot;
  finish: Shot | null;
  heard: boolean; // the server answered "a clock started"
  post: Pending | null; // Post was tapped: the app keeps sending it until it lands
};

function pending(raw: unknown): Pending | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.kind !== "training" && r.kind !== "gym") return null;
  const less = typeof r.less === "number" && Number.isInteger(r.less) && r.less >= 0 ? r.less : 0;
  return { kind: r.kind, caption: typeof r.caption === "string" ? r.caption : "", less };
}

function shot(raw: unknown): Shot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.atMs !== "number" || !Number.isSafeInteger(r.atMs) || r.atMs <= 0) return null;
  const b64 = typeof r.b64 === "string" && r.b64.length > 0 ? r.b64 : null;
  const uri = typeof r.uri === "string" && r.uri.length > 0 ? r.uri : null;
  return b64 || uri ? { atMs: r.atMs, b64, uri } : null;
}

// What was stored, read back. Anything that is not a whole clock is no clock.
export function parseClock(raw: string | null | undefined): Clock | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Record<string, unknown>;
    const start = shot(r.start);
    if (!start || typeof r.owner !== "string" || !r.owner) return null;
    const finish = r.finish == null ? null : shot(r.finish);
    if (r.finish != null && (!finish || finish.atMs <= start.atMs)) return null;
    // a post is only ever waiting on a finished clock
    return { owner: r.owner, start, finish, heard: r.heard === true, post: finish ? pending(r.post) : null };
  } catch {
    return null;
  }
}

// Something an <Image> can show.
export function shotUri(s: Shot): string | null {
  return s.b64 ? `data:image/jpeg;base64,${s.b64}` : s.uri;
}

// Is it still worth telling the server the clock started? Only while the
// word can arrive "live" (training-clock.ts settleClock): a later one
// proves nothing, so it is never sent.
export function startWorthTelling(c: Clock | null, nowMs: number): boolean {
  if (!c || c.heard || c.finish) return false;
  const ago = (nowMs - c.start.atMs) / 1000;
  return ago >= 0 && ago <= CLOCK_LIVE_SECONDS;
}

// When to try again, in ms after the start photo. The last one still lands
// inside the live window.
export const START_TELL_AT_MS = [0, 4_000, 12_000, 30_000, 70_000, 105_000] as const;

// Where the clock stands, for the screen.
//   none     no clock
//   running  counting
//   capped   past the cap: stopped counting, the finish photo is still taken
//   expired  it can no longer be timed
//   ready    both photos taken: waiting to be posted. `waiting`: Post was
//            tapped and it has not reached the server yet (it sends itself)
export type ClockView =
  | { at: "none" }
  | { at: "running" | "capped"; seconds: number }
  | { at: "expired" }
  | { at: "ready"; minutes: number; waiting: boolean };

export function clockView(c: Clock | null, nowMs: number): ClockView {
  if (!c) return { at: "none" };
  if (c.finish) return { at: "ready", minutes: lessApplied(readyMinutes(c), c.post?.less ?? 0), waiting: c.post !== null };
  const s = clockState(c.start.atMs, nowMs);
  if (s.state === "expired") return { at: "expired" };
  return { at: s.state, seconds: s.countedSeconds };
}

// The minutes a finished clock shows before it is posted: the time between
// the two photos, never past the cap. The server's own count is the one
// that is saved; it is the same unless the phone's clock was moved.
export function readyMinutes(c: Clock): number {
  if (!c.finish) return 0;
  const seconds = Math.max(0, (c.finish.atMs - c.start.atMs) / 1000);
  return Math.max(1, Math.min(CLOCK_CAP_MINUTES, Math.round(seconds / 60)));
}

// What the button that opens the clock says, wherever it is shown.
export function clockButton(view: ClockView): string {
  if (view.at === "ready") return CLOCK_WORDS.postShort;
  if (view.at === "none") return CLOCK_WORDS.start;
  return CLOCK_WORDS.finishShort;
}

// "Finished before you took this photo?": the next amount taken off, one
// step at a time, never past what leaves a minute and never below none.
export function lessStep(minutes: number, less: number, direction: -1 | 1): number {
  const next = less + (direction === -1 ? CLOCK_LESS_STEP : -CLOCK_LESS_STEP);
  return Math.max(0, Math.min(lessMax(minutes), next));
}

// The text fields that travel with the two photos: the two times, when it
// was sent, and what the player chose. Never a length (`less` can only take
// time off what the server itself counts).
export function clockFields(c: Clock, sentMs: number, p: Pending): Record<string, string> | null {
  if (!c.finish) return null;
  return {
    started: String(c.start.atMs),
    ended: String(c.finish.atMs),
    sent: String(sentMs),
    kind: p.kind,
    caption: p.caption.trim(),
    less: String(p.less),
  };
}

// When a waiting post is tried again while the app is open, in ms after
// the last try. The app also tries the moment it opens or comes back to
// the front.
export function resendDelayMs(tries: number): number {
  return [10_000, 30_000, 60_000][Math.min(Math.max(0, tries), 2)];
}

// Does opening the clock go straight to the camera? Only on a tap that
// asked for it, and only where the camera is the one thing to do next:
// the start for a player who has used the clock before (the first time
// they read how it works), and the finish once a minute has run.
export function cameraFirst(view: ClockView, knowsTheClock: boolean, minSeconds: number): "start" | "finish" | null {
  if (view.at === "none") return knowsTheClock ? "start" : null;
  if (view.at === "capped") return "finish";
  if (view.at === "running") return view.seconds >= minSeconds ? "finish" : null;
  return null;
}

// A refusal that sending again will never change: the clock is done with.
const FINAL = new Set(["short", "expired", "bad", "overlap", "day_cap"]);
export function refusalIsFinal(reason: unknown): boolean {
  return typeof reason === "string" && FINAL.has(reason);
}
