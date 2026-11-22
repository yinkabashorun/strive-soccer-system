"use client";

import { useCallback, useState, useTransition } from "react";
import type { Homework } from "@/lib/elite/types";
import { toggleHomework } from "@/lib/elite/player-actions";
import { drillMinutes, isDone, type DoneMap } from "@/lib/elite/session-flow";

// The player's ticks, kept on the screen first and saved behind it, so a
// tap answers instantly. Shared by the home card and the week list, which
// both open the session player (the drill list that used to sit under
// them gave way to the photo cards of the redesign, Nov 21 2026).
export function useDrillState() {
  const [done, setDone] = useState<DoneMap>({});
  const [, start] = useTransition();

  const toggle = useCallback((id: string, next: boolean) => {
    setDone((s) => ({ ...s, [id]: next }));
    start(() => {
      void toggleHomework(id, next);
    });
  }, []);

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
