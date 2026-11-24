"use client";

import { useCallback, useMemo, useState } from "react";
import type { Homework } from "@/lib/elite/types";
import { drillMinutes, isDone, type DoneMap } from "@/lib/elite/session-flow";
import { tickOnWeb, useWebConfirmed, useWebTicks } from "./web-ticks";

// The player's ticks, kept on the screen first and saved behind it, so a
// tap answers instantly. Shared by the home card and the week list, which
// both open the session player (the drill list that used to sit under
// them gave way to the photo cards of the redesign, Nov 21 2026).
//
// "Saved behind it" means kept in the browser and sent until the server
// answers (web-ticks.ts), not sent once and hoped for: a tick the server
// has not confirmed yet still shows as done after a reload.
export function useDrillState() {
  const [tapped, setTapped] = useState<DoneMap>({});
  const unsent = useWebTicks();
  const confirmed = useWebConfirmed();

  const toggle = useCallback((id: string, next: boolean) => {
    setTapped((s) => ({ ...s, [id]: next }));
    tickOnWeb(id, next);
  }, []);

  // oldest knowledge first: what the server confirmed since the page was
  // drawn, then what is still on its way, then what was tapped just now
  const done = useMemo<DoneMap>(
    () => ({ ...confirmed, ...Object.fromEntries(unsent.map((t) => [t.id, t.completed])), ...tapped }),
    [confirmed, unsent, tapped]
  );
  return { done, toggle };
}

// All-time minutes as the screen knows them right now: the server's total
// with this week's rows re-counted from the player's own ticks.
export function liveMinutes(totalMinutes: number, weekRows: Homework[], done: DoneMap): number {
  let total = totalMinutes;
  for (const h of weekRows) {
    const m = drillMinutes(h);
    if (h.completed) total -= m;
    if (isDone(h, done)) total += m;
  }
  return Math.max(0, total);
}
