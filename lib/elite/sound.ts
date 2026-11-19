// The set timer's sounds: three short tones made on the phone itself (no
// audio files to load). Client only, best effort: a phone on silent, or a
// browser that refuses audio, simply stays quiet. Off when the player has
// switched timer sounds off on their Account page.
import { SOUND_PREF_KEY } from "./set-timer";

type Ctx = AudioContext;
let ctx: Ctx | null = null;

function enabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

// Call from a tap (the Start button): phones only let a page make sound
// once the person has touched it.
export function primeSound(): void {
  if (typeof window === "undefined") return;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  } catch {
    ctx = null;
  }
}

function tone(freq: number, startIn: number, length: number, volume: number) {
  if (!ctx) return;
  const at = ctx.currentTime + startIn;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

export type Cue = "tick" | "go" | "rest" | "done";

export function cue(kind: Cue): void {
  if (typeof window === "undefined" || !ctx || !enabled()) return;
  try {
    if (kind === "tick") tone(660, 0, 0.09, 0.18);
    else if (kind === "go") tone(990, 0, 0.32, 0.3);
    else if (kind === "rest") tone(520, 0, 0.3, 0.26);
    else {
      tone(784, 0, 0.16, 0.28);
      tone(1047, 0.17, 0.34, 0.3);
    }
  } catch {
    // sound is a nicety
  }
}
