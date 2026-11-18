// Fresh on reopen (App Store punch list, A5). A phone app that comes back
// from the background shows what is true now, not what was true when it
// was put away: a new week that went live, a message from the coach, a
// Film Room that was announced.
//
// The rule is pure and lives here. The listener is FreshOnReturn.tsx.

// Away for at least this long before a return refreshes the screen. A
// glance at a text and back is not a reason to redraw anything.
export const FRESH_AFTER_MS = 60_000;

export function shouldRefreshOnReturn(input: {
  hiddenForMs: number | null; // null: the page was never hidden
  holds: number; // open session players and uploads in flight
}): boolean {
  if (input.hiddenForMs === null) return false;
  if (input.holds > 0) return false;
  return input.hiddenForMs >= FRESH_AFTER_MS;
}

// Things that must not have the page redrawn under them: a session that
// is open full screen, a clip that is uploading. Each takes a hold and
// gives it back when it is done. Module state, one per browser tab.
let holds = 0;

export function holdRefresh(): () => void {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
  };
}

export function refreshHolds(): number {
  return holds;
}
