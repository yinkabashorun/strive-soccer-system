import { useEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImageManipulator from "expo-image-manipulator";
import { APP_API } from "@shared/app-contract";
import { POST_REFUSED_PHOTO, fitWithin, type Kind } from "@shared/tracker";
import { CLOCK_PHOTO_MAX_BYTES, CLOCK_PHOTO_STEPS, CLOCK_WORDS } from "@shared/training-clock";
import { base64ToBytes, filesForm } from "@shared/upload-body";
import { ApiError, api } from "./api/client";
import { useMe } from "./api/queries";
import { FIXTURES } from "./config";
import type { PickedPhoto } from "./post-api";
import { START_TELL_AT_MS, clockFields, clockView, parseClock, refusalIsFinal, startWorthTelling, type Clock, type ClockView, type Shot } from "./clock-core";

// THE TRAINING CLOCK, kept on this phone (clock-core.ts says what a clock
// is; lib/elite/training-clock.ts has the rules).
//
// The clock is written to the phone's storage the moment the start photo
// is taken and again at the finish photo. Nothing about it needs a signal:
// a field with no bars, the app swiped away, the phone restarting. The one
// call that does go out at the start is a short "a clock started" with no
// photo (tellStart): when it lands, the server can time the session with
// its own clock. When it cannot land, the clock still counts.
//
// It is cleared when it is posted, stopped, or the account signs out
// (src/account.ts).
export const CLOCK_KEY = "strive.clock.v1";

// The example build (screenshots, the simulator) opens its clock already
// 45 minutes in, so the pictures show a real session (the example post in
// src/api/fixtures.ts is 45 minutes too). Never a real build.
const EXAMPLE_HEAD_START_MS = 45 * 60_000 + 7_000;

let clock: Clock | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const timers = new Set<ReturnType<typeof setTimeout>>();

function emit() {
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
async function keep(next: Clock | null): Promise<void> {
  clock = next;
  emit();
  try {
    if (next) await AsyncStorage.setItem(CLOCK_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(CLOCK_KEY);
  } catch {
    /* the clock is still in memory for this run of the app */
  }
}

export async function loadClock(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const stored = parseClock(await AsyncStorage.getItem(CLOCK_KEY).catch(() => null));
  // a clock started before the stored one was read is the newer one
  if (!clock && stored) {
    clock = stored;
    emit();
  }
  planTelling();
}

// Signing out leaves nothing of the account on this phone.
export async function clearClockStore(): Promise<void> {
  for (const t of timers) clearTimeout(t);
  timers.clear();
  await keep(null);
}

// ---- reading it ----------------------------------------------------------

// The signed-in account's own clock, or null.
export function useClock(): Clock | null {
  const owner = useMe().data?.viewer.email?.toLowerCase() ?? null;
  const c = useSyncExternalStore(subscribe, () => clock, () => clock);
  useEffect(() => {
    void loadClock();
  }, []);
  return c && owner && c.owner === owner ? c : null;
}

// The clock and where it stands, ticking once a second while it counts.
export function useClockView(): { clock: Clock | null; view: ClockView } {
  const c = useClock();
  const counting = Boolean(c && !c.finish);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!counting) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    // a phone that was asleep comes back with the right time at once
    const sub = AppState.addEventListener("change", (s) => s === "active" && setNow(Date.now()));
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [counting]);
  return { clock: c, view: clockView(c, now) };
}

// ---- the photos -----------------------------------------------------------

// A photo made small enough that two of them travel in one request.
async function shrink(photo: PickedPhoto): Promise<Pick<Shot, "b64" | "uri">> {
  // the example build sends nothing anywhere: the picked photo is shown, not read
  if (FIXTURES) return { b64: null, uri: photo.uri };
  for (const step of CLOCK_PHOTO_STEPS) {
    const out = await ImageManipulator.manipulateAsync(photo.uri, [{ resize: fitWithin(photo.width, photo.height, step.edge) }], {
      compress: step.compress,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (!out.base64) break;
    // base64 is four letters for every three bytes
    if ((out.base64.length * 3) / 4 <= CLOCK_PHOTO_MAX_BYTES) return { b64: out.base64, uri: null };
  }
  throw new ApiError(0, "photo", POST_REFUSED_PHOTO);
}

// ---- the three moves ------------------------------------------------------

// The start photo was taken: the clock starts THEN, not when the photo has
// been made ready.
export async function startClock(owner: string, photo: PickedPhoto): Promise<void> {
  const atMs = Date.now() - (FIXTURES ? EXAMPLE_HEAD_START_MS : 0);
  const made = await shrink(photo);
  await keep({ owner: owner.toLowerCase(), start: { atMs, ...made }, finish: null, heard: false });
  planTelling();
}

// The finish photo was taken: the clock stops THEN.
export async function finishClock(photo: PickedPhoto): Promise<void> {
  const atMs = Date.now();
  if (!clock || clock.finish) return;
  const started = clock.start.atMs;
  const made = await shrink(photo);
  // still the same clock after the photo was made ready
  if (!clock || clock.start.atMs !== started) return;
  await keep({ ...clock, finish: { atMs, ...made } });
}

// "Take my finish photo again": the clock goes on from where it was.
export async function retakeFinish(): Promise<void> {
  if (clock?.finish) await keep({ ...clock, finish: null });
}

// Stopped without posting. Nothing is added anywhere.
export async function stopClock(): Promise<void> {
  if (!clock) return;
  await clearClockStore();
  void api(APP_API.freeClock, { method: "DELETE" }).catch(() => undefined);
}

export type ClockSent =
  | { ok: true; minutes: number }
  // `final`: sending again will never change the answer, so the clock is gone
  | { ok: false; final: boolean; reason: string | null; message: string };

// Post it: both photos and the phone's times in one request. The server
// works out how long it counts. With no signal the clock stays exactly as
// it is, and the same button sends it later.
export async function sendClock(kind: Kind, caption: string): Promise<ClockSent> {
  const c = clock;
  const fields = c ? clockFields(c, Date.now(), kind, caption) : null;
  if (!c || !c.finish || !fields) return { ok: false, final: true, reason: null, message: "There is no training to post." };
  const bytes = (s: Shot) => (s.b64 ? base64ToBytes(s.b64) : new Uint8Array(0));
  const upload = filesForm(fields, [
    { field: "start", fileName: "start.jpg", type: "image/jpeg", bytes: bytes(c.start) },
    { field: "finish", fileName: "finish.jpg", type: "image/jpeg", bytes: bytes(c.finish) },
  ]);
  try {
    const res = await api<{ ok: boolean; minutes?: number; error?: string; reason?: string }>(APP_API.freeClockFinish, { method: "POST", upload, timeoutMs: 120_000 });
    if (!res.ok) {
      const final = refusalIsFinal(res.reason);
      if (final) await clearClockStore();
      return { ok: false, final, reason: res.reason ?? null, message: res.error ?? "Your training was not saved. Try again." };
    }
    await clearClockStore();
    return { ok: true, minutes: res.minutes ?? 0 };
  } catch (e) {
    if (e instanceof ApiError) {
      const reason = typeof e.data?.reason === "string" ? e.data.reason : null;
      const final = refusalIsFinal(reason);
      if (final) await clearClockStore();
      // no signal: say that it is safe on the phone, not just that it failed
      return { ok: false, final, reason, message: e.status === 0 && e.code === "offline" ? CLOCK_WORDS.kept : e.message };
    }
    return { ok: false, final: false, reason: null, message: CLOCK_WORDS.kept };
  }
}

// ---- telling the server the clock started ---------------------------------

let telling = false;

async function tellStart(): Promise<void> {
  const c = clock;
  if (telling || !startWorthTelling(c, Date.now()) || !c) return;
  telling = true;
  try {
    const ago = Math.max(0, Math.round((Date.now() - c.start.atMs) / 1000));
    const res = await api<{ ok: boolean }>(APP_API.freeClock, { method: "POST", body: { started: c.start.atMs, ago }, timeoutMs: 8_000 });
    if (res.ok && clock && clock.start.atMs === c.start.atMs) await keep({ ...clock, heard: true });
  } catch {
    /* tried again on the next step, while it can still arrive live */
  } finally {
    telling = false;
  }
}

function planTelling() {
  for (const t of timers) clearTimeout(t);
  timers.clear();
  const c = clock;
  if (!startWorthTelling(c, Date.now()) || !c) return;
  for (const at of START_TELL_AT_MS) {
    const wait = c.start.atMs + at - Date.now();
    if (wait < -500) continue;
    const t = setTimeout(() => {
      timers.delete(t);
      void tellStart();
    }, Math.max(0, wait));
    timers.add(t);
  }
}

// the app came back to the front inside the live window: try at once
AppState.addEventListener("change", (s) => {
  if (s === "active") void tellStart();
});
