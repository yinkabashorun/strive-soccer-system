"use client";

import { useSyncExternalStore } from "react";
import { toggleHomework } from "@/lib/elite/player-actions";
import { parseTicks, queueTick, retryDelayMs, settle, type Outcome, type Tick } from "@/lib/elite/tick-outbox";

// The website's outbox (the rules are in lib/elite/tick-outbox.ts; the
// iPhone app's is mobile/src/outbox.ts). A drill ticked in the browser is
// kept in the browser's storage and sent until the server answers, so a
// tick made with weak signal at a field survives a reload and is never
// left on the screen unsaved.
export const WEB_TICKS_KEY = "strive.ticks.v1";

const EMPTY: readonly Tick[] = [];
const NONE: readonly string[] = [];
let ticks: Tick[] = [];
let refused: string[] = [];
// What the server confirmed since this page was drawn: the page's own rows
// were read before that, so the screen keeps the tick from here.
let confirmed: Record<string, boolean> = {};
const NOTHING: Record<string, boolean> = {};
// The time each drill ticked in this browser really took (the session
// player's clock), kept after the save so the screen's minutes stay true.
let measured: Record<string, number> = {};
const UNMEASURED: Record<string, number> = {};
let loaded = false;
let sending = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function save() {
  try {
    window.localStorage.setItem(WEB_TICKS_KEY, JSON.stringify(ticks));
  } catch {
    // storage off (a private window): the tick is still sent from memory
  }
}
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  let stored: Tick[] = [];
  try {
    stored = parseTicks(window.localStorage.getItem(WEB_TICKS_KEY));
  } catch {
    stored = [];
  }
  const made = new Set(ticks.map((t) => t.id));
  ticks = [...stored.filter((t) => !made.has(t.id)), ...ticks];
  for (const t of ticks) if (t.completed && t.seconds !== undefined && measured[t.id] === undefined) measured = { ...measured, [t.id]: t.seconds };
  window.addEventListener("online", () => void sendWebTicks());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void sendWebTicks();
  });
  if (ticks.length) {
    emit();
    void sendWebTicks();
  }
}
function subscribe(l: () => void) {
  listeners.add(l);
  load();
  return () => listeners.delete(l);
}

// Ticks made in this browser that the server has not confirmed yet.
export function useWebTicks(): readonly Tick[] {
  return useSyncExternalStore(subscribe, () => ticks, () => EMPTY);
}
// Drills whose tick the server refused, until the player taps them again.
export function useWebRefused(): readonly string[] {
  return useSyncExternalStore(subscribe, () => refused, () => NONE);
}

// Ticks the server has confirmed since the page loaded.
export function useWebConfirmed(): Record<string, boolean> {
  return useSyncExternalStore(subscribe, () => confirmed, () => NOTHING);
}

// Seconds measured for the drills ticked in this browser, by drill id.
export function useWebMeasured(): Record<string, number> {
  return useSyncExternalStore(subscribe, () => measured, () => UNMEASURED);
}

// `seconds`: the time the drill really took, from the session player.
export function tickOnWeb(id: string, completed: boolean, seconds?: number): void {
  load();
  ticks = queueTick(ticks, id, completed, Date.now(), seconds);
  const kept = { ...measured };
  delete kept[id];
  const now = ticks[ticks.length - 1];
  measured = now.seconds !== undefined ? { ...kept, [id]: now.seconds } : kept;
  if (refused.includes(id)) refused = refused.filter((r) => r !== id);
  save();
  emit();
  void sendWebTicks();
}

// Oldest first, one at a time; stops at the first tick that gets no answer
// and tries again after a wait.
export async function sendWebTicks(): Promise<void> {
  if (sending) return;
  sending = true;
  if (timer) clearTimeout(timer);
  timer = null;
  try {
    for (;;) {
      const next = ticks[0];
      if (!next) return;
      let outcome: Outcome;
      try {
        const res = await toggleHomework(next.id, next.completed, next.seconds);
        outcome = res.ok ? "saved" : res.again ? "retry" : "refused";
      } catch {
        outcome = "retry"; // no answer at all
      }
      ticks = settle(ticks, next, outcome);
      if (outcome === "saved") confirmed = { ...confirmed, [next.id]: next.completed };
      if (outcome === "refused") refused = [...refused.filter((r) => r !== next.id), next.id];
      save();
      emit();
      if (outcome === "retry") {
        timer = setTimeout(() => void sendWebTicks(), retryDelayMs(next.tries));
        return;
      }
    }
  } finally {
    sending = false;
  }
}
