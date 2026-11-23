"use client";

import { useLayoutEffect, useRef } from "react";
import { takeEntrance } from "@/lib/elite/tab-motion";

// Every member screen comes in once as it mounts (the template remounts on
// each navigation): from the right when the next tab was asked for, from
// the left for the one before, a soft rise and fade otherwise. 280 ms, one
// ease, a little scale for depth; reduced motion is a plain fade
// (globals.css). Set before the first paint, so nothing flashes in place
// first. The animation leaves no transform behind (a resting transform
// would become the frame of any fixed sheet inside the screen).
const CLASS = {
  "from-right": "animate-screen-from-right",
  "from-left": "animate-screen-from-left",
  "nudge-right": "animate-screen-nudge-right",
  "nudge-left": "animate-screen-nudge-left",
  fade: "animate-screen-in",
} as const;

// The screen the app opened on was drawn by the server and is already on
// the glass: it is never faded out to be faded back in.
let firstScreen = true;

export function TabEntrance({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const entrance = takeEntrance();
    if (firstScreen) {
      firstScreen = false;
      return;
    }
    el.classList.add(CLASS[entrance]);
  }, []);
  return <div ref={box}>{children}</div>;
}
