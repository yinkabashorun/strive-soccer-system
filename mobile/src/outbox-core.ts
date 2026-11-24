import type { AppWeek } from "@shared/app-contract";
import type { Tick } from "@shared/tick-outbox";
import { applyDone } from "./week-cache";

// The outbox rules are shared with the website (lib/elite/tick-outbox.ts).
// What is the phone's own: what the screens show is always the server's
// week with the unsent ticks laid over it, worked out by the same rule the
// server uses (week-cache.ts).
export * from "@shared/tick-outbox";

// The server's week as this phone should show it.
export function overlay(week: AppWeek, list: readonly Tick[]): AppWeek {
  return list.reduce((w, t) => applyDone(w, t.id, t.completed), week);
}
