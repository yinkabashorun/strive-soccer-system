"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  axisOf,
  entranceBetween,
  followFinger,
  setEntrance,
  startsAtEdge,
  swipeOutcome,
  tabIndex,
} from "@/lib/elite/tab-motion";

// A sideways swipe between the member tabs on a phone, the way Instagram
// and Snapchat move (Nov 23 2026). The screen follows the finger, leans
// back a touch as it goes (scale and dim, the "depth"), and on release
// either snaps on to the next tab or springs back. Vertical scrolling is
// the browser's own and never waits on this (touch-action: pan-y). Left
// alone: a touch at either edge (the phone's own swipe back), anything
// inside a sheet or a full-screen player, a field, a video, and anything
// that scrolls sideways itself (a row of course cards). Reduced motion:
// nothing follows the finger; a swipe that counts just changes the tab.
// Rules in lib/elite/tab-motion.ts.
const SPRING = "transform 320ms cubic-bezier(0.34,1.32,0.5,1), opacity 320ms cubic-bezier(0.22,1,0.36,1)";
const OUT = "transform 170ms cubic-bezier(0.4,0,1,1), opacity 170ms cubic-bezier(0.4,0,1,1)";

function scrollsSideways(el: Element | null, stop: Element): boolean {
  for (let n = el; n && n !== stop; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 1) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
  }
  return false;
}

export function SwipeTabs({ tabs, children }: { tabs: string[]; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const box = useRef<HTMLDivElement>(null);
  const index = tabIndex(pathname, tabs);

  // The neighbours are already on the phone, so a swipe lands at once.
  useEffect(() => {
    if (index < 0) return;
    for (const i of [index - 1, index + 1]) if (tabs[i]) router.prefetch(tabs[i]);
  }, [index, tabs, router]);

  useEffect(() => {
    const el = box.current;
    if (!el || index < 0) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (!coarse) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let start: { x: number; y: number; t: number } | null = null;
    let axis: "x" | "y" | null = null;
    let dx = 0;

    const place = (x: number, animate: string | null) => {
      const w = el.clientWidth || window.innerWidth;
      const depth = Math.min(1, Math.abs(x) / w);
      el.style.transition = animate ?? "none";
      el.style.transform = x === 0 ? "" : `translate3d(${x}px,0,0) scale(${1 - depth * 0.05})`;
      el.style.opacity = x === 0 ? "" : String(1 - depth * 0.35);
    };

    const onStart = (e: TouchEvent) => {
      start = null;
      axis = null;
      dx = 0;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const target = e.target as Element | null;
      if (startsAtEdge(t.clientX, window.innerWidth)) return;
      if (target?.closest('[role="dialog"], [aria-modal="true"], input, textarea, select, [contenteditable="true"], video, [data-no-swipe]')) return;
      if (scrollsSideways(target, el)) return;
      start = { x: t.clientX, y: t.clientY, t: performance.now() };
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const t = e.touches[0];
      const mx = t.clientX - start.x;
      const my = t.clientY - start.y;
      if (!axis) {
        axis = axisOf(mx, my);
        if (axis === "y") {
          start = null; // a scroll: the page's own
          return;
        }
        if (!axis) return;
      }
      dx = mx;
      if (reduced) return;
      const hasNeighbor = mx < 0 ? index < tabs.length - 1 : index > 0;
      place(followFinger(mx, hasNeighbor), null);
    };

    const onEnd = () => {
      if (!start || axis !== "x") {
        start = null;
        return;
      }
      const w = el.clientWidth || window.innerWidth;
      const outcome = swipeOutcome({ dx, dt: performance.now() - start.t, width: w, index, count: tabs.length });
      start = null;
      if (!outcome) {
        place(0, reduced ? null : SPRING);
        return;
      }
      const to = outcome === "next" ? index + 1 : index - 1;
      setEntrance(reduced ? "fade" : entranceBetween(index, to));
      if (!reduced) place(outcome === "next" ? -w * 0.4 : w * 0.4, OUT);
      router.push(tabs[to]);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [index, tabs, router]);

  // A new screen: the box is put straight back where it belongs (the new
  // screen does its own entrance, components/elite/TabEntrance.tsx).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = "";
    el.style.opacity = "";
  }, [pathname]);

  return (
    // No transform hint and no resting transform: either would make this box
    // the frame of every fixed sheet inside it. The transform is set only
    // while a finger is on the glass.
    <div ref={box} style={{ transformOrigin: "50% 30%", touchAction: "pan-y pinch-zoom" }}>
      {children}
    </div>
  );
}
