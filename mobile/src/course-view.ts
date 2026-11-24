import type { AppCourse } from "@shared/app-contract";

// A course's clips on a phone: ONE plays at a time. A course can hold
// seventeen drills, and seventeen video players at once is a phone out of
// memory. Which one is live:
//
//   a clip the player tapped        plays, whatever the setting, until it
//                                   scrolls away or is tapped again (pause)
//   "Play drill demos automatically" on (Settings, the session player's
//                                   own switch): the top clip on screen
//   that setting off                nothing, until a clip is tapped
//
// Pure, tested in tests/logic.test.ts.

// The player's own choice: a step's id (tapped to play), null (paused by
// hand), or undefined (no choice: the setting decides).
export type Picked = string | null | undefined;

export function liveClip(i: { autoplay: boolean; picked: Picked; inView: readonly string[] }): string | null {
  if (i.picked === null) return null;
  if (typeof i.picked === "string") return i.picked;
  return i.autoplay ? i.inView[0] ?? null : null;
}

// A tap on a clip: the live one pauses, any other one plays.
export function pickedAfterTap(live: string | null, id: string): Picked {
  return live === id ? null : id;
}

// What is on screen changed: a tapped clip keeps playing while it is still
// there; anything else (it scrolled away, or it was paused by hand) hands
// the choice back to the setting.
export function pickedAfterScroll(picked: Picked, inView: readonly string[]): Picked {
  return typeof picked === "string" && inView.includes(picked) ? picked : undefined;
}

// Every step with a clip, in the course's own order.
export function clipOrder(course: Pick<AppCourse, "levels">): string[] {
  return course.levels.flatMap((l) => l.steps.filter((s) => s.video).map((s) => s.id));
}

// The clips on screen, top first: the list reports what is visible in no
// promised order, so it is put back in the course's.
export function clipsInView(order: readonly string[], visible: readonly string[]): string[] {
  const seen = new Set(visible);
  return order.filter((id) => seen.has(id));
}
