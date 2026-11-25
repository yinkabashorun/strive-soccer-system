// THE TRAINING CLOCK (Coach Yinka, Nov 25 2026: "a pic when they arrive
// then when they dip", so people can't just lie about their training).
//
// In the free app a player takes a photo to start training and a photo to
// finish it. The time between the two photos is the time trained. Nobody
// types a number, and both photos are taken in the app's own camera, so a
// photo from last week cannot stand in for today.
//
// Two kinds of time come out of it (the way Strava keeps a typed-in
// activity off its leaderboards):
//
//   - TIMED: counts everywhere. The friends board, a club's time, the
//     weekly club matchup, the level, and a teammate counting toward the
//     earned month of Strive Pro.
//   - TYPED: a player who skipped the clock says how long they trained.
//     It shows on their own week, marked, and counts on none of those.
//
// The rule lives here, once, for the server, the website and the phone
// ("@shared/training-clock"). Pure: no I/O, nothing imported.

// How an entry's time is known.
//   before   logged before the clock existed. Still counts: history is
//            never rewritten.
//   typed    the player said how long. Their own week only.
//   clock    the time between a start photo and a finish photo.
//   session  a finished Strive Pro session, timed drill by drill.
export const PROOFS = ["before", "typed", "clock", "session"] as const;
export type Proof = (typeof PROOFS)[number];

// THE ONE RULE: does this entry's time count beyond the player's own week?
// Everything that adds up time for a board, a club, a matchup, the level
// or a teammate count asks this and nothing else.
export function countsOnBoards(proof: Proof | null | undefined): boolean {
  return proof !== "typed";
}

// The one proof that does not count, by name, for a database filter.
export const TYPED: Proof = "typed";

// What a typed entry says beside its time, everywhere it is shown.
export const NOT_TIMED = "Not timed";
export const TYPED_LINE = "It shows on your week. It does not count on the board.";
// The website has no clock (the two photos are taken in the iPhone app's
// camera), so every length picked there is typed. Said before posting.
export const WEB_TYPED_LINE = "This goes on your week. Only training timed in the iPhone app counts on the board.";

// The longest one session can count (his number, Nov 25 2026): a clock
// somebody forgot to stop is never ten hours.
export const CLOCK_CAP_MINUTES = 150;
// The finish photo is still taken this long after the cap. Past it the
// session was never finished, so it is not timed.
export const CLOCK_GRACE_MINUTES = 30;
// Shorter than this is not a session.
export const CLOCK_MIN_SECONDS = 60;
// The server saw the start "live" when the phone's word reached it this
// soon after the start photo.
export const CLOCK_LIVE_SECONDS = 120;
// Room for the two clocks (the phone's, the server's) not agreeing.
export const CLOCK_SLACK_SECONDS = 120;

// The two photos travel in ONE request, so each is kept small: together
// they must fit what a request to the site may carry. The phone shrinks a
// photo down these steps until it fits; the server refuses a bigger one.
export const CLOCK_PHOTO_MAX_BYTES = 1_500_000;
export const CLOCK_PHOTO_STEPS = [
  { edge: 1280, compress: 0.72 },
  { edge: 1080, compress: 0.6 },
  { edge: 800, compress: 0.5 },
] as const;

const CAP_S = CLOCK_CAP_MINUTES * 60;
const END_S = (CLOCK_CAP_MINUTES + CLOCK_GRACE_MINUTES) * 60;

// ---- On the phone -------------------------------------------------------

// Where a running clock stands.
//   running  counting.
//   capped   past the cap: it stopped counting, the finish photo is still taken.
//   expired  past the cap and the grace: it can no longer be timed.
export type ClockState = { state: "running" | "capped" | "expired"; elapsedSeconds: number; countedSeconds: number };

export function clockState(startedAtMs: number, nowMs: number): ClockState {
  const elapsed = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  if (elapsed >= END_S) return { state: "expired", elapsedSeconds: elapsed, countedSeconds: 0 };
  return { state: elapsed >= CAP_S ? "capped" : "running", elapsedSeconds: elapsed, countedSeconds: Math.min(elapsed, CAP_S) };
}

const two = (n: number) => String(n).padStart(2, "0");

