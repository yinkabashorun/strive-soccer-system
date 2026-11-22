// MY DRILLS (Nov 22 2026), the free app's own, completely optional.
//
// A player names a drill themselves ("Weak foot juggles", "Rabona") and
// films TAKES of it whenever they want: short videos, up to 20 seconds.
// Two ways to see the change, both from the same takes:
//   - THEN AND NOW: two takes side by side. By default the starting take
//     beside the latest; the player can tap any two instead.
//   - THE PROGRESS REEL: every take in order, about 3 seconds each, dated
//     from the starting take ("Day 1", "Week 3"), ending on the latest held
//     longer. Past 8 takes it uses 8, spread evenly, always the first and
//     the latest, so it works for 2 takes or 200.
// Both can be shared as one vertical video made ON THE PHONE (canvas and
// MediaRecorder, lib/elite/duet-client.ts). Nothing is posted by us.
//
// Takes are PRIVATE: only the player (and the coaches) can play them,
// through short-lived signed addresses. They are never in the friends feed
// and never on anyone's profile. They live in the player's own folder of
// the free app's private photo bucket (069), so deleting the account takes
// them with everything else (removeTrackerFiles).
//
// The pure rules, held by tests/my-drills.test.ts. The numbers are
// defaults Coach Yinka may change; the database holds the caps too (078).

export const DRILL_NAME_MAX = 40;
export const DRILLS_PER_PLAYER = 20;
export const TAKES_PER_DRILL = 50;
export const TAKE_SECONDS = 20;
export const TAKE_SLACK_SECONDS = 1.5; // the phone's own rounding
export const TAKE_MAX_MB = 60;
export const COUNT_MIN = 0;
export const COUNT_MAX = 999;

export const FREE_DRILLS = "/log/drills";
export const drillHref = (id: string) => `${FREE_DRILLS}/${id}`;

// The small line under the drill chips on the posting screen.
export const VIDEO_PRIVATE_LINE =
  "Videos stay in your drills, only for you. The friends feed shows photos only.";

export const DRILL_CAP_MESSAGE = `You have ${DRILLS_PER_PLAYER} drills. Delete one to make another.`;
export const TAKE_CAP_MESSAGE = `This drill has ${TAKES_PER_DRILL} takes. Delete an old take to film a new one.`;
export const TAKE_TOO_LONG = `A take is up to ${TAKE_SECONDS} seconds. Film it again a little shorter.`;

// ---- Naming: lib/elite/my-drills-name.ts (the word filter stays on the server)

// The optional count on a take: a whole number 0 to 999, null when left
// empty, undefined when it is not a count (refused, never guessed).
export function cleanCount(v: unknown): number | null | undefined {
  if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
  const n = typeof v === "string" ? Number(v.trim()) : v;
  if (typeof n !== "number" || !Number.isInteger(n)) return undefined;
  return n >= COUNT_MIN && n <= COUNT_MAX ? n : undefined;
}

// A take is 20 seconds at most. A length the phone could not read is let
// through (refusing a real take is worse; the server cannot read it).
export function takeLengthOk(seconds: number): boolean {
  if (!Number.isFinite(seconds)) return true;
  return seconds <= TAKE_SECONDS + TAKE_SLACK_SECONDS;
}

export function canAddDrill(drillCount: number): boolean {
  return drillCount < DRILLS_PER_PLAYER;
}
export function canAddTake(takeCount: number): boolean {
  return takeCount < TAKES_PER_DRILL;
}

// ---- Takes -----------------------------------------------------------

export type Take = {
  id: string;
  created_at: string;
  count: number | null;
  seconds?: number | null;
  url?: string | null; // short-lived signed address, for the owner only
};

export type MyDrill = {
  id: string;
  name: string;
  start_take_id: string | null;
  takes: number;
  first_at: string | null;
  latest_at: string | null;
};

const at = (t: Pick<Take, "created_at">) => new Date(t.created_at).getTime() || 0;

export function byDate<T extends Take>(takes: T[]): T[] {
  return [...takes].sort((a, b) => at(a) - at(b) || a.id.localeCompare(b.id));
}

// The starting take: the one the player set, else the first one filmed.
export function startTake<T extends Take>(takes: T[], startId: string | null | undefined): T | null {
  if (takes.length === 0) return null;
  return takes.find((t) => t.id === startId) ?? byDate(takes)[0];
}

