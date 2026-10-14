// Bi-weekly progress video (offer stack item 7, Oct 13 2026). Every second
// week the player films the SAME drill, the parent gets the link by text,
// and the coach can post it in the community once the family said yes.
// The pure rules live here; storage paths in lib/elite/clips.ts.
import type { Homework, ProgressVideo } from "./types";
import { isSkillTitle } from "./bank-conform";

// The one drill everybody films unless the coach picks another for a
// player (Coach Yinka, Oct 14 2026: "the same drill... freestyle
// dribbling drill"). Looked up in the bank by title; must be filmed.
export const DEFAULT_BENCHMARK_TITLE = "8-cone freestyle";

// Week 1 (the first clip, filmed on day one so there is a starting
// point), then every second week: 2, 4, 6... Two weeks after the first
// clip the family watches the two side by side.
export function isProgressVideoWeek(week: number): boolean {
  return week === 1 || (week >= 2 && week % 2 === 0);
}

export function isFirstClipWeek(week: number): boolean {
  return week === 1;
}

// Due this week: it is a progress week and no video exists for it yet.
export function progressVideoDue(week: number, videos: Pick<ProgressVideo, "week">[]): boolean {
  return isProgressVideoWeek(week) && !videos.some((v) => v.week === week);
}

export type Benchmark = { drill_id: string | null; title: string; video_url: string | null };

// The drill the player films when the coach has not picked one: the
// first SKILL drill they ever completed. History never changes, so the
// same drill comes up every time.
export function fallbackBenchmark(homework: Homework[]): Benchmark | null {
  const done = homework
    .filter((h) => h.completed && h.completed_at && isSkillTitle(h.title))
    .sort((a, b) => (a.completed_at as string).localeCompare(b.completed_at as string));
  const first = done[0];
  if (!first) return null;
  return { drill_id: first.drill_id ?? null, title: first.title, video_url: first.video_url };
}

// The video from the previous progress week, for the "two weeks ago" line.
export function previousProgressVideo<T extends Pick<ProgressVideo, "week">>(week: number, videos: T[]): T | null {
  return [...videos].filter((v) => v.week < week).sort((a, b) => b.week - a.week)[0] ?? null;
}
