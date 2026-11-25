import { CLOCK_CAP_MINUTES, CLOCK_LIVE_SECONDS, CLOCK_WORDS, clockState } from "@shared/training-clock";

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

export type Clock = {
  owner: string; // whose clock it is: a phone follows whoever is signed in
  start: Shot;
  finish: Shot | null;
  heard: boolean; // the server answered "a clock started"
};

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
    return { owner: r.owner, start, finish, heard: r.heard === true };
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
//   ready    both photos taken: waiting to be posted
export type ClockView =
  | { at: "none" }
  | { at: "running" | "capped"; seconds: number }
  | { at: "expired" }
  | { at: "ready"; minutes: number };

export function clockView(c: Clock | null, nowMs: number): ClockView {
  if (!c) return { at: "none" };
  if (c.finish) return { at: "ready", minutes: readyMinutes(c) };
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

// The text fields that travel with the two photos.
export function clockFields(c: Clock, sentMs: number, kind: string, caption: string): Record<string, string> | null {
  if (!c.finish) return null;
  return {
    started: String(c.start.atMs),
    ended: String(c.finish.atMs),
    sent: String(sentMs),
    kind,
    caption: caption.trim(),
  };
}

// A refusal that sending again will never change: the clock is done with.
const FINAL = new Set(["short", "expired", "bad", "overlap", "day_cap"]);
export function refusalIsFinal(reason: unknown): boolean {
  return typeof reason === "string" && FINAL.has(reason);
}
