import * as Haptics from "expo-haptics";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { hapticFor, type Moment } from "@shared/session-flow";
import { prefsNow } from "./prefs";

// The felt and heard side of the app, one ladder shared with the website
// (lib/elite/session-flow.ts hapticFor): a light tap for a drill done, the
// success notification for a session, two beats for a week. A choice in the
// quiz or a tab of the count-in gets the lightest selection tick. Nothing on
// scrolling, navigation or undo. Off when this phone switched vibration off.

const IMPACT: Record<string, Haptics.ImpactFeedbackStyle> = {
  LIGHT: Haptics.ImpactFeedbackStyle.Light,
  MEDIUM: Haptics.ImpactFeedbackStyle.Medium,
  HEAVY: Haptics.ImpactFeedbackStyle.Heavy,
};
const NOTE: Record<string, Haptics.NotificationFeedbackType> = {
  SUCCESS: Haptics.NotificationFeedbackType.Success,
  WARNING: Haptics.NotificationFeedbackType.Warning,
  ERROR: Haptics.NotificationFeedbackType.Error,
};

export function feel(moment: Moment): void {
  if (!prefsNow().vibration) return;
  let wait = 0;
  for (const step of hapticFor(moment).native) {
    wait += step.after ?? 0;
    const run = () => {
      if (step.method === "impact") void Haptics.impactAsync(IMPACT[step.options.style] ?? Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      else void Haptics.notificationAsync(NOTE[step.options.type] ?? Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    };
    if (wait > 0) setTimeout(run, wait);
    else run();
  }
}

export function tick(): void {
  if (!prefsNow().vibration) return;
  void Haptics.selectionAsync().catch(() => undefined);
}

// The set timer's four tones (the website's own, as files: scripts/
// make-tones.py). They mix with whatever the player is listening to and
// play even with the phone on silent, like a gym timer.
export type Cue = "tick" | "go" | "rest" | "done";
const SOURCES: Record<Cue, number> = {
  tick: require("../assets/sounds/tick.wav"),
  go: require("../assets/sounds/go.wav"),
  rest: require("../assets/sounds/rest.wav"),
  done: require("../assets/sounds/done.wav"),
};
const players: Partial<Record<Cue, AudioPlayer>> = {};
let moded = false;

export function cue(kind: Cue): void {
  if (!prefsNow().sound) return;
  try {
    if (!moded) {
      moded = true;
      void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" }).catch(() => undefined);
    }
    const p = (players[kind] ??= createAudioPlayer(SOURCES[kind]));
    p.seekTo(0);
    p.play();
  } catch {
    // a tone is a nicety
  }
}
