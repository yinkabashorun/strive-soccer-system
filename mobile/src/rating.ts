import Constants from "expo-constants";
import * as StoreReview from "expo-store-review";
import { FIXTURES } from "@/config";
import { loadPrefs, setPref } from "@/prefs";
import { storedClock } from "@/clock";
import { ratingDue, ratingVersion, type RatingMoment } from "@/rating-ask";

// Asks for an App Store rating at one of the good moments, by the rule in
// src/rating-ask.ts. The ask is Apple's own sheet (expo-store-review). It is
// recorded as asked whether or not Apple showed the sheet: Apple decides
// that, and never tells us. Nothing here can throw into a screen.

// A session screen is open (src: app/session/[n].tsx sets this).
let sessionOpen = false;
export function setSessionOpen(open: boolean): void {
  sessionOpen = open;
}

export async function askForRating(moment: RatingMoment): Promise<void> {
  try {
    const prefs = await loadPrefs();
    const version = ratingVersion(Constants.expoConfig?.version, Constants.expoConfig?.ios?.buildNumber);
    // a clock stored on the phone is running or waiting to be posted
    const clock = await storedClock().catch(() => null);
    const due = ratingDue({
      moment,
      version,
      askedVersion: prefs.ratingAsked,
      firstOpen: prefs.firstOpen,
      nowMs: Date.now(),
      inSession: sessionOpen,
      clockRunning: clock !== null,
      fixtures: FIXTURES,
    });
    if (!due || !version) return;
    if (!(await StoreReview.isAvailableAsync())) return;
    await setPref("ratingAsked", version);
    await StoreReview.requestReview();
  } catch {
    // never in the way of the screen it was asked from
  }
}