// The newest take, or null.
export function latestTake<T extends Take>(takes: T[]): T | null {
  const sorted = byDate(takes);
  return sorted[sorted.length - 1] ?? null;
}

// Then and now by default: the starting take beside the latest. Null until
// there are two takes to put side by side.
export function defaultPair<T extends Take>(takes: T[], startId: string | null | undefined): [T, T] | null {
  const start = startTake(takes, startId);
  if (!start) return null;
  const others = byDate(takes).filter((t) => t.id !== start.id);
  const latest = others[others.length - 1];
  if (!latest) return null;
  return at(latest) >= at(start) ? [start, latest] : [latest, start];
}

// Any two takes the player tapped, the earlier one first. Null when the
// two are the same take or either is missing.
export function pickTwo<T extends Take>(takes: T[], a: string, b: string): [T, T] | null {
  if (a === b) return null;
  const x = takes.find((t) => t.id === a);
  const y = takes.find((t) => t.id === b);
  if (!x || !y) return null;
  return at(x) <= at(y) ? [x, y] : [y, x];
}

// "43 → 58" when both takes carry a count, else null.
export function countChange(a: Pick<Take, "count">, b: Pick<Take, "count">): string | null {
  return a.count !== null && b.count !== null ? `${a.count} → ${b.count}` : null;
}

// ---- Dates -----------------------------------------------------------

const NY = "America/New_York";
export function nyDate(iso: string): string {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? "" : t.toLocaleDateString("en-CA", { timeZone: NY });
}

function dayDiff(fromIso: string, toIso: string): number {
  const a = new Date(nyDate(fromIso) + "T00:00:00Z").getTime();
  const b = new Date(nyDate(toIso) + "T00:00:00Z").getTime();
  return Math.round((b - a) / 864e5);
}

// "Day 1" on the starting take's day, "Day 2" to "Day 7" in its first week,
// then "Week 2", "Week 3" and on. A take from before the start has no label.
export function takeLabel(take: Pick<Take, "created_at">, start: Pick<Take, "created_at">): string | null {
  const d = dayDiff(start.created_at, take.created_at);
  if (!Number.isFinite(d) || d < 0) return null;
  if (d < 7) return `Day ${d + 1}`;
  return `Week ${Math.floor(d / 7) + 1}`;
}

// "Nov 22", under each take.
export function shortDate(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: NY });
}

// ---- The progress reel ------------------------------------------------

export const REEL_MAX_TAKES = 8;
export const REEL_TAKE_SECONDS = 3;
export const REEL_LAST_SECONDS = 6; // the latest take, held longer

// The takes the reel plays: from the starting take to the latest, in
// order. With more than 8, 8 of them spread evenly, always the first and
// the latest.
export function reelTakes<T extends Take>(takes: T[], startId: string | null | undefined): T[] {
  const start = startTake(takes, startId);
  if (!start) return [];
  const run = byDate(takes).filter((t) => at(t) >= at(start));
  if (run.length <= REEL_MAX_TAKES) return run;
  const out: T[] = [];
  for (let i = 0; i < REEL_MAX_TAKES; i++) {
    const idx = Math.round((i * (run.length - 1)) / (REEL_MAX_TAKES - 1));
    if (out[out.length - 1] !== run[idx]) out.push(run[idx]);
  }
  return out;
}

// How long each take plays in the reel: about 3 seconds each, the latest
// held longer, never longer than the take itself (a length the phone could
// not read takes the full slot).
export function reelSeconds(durations: number[]): number[] {
  return durations.map((d, i) => {
    const slot = i === durations.length - 1 ? REEL_LAST_SECONDS : REEL_TAKE_SECONDS;
    return Number.isFinite(d) && d > 0 ? Math.min(slot, d) : slot;
  });
}

// ---- The shared video ------------------------------------------------

export const COMPOSITE = { width: 1080, height: 1920, half: 960, fps: 30 } as const;
export const MARK = "STRIVE";

export type Rect = { x: number; y: number; w: number; h: number };

// The middle of a source frame at the target's shape: fills the box
// without stretching.
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): Rect {
  if (!(srcW > 0 && srcH > 0 && dstW > 0 && dstH > 0)) return { x: 0, y: 0, w: Math.max(0, srcW), h: Math.max(0, srcH) };
  const target = dstW / dstH;
  if (srcW / srcH > target) {
    const w = srcH * target;
    return { x: (srcW - w) / 2, y: 0, w, h: srcH };
  }
  const h = srcW / target;
  return { x: 0, y: (srcH - h) / 2, w: srcW, h };
}

