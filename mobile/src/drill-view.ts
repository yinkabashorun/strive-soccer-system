import { parseReps } from "@shared/set-timer";
import { drillMinutes } from "@shared/session-flow";

// The two tiles under a drill's name in the session player (approved mock
// v4, screen 2): the sets and the rest, read from the coach's own words by
// the set timer's rules. When the words cannot be read that way they are
// shown exactly as written, in one tile. Pure, tests/drill-view.test.ts.
export type Tile = { big: string; small: string };

function span(sec: number): string {
  if (sec % 60 === 0) return `${sec / 60} min`;
  if (sec > 60) return `${Math.floor(sec / 60)} min ${sec % 60} sec`;
  return `${sec} sec`;
}

export function repsTiles(reps: string, minutes?: number): Tile[] {
  const plan = parseReps(reps);
  if (!plan) {
    const words = reps.trim();
    const tiles: Tile[] = [];
    if (words) tiles.push({ big: words, small: "the work" });
    if (minutes) tiles.push({ big: `${minutes} min`, small: "about" });
    return tiles;
  }
  const work = plan.workSec !== null ? span(plan.workSec) : null;
  const counted = reps.match(/^\s*\d+\s*(?:x|sets? of)\s*([\d.]+\s*[a-z]+(?:\s+each\s+\w+)?)/i)?.[1]?.trim() ?? null;
  const sets: Tile = {
    big: plan.sets === 1 && work ? work : `${plan.sets} × ${work ?? counted ?? "set"}`,
    small: plan.sets === 1 ? "one set" : "sets",
  };
  const tiles = [sets];
  if (plan.restSec !== null) tiles.push({ big: span(plan.restSec), small: "rest between" });
  return tiles;
}

// "Drill 2 of 4" over a drill: warm-ups and finishers are named for what
// they are, skill drills are counted among the session's skill drills.
export function drillEyebrow(kind: "warmup" | "finisher" | "skill", skillIndex: number, skillCount: number): string {
  if (kind === "warmup") return "Warm-up";
  if (kind === "finisher") return "Finisher";
  return `Drill ${skillIndex + 1} of ${skillCount}`;
}

export { drillMinutes };
