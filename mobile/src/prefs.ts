import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dropSeenKey, parseSeenWeek } from "@shared/experience";

// This phone's own settings (a per-device convenience, never a record):
// vibration, the timer's tones, drill demos playing on their own, and the
// two one-time moments (the notifications ask, the Monday drop).
// clockKnown: this player has started a training clock before, so "Start
// training" goes straight to the camera (src/clock-core.ts cameraFirst).
// doorPassed: the account (its email) that went past the door's "Have a
// code?" on this phone with no code, so the door is asked once
// (src/door.ts doorDue).
// recapSeen: the week (its Monday) whose Monday card was put away with
// "Got it" on this phone (lib/elite/week-recap.ts recapDue).
// firstOpen: when the app first opened on this phone (ISO), and
// ratingAsked: the version the App Store rating was last asked in
// (src/rating-ask.ts).
// cardsSaved: the training cards (each a photo and a quote,
// lib/elite/session-card.ts cardKey) already saved to Photos from this
// phone, newest last, so a card is saved once and not again on every share.
export type Prefs = { vibration: boolean; sound: boolean; autoplay: boolean; pushAsked: boolean; pushOn: boolean; firstDaysHidden: boolean; proEndedSeen: boolean; clockKnown: boolean; doorPassed: string; recapSeen: string; firstOpen: string; ratingAsked: string; cardsSaved: string[] };

export const DEFAULT_PREFS: Prefs = { vibration: true, sound: true, autoplay: true, pushAsked: false, pushOn: false, firstDaysHidden: false, proEndedSeen: false, clockKnown: false, doorPassed: "", recapSeen: "", firstOpen: "", ratingAsked: "", cardsSaved: [] };
const KEY = "strive.prefs.v1";

let cache: Prefs | null = null;
const listeners = new Set<(p: Prefs) => void>();

export async function loadPrefs(): Promise<Prefs> {
  if (cache) return cache;
  let read = false;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = { ...DEFAULT_PREFS, ...(raw ? (JSON.parse(raw) as Partial<Prefs>) : {}) };
    read = true;
  } catch {
    cache = { ...DEFAULT_PREFS };
  }
  // the first time the app opened on this phone, kept from then on (only
  // written when the stored settings were read, so they are never lost)
  if (read && !cache.firstOpen) {
    cache = { ...cache, firstOpen: new Date().toISOString() };
    await AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => undefined);
  }
  return cache;
}

export function prefsNow(): Prefs {
  return cache ?? DEFAULT_PREFS;
}

export async function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): Promise<void> {
  const next = { ...(await loadPrefs()), [key]: value };
  cache = next;
  listeners.forEach((l) => l(next));
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}

export function usePrefs(): [Prefs, <K extends keyof Prefs>(k: K, v: Prefs[K]) => void] {
  const [p, setP] = useState<Prefs>(prefsNow());
  useEffect(() => {
    listeners.add(setP);
    loadPrefs().then(setP);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  const set = useCallback(<K extends keyof Prefs>(k: K, v: Prefs[K]) => void setPref(k, v), []);
  return [p, set];
}

// The Monday drop, once per new week (lib/elite/experience.ts dropDue).
export async function seenWeek(playerId: string): Promise<number | null> {
  return parseSeenWeek(await AsyncStorage.getItem(dropSeenKey(playerId)).catch(() => null));
}
export async function markWeekSeen(playerId: string, week: number): Promise<void> {
  await AsyncStorage.setItem(dropSeenKey(playerId), String(week)).catch(() => undefined);
}
