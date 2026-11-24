// The session player's clock (Nov 24 2026: minutes trained are the ACTUAL
// minutes). It measures how long each drill has been the one on screen in
// this sitting: from the moment it comes up to the tap on Done, added up if
// the player flips to another drill and back. The count-in and the finish
// screen are nobody's time.
//
// Wall-clock time, on purpose: a phone in a pocket with the screen locked
// is still a player doing the drill. What stops a phone left open all night
// from counting is the cap (lib/elite/time-trained.ts cappedSeconds), not
// this file.
//
// Pure, the same on the phone and the website. Tested in
// tests/session-tracking.test.ts.
export type DrillClock = { on: string | null; since: number; spent: Record<string, number> };

export function newClock(): DrillClock {
  return { on: null, since: 0, spent: {} };
}

// The drill on screen changed (null: no drill is on screen).
export function showDrill(c: DrillClock, id: string | null, now: number): DrillClock {
  if (c.on === id) return c;
  const spent = c.on ? { ...c.spent, [c.on]: (c.spent[c.on] ?? 0) + Math.max(0, now - c.since) } : c.spent;
  return { on: id, since: now, spent };
}

// Seconds this drill has had on screen so far.
export function secondsOn(c: DrillClock, id: string, now: number): number {
  const ms = (c.spent[id] ?? 0) + (c.on === id ? Math.max(0, now - c.since) : 0);
  return Math.round(ms / 1000);
}

// The drill was ticked done (or unticked): its time starts from nothing if
// it is done again.
export function resetDrill(c: DrillClock, id: string, now: number): DrillClock {
  const spent = { ...c.spent };
  delete spent[id];
  return { on: c.on, since: c.on === id ? now : c.since, spent };
}
