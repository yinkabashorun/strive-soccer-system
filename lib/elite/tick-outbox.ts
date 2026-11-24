// A drill ticked done is never lost and never shown as saved when it is
// not (Nov 24 2026, Coach Yinka: "the tracking of sessions needs to be
// absolutely and utterly on point").
//
// Before this, a tick was sent once. With weak signal at a field the send
// failed and nothing sent it again: on the phone the tick was quietly taken
// back off the screen after the finish screen had counted its minutes; on
// the website it stayed on the screen until the next load and then was
// gone. Either way the player was told a session was done that the coach
// never saw.
//
// Now every tick goes into a list kept on the device (the outbox) and is
// sent until the server answers:
//
//   saved     the server wrote it and read it back: the tick leaves the list
//   refused   the server said no for a reason that asking again will not
//             change (the drill is gone, the membership is paused): the
//             tick leaves the list and the player is told that drill did
//             not save
//   retry     no answer, or the server is busy: the tick STAYS, it is still
//             shown as done on this device, and it is sent again
//
// The same rules for the iPhone app (mobile/src/outbox.ts) and the website
// (components/elite/web-ticks.ts). Pure: no storage and no network here.
// Tested in tests/session-tracking.test.ts and mobile/tests/logic.test.ts.

// `seconds`: the time the drill really took, measured by the session player
// (only on a tick that marks a drill done).
export type Tick = { id: string; completed: boolean; at: number; tries: number; seconds?: number };
export type Outcome = "saved" | "refused" | "retry";

// The newest tap on a drill is the one that counts: Done then Undo before
// the first was sent leaves one tick, the Undo.
export function queueTick(list: readonly Tick[], id: string, completed: boolean, at: number, seconds?: number): Tick[] {
  const measured = completed && typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0 ? { seconds: Math.round(seconds) } : {};
  return [...list.filter((t) => t.id !== id), { id, completed, at, tries: 0, ...measured }];
}

// What an answer to a send means. A status of 0 is "no answer at all".
export function outcomeOf(status: number): Exclude<Outcome, "saved"> {
  if (status === 0 || status === 401 || status === 408 || status === 425 || status === 429 || status >= 500) return "retry";
  return "refused";
}

// The list after an answer to `sent`. A tick the player changed while it
// was on its way (a newer tap on the same drill) is kept either way.
export function settle(list: readonly Tick[], sent: Tick, outcome: Outcome): Tick[] {
  return list.flatMap((t) => {
    if (t.id !== sent.id || t.at !== sent.at) return [t];
    return outcome === "retry" ? [{ ...t, tries: t.tries + 1 }] : [];
  });
}

// How long to wait before sending again: quick at first, then once a
// minute for as long as it takes.
const WAITS_MS = [2_000, 5_000, 15_000, 30_000, 60_000];
export function retryDelayMs(tries: number): number {
  return WAITS_MS[Math.min(Math.max(0, tries), WAITS_MS.length - 1)];
}

// What is read back from the device's storage: only well-formed ticks.
export function parseTicks(raw: string | null): Tick[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.flatMap((t) =>
      t && typeof t.id === "string" && typeof t.completed === "boolean" && typeof t.at === "number"
        ? [{ id: t.id, completed: t.completed, at: t.at, tries: 0, ...(t.completed && typeof t.seconds === "number" && t.seconds >= 0 ? { seconds: t.seconds } : {}) }]
        : []
    );
  } catch {
    return [];
  }
}

// The words, in one place.
export const UNSENT_LINE = "Saved on this phone. It sends to your coach when you are back online.";
export const UNSENT_LINE_WEB = "Saved on this device. It sends to your coach when you are back online.";
export const REFUSED_LINE = "A drill did not save. Open the session and tap Done on it again.";