export type Size = { width: number; height: number };
const PAD = 48;

// Then and now: the earlier take on top, the later below, each 1080 x 960,
// the date label at the bottom left of each half, the mark and the drill's
// name at the top.
export function duetLayout(top: Size, bottom: Size) {
  const { width, half } = COMPOSITE;
  return {
    canvas: { width, height: COMPOSITE.height },
    halves: [
      { dst: { x: 0, y: 0, w: width, h: half }, src: coverCrop(top.width, top.height, width, half), label: { x: PAD, y: half - PAD } },
      {
        dst: { x: 0, y: half, w: width, h: half },
        src: coverCrop(bottom.width, bottom.height, width, half),
        label: { x: PAD, y: 2 * half - PAD },
      },
    ],
    mark: { x: width - PAD, y: PAD + 34 },
    name: { x: PAD, y: PAD + 34 },
  };
}

// One take of the reel, full frame, its label at the bottom left.
export function reelLayout(src: Size) {
  const { width, height } = COMPOSITE;
  return {
    canvas: { width, height },
    dst: { x: 0, y: 0, w: width, h: height },
    src: coverCrop(src.width, src.height, width, height),
    label: { x: PAD, y: height - PAD * 3 },
    mark: { x: width - PAD, y: PAD + 34 },
    name: { x: PAD, y: PAD + 34 },
  };
}

// The duet runs as long as the longer take; never past the 20 s cap.
export function duetSeconds(a: number, b: number): number {
  const longest = Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);
  return Math.min(TAKE_SECONDS, longest > 0 ? longest : TAKE_SECONDS);
}

// The recording format this phone can make: MP4 first (iPhone Safari),
// WebM elsewhere, or null.
export const RECORDER_TYPES = [
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

export function pickRecorderType(
  isTypeSupported: ((t: string) => boolean) | null | undefined
): { mime: string; ext: "mp4" | "webm" } | null {
  if (typeof isTypeSupported !== "function") return null;
  for (const t of RECORDER_TYPES) {
    let ok = false;
    try {
      ok = isTypeSupported(t);
    } catch {
      ok = false;
    }
    if (ok) return { mime: t, ext: t.startsWith("video/mp4") ? "mp4" : "webm" };
  }
  return null;
}

// Share is drawn only where the phone can make the video: a recorder that
// knows a video type, and a canvas that can be filmed.
export function canComposeVideo(env: {
  MediaRecorder?: { isTypeSupported?: (t: string) => boolean } | null;
  canvasCaptureStream: boolean;
}): boolean {
  if (!env.MediaRecorder || !env.canvasCaptureStream) return false;
  return pickRecorderType(env.MediaRecorder.isTypeSupported?.bind(env.MediaRecorder)) !== null;
}

export function shareFileName(kind: "then-and-now" | "progress-reel", drillName: string, ext: string): string {
  const slug = drillName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${kind}-${slug || "drill"}.${ext}`;
}

// ---- Where takes are kept ----------------------------------------------

// <profile id>/take-<take id>.<ext>, flat in the player's own folder of the
// free app's private photo bucket, beside their photos. The storage policy in
// 078 lets a player write only this shape into their own folder.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const TAKE_EXTENSIONS = ["mp4", "mov", "webm", "m4v"] as const;

export function takeExtension(fileName: string, mime = ""): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if ((TAKE_EXTENSIONS as readonly string[]).includes(ext)) return ext;
  if (/quicktime/.test(mime)) return "mov";
  if (/webm/.test(mime)) return "webm";
  return "mp4";
}

export function takePath(profileId: string, takeId: string, ext: string): string | null {
  const e = ext.toLowerCase();
  if (!UUID.test(profileId) || !UUID.test(takeId)) return null;
  if (!(TAKE_EXTENSIONS as readonly string[]).includes(e)) return null;
  return `${profileId}/take-${takeId}.${e}`;
}

export function ownsTakePath(path: string, profileId: string, takeId?: string): boolean {
  const [folder, file, ...more] = path.split("/");
  const m = /^take-([0-9a-f-]{36})\.(mp4|mov|webm|m4v)$/.exec(file ?? "");
  if (more.length !== 0 || folder !== profileId || !UUID.test(folder) || !m || !UUID.test(m[1])) return false;
  return takeId === undefined || m[1] === takeId;
}

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}
