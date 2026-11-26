import * as Notifications from "expo-notifications";
import { CLOCK_NUDGE, clockNudgeAt } from "@shared/training-clock";
import { FIXTURES } from "./config";
import type { Clock } from "./clock-core";
import { LOCAL_CLOCK } from "./navigation";

// "Your clock is still running": the ONE notification this phone gives
// itself (the rule and the words: lib/elite/training-clock.ts). Set when a
// training clock starts, for 1 hour 30 minutes in; taken back when the
// finish photo is taken, the clock is posted, or it is stopped. Nothing
// goes through the server, so it works with no signal at a field.
//
// It is only ever set on a phone where notifications are ALREADY allowed:
// this never asks for the permission (the app asks once, after a first
// post or a first finished session, with the reason).
//
// One identifier, so there is never more than one waiting: setting it
// again replaces it, and taking it back needs no list to search.
// A tap opens the clock (navigation.ts localRoute).
export const CLOCK_NUDGE_ID = "strive.clock.running";

export async function syncClockNudge(clock: Pick<Clock, "start" | "finish"> | null): Promise<void> {
  // the example build (screenshots, the simulator) gives no notifications
  if (FIXTURES) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(CLOCK_NUDGE_ID).catch(() => undefined);
    if (!clock || clock.finish) return;
    const allowed = (await Notifications.getPermissionsAsync()).granted === true;
    const at = clockNudgeAt({ startedMs: clock.start.atMs, finished: false, allowed, nowMs: Date.now() });
    if (at === null) return;
    await Notifications.scheduleNotificationAsync({
      identifier: CLOCK_NUDGE_ID,
      content: { title: CLOCK_NUDGE.title, body: CLOCK_NUDGE.body, data: { open: LOCAL_CLOCK } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
    });
  } catch {
    /* a notice that cannot be set changes nothing about the clock */
  }
}
