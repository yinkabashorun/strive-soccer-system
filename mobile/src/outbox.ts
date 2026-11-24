import { useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_API, type AppWeek } from "@shared/app-contract";
import { api } from "@/api/client";
import { queryClient } from "@/api/queryClient";
import { applyDone } from "@/week-cache";
import { outcomeOf, parseTicks, queueTick, retryDelayMs, settle, type Tick } from "@/outbox-core";

// The outbox, kept and sent (the rules are in outbox-core.ts). The list is
// written to the phone's storage on every change, so a tick made with no
// signal survives the app being closed, and it is sent: when it is made,
// when the app opens or comes back to the front, and on a timer while
// anything is still waiting.
//
// Each tick is one row id and a yes or no. It is cleared with everything
// else on sign-out (src/account.ts).
export const OUTBOX_KEY = "strive.outbox.v1";
const WEEK_KEY = ["week"] as const;
const YOU_KEY = ["you"] as const;

let ticks: Tick[] = [];
let refused: string[] = [];
let loaded = false;
let sending = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function save() {
  void AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(ticks)).catch(() => undefined);
}

// Ticks made on this phone that the server has not confirmed yet.
export function useTicks(): readonly Tick[] {
  return useSyncExternalStore(subscribe, () => ticks, () => ticks);
}
// Drills whose tick the server refused, until the player taps them again.
export function useRefused(): readonly string[] {
  return useSyncExternalStore(subscribe, () => refused, () => refused);
}

export async function loadOutbox(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const stored = parseTicks(await AsyncStorage.getItem(OUTBOX_KEY).catch(() => null));
  // a tick made before the list was read is newer than what was stored
  const made = new Set(ticks.map((t) => t.id));
  ticks = [...stored.filter((t) => !made.has(t.id)), ...ticks];
  emit();
  void sendOutbox();
}

export function tickDrill(id: string, completed: boolean): void {
  ticks = queueTick(ticks, id, completed, Date.now());
  if (refused.includes(id)) refused = refused.filter((r) => r !== id);
  save();
  emit();
  void sendOutbox();
}

export async function clearOutbox(): Promise<void> {
  ticks = [];
  refused = [];
  if (timer) clearTimeout(timer);
  timer = null;
  emit();
  await AsyncStorage.removeItem(OUTBOX_KEY).catch(() => undefined);
}

// Oldest first, one at a time. Stops at the first tick that gets no answer
// (the rest would not either) and tries again after a wait.
export async function sendOutbox(): Promise<void> {
  if (sending) return;
  sending = true;
  if (timer) clearTimeout(timer);
  timer = null;
  try {
    for (;;) {
      const next = ticks[0];
      if (!next) return;
      try {
        const res = await api<{ ok: true; totalMinutes: number }>(APP_API.drill, {
          method: "POST",
          body: { id: next.id, completed: next.completed },
        });
        // The phone's copy of the week takes in what the server now holds.
        const week = queryClient.getQueryData<AppWeek>(WEEK_KEY);
        if (week) queryClient.setQueryData(WEEK_KEY, { ...applyDone(week, next.id, next.completed), totalMinutes: res.totalMinutes });
        ticks = settle(ticks, next, "saved");
        void queryClient.invalidateQueries({ queryKey: YOU_KEY });
      } catch (e) {
        const outcome = outcomeOf((e as { status?: number })?.status ?? 0);
        ticks = settle(ticks, next, outcome);
        if (outcome === "retry") {
          save();
          emit();
          timer = setTimeout(() => void sendOutbox(), retryDelayMs(next.tries));
          return;
        }
        refused = [...refused.filter((r) => r !== next.id), next.id];
        void queryClient.invalidateQueries({ queryKey: WEEK_KEY });
      }
      save();
      emit();
    }
  } finally {
    sending = false;
  }
}

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (s) => {
    if (s === "active") void sendOutbox();
  });
}