// The clock's face: "0:07", "42:10", "1:05:09".
export function clockFace(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

// "45m", "1h", "2h 30m": a length in the words the rest of the app uses.
export function clockLength(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`;
}

// "2 hours 30 minutes", "3 hours": a length said in full.
export function clockWords(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h ? `${h} ${h === 1 ? "hour" : "hours"}` : "";
  const mins = m ? `${m} ${m === 1 ? "minute" : "minutes"}` : "";
  return [hours, mins].filter(Boolean).join(" ") || "0 minutes";
}

// The words on the screens, one place for the website and the phone.
export const CLOCK_WORDS = {
  start: "Start training",
  startHead: "Start your training",
  startBody: "Take a photo to start the clock. Take one more when you finish. The time between your two photos is your training.",
  startButton: "Take my start photo",
  running: "Training",
  runningBody: "Put your phone down and train. Take your finish photo when you are done.",
  finish: "Take my finish photo",
  finishShort: "Finish my training",
  postShort: "Post my training",
  skip: "Skip it",
  cap: `The clock counts up to ${clockWords(CLOCK_CAP_MINUTES)}.`,
  capped: `Your clock reached ${clockWords(CLOCK_CAP_MINUTES)} and stopped counting. Take your finish photo to post it.`,
  expiredHead: "This one was not timed",
  expiredBody: `Your clock ran past ${clockWords(CLOCK_CAP_MINUTES + CLOCK_GRACE_MINUTES)} with no finish photo, so we could not time it. You can still add it to your week.`,
  short: "That was under a minute, so nothing was added.",
  tooSoon: "Your clock has been running for under a minute. Keep training.",
  ready: "Ready to post",
  between: "The time between your two photos.",
  retake: "Take my finish photo again",
  kept: "Your training is saved on this phone. Post it when you are back online.",
  typedButton: "Add it to my week",
  backToClock: "Start the clock instead",
  cameraOff: "The camera is turned off for Strive Elite. Turn it on in Settings to start the clock.",
  cancel: "Stop without posting",
  cancelAsk: "Stop this clock? Nothing is added to your week.",
  typedLink: "Trained without the clock?",
  typedHead: "How long did you train?",
  post: "Post to my friends",
  overlap: "You already have training timed for then.",
} as const;

// ---- On the server ------------------------------------------------------

export type ClockRefusal = "bad" | "short" | "expired";

export type ClockSettled =
  | { ok: true; minutes: number; startedAtMs: number; endedAtMs: number; startSeen: boolean }
  | { ok: false; reason: ClockRefusal };

// How long a finished clock counts, worked out by the server.
//
// The phone says when each photo was taken and when it sent them, all on
// its own clock. Only DIFFERENCES between those are used, so a phone
// whose clock is simply wrong changes nothing, and the session is pinned
// to the server's own time of receipt.
//
// When the server saw the start live (the phone told it within two
// minutes of the start photo), the session can never be longer than the
// time the server itself watched go by: changing the phone's clock between
// the photos gains nothing. A start the server never saw (no signal at the
// field) falls back to the phone's own count, so training still counts
// where there is no signal.
export function settleClock(i: {
  nowMs: number; // the server's clock when the finish arrived
  phoneStartedMs: number;
  phoneEndedMs: number;
  phoneSentMs: number;
  seen: { atMs: number; agoSeconds: number } | null; // the start, as the server heard of it
}): ClockSettled {
  const all = [i.nowMs, i.phoneStartedMs, i.phoneEndedMs, i.phoneSentMs];
  if (!all.every((n) => Number.isFinite(n) && n > 0)) return { ok: false, reason: "bad" };
  const phoneSeconds = (i.phoneEndedMs - i.phoneStartedMs) / 1000;
  if (!(phoneSeconds > 0)) return { ok: false, reason: "bad" };
  if (phoneSeconds >= END_S) return { ok: false, reason: "expired" };

  // how long the finish waited on the phone before it reached us
  const waitedMs = Math.min(Math.max(0, i.phoneSentMs - i.phoneEndedMs), 24 * 3600 * 1000);
  const endedAtMs = i.nowMs - waitedMs;

  let seconds = phoneSeconds;
  const live = i.seen !== null && Number.isFinite(i.seen.atMs) && i.seen.agoSeconds >= 0 && i.seen.agoSeconds <= CLOCK_LIVE_SECONDS;
  if (live && i.seen) {
    const seenStartMs = i.seen.atMs - i.seen.agoSeconds * 1000;
    const watched = (endedAtMs - seenStartMs) / 1000 + CLOCK_SLACK_SECONDS;
    seconds = Math.min(seconds, watched);
  }
  seconds = Math.min(seconds, CAP_S);
  if (seconds < CLOCK_MIN_SECONDS) return { ok: false, reason: "short" };
  const minutes = Math.max(1, Math.round(seconds / 60));
  return { ok: true, minutes, startedAtMs: endedAtMs - Math.round(seconds * 1000), endedAtMs, startSeen: live };
}

// What the phone sends with its two photos. Whole numbers of milliseconds
// on the phone's own clock.
export function cleanClockTimes(raw: { started?: unknown; ended?: unknown; sent?: unknown }): { started: number; ended: number; sent: number } | null {
  const n = (v: unknown) => {
    const x = typeof v === "number" ? v : typeof v === "string" && /^\d{10,16}$/.test(v.trim()) ? Number(v) : NaN;
    return Number.isSafeInteger(x) && x > 0 ? x : null;
  };
  const started = n(raw.started);
  const ended = n(raw.ended);
  const sent = n(raw.sent);
  return started !== null && ended !== null && sent !== null ? { started, ended, sent } : null;
}
