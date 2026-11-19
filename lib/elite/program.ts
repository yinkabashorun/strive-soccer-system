// The 3-month program (migration 065, Coach Yinka, Nov 11 2026): the
// structure he used to come back from a 6-month hip tear. Three monthly
// blocks, two focus pillars per block (one per half-month), and in every
// session the focus gets two of the three skill drills while the third
// keeps the rest alive. Threads run beside the focuses for whole months
// and never take a skill-drill slot: strength rides the finisher, speed
// rides the slot after the warm-up.
//
// Everything here is pure. The builder reads one ProgramWeek per week
// (bank-conform.ts), the coach's panel reads the menu, and the tests pin
// the rules. A player with no program builds exactly as before.

export const PROGRAM_WEEKS = 12;
export const WEEKS_PER_BLOCK = 4;
export const FOCUS_SLOTS = 6; // 3 blocks x 2 halves
export const FOCUS_DRILLS_PER_SESSION = 2; // of the three skill drills

export type ProgramPillar = { key: string; name: string };
export type ProgramCategory = {
  key: string;
  name: string;
  // focus: its pillars can be a half-month focus (skill drills).
  // thread: runs beside the focuses, never a focus.
  mode: "focus" | "thread";
  pillars: ProgramPillar[];
};

// Category and pillar names are a draft Coach Yinka approved in spirit
// ("That's amazing tbh"); the keys are what the database stores, the
// names are his to change here. Speed mirrors the levels of his own Speed
// course. Shooting and finishing are left out for now (his call, Nov 11).
export const PROGRAM_CATEGORIES: ProgramCategory[] = [
  {
    key: "ball_control",
    name: "Ball control",
    mode: "focus",
    pillars: [
      { key: "first_touch_ground", name: "First touch on the ground" },
      { key: "first_touch_air", name: "First touch out of the air" },
      { key: "weak_foot", name: "Weak foot" },
    ],
  },
  {
    key: "dribbling",
    name: "Dribbling and 1v1",
    mode: "focus",
    pillars: [
      { key: "close_control", name: "Close control" },
      { key: "one_v_one", name: "1v1 moves" },
      { key: "running_with_ball", name: "Running with the ball" },
    ],
  },
  {
    key: "passing",
    name: "Passing",
    mode: "focus",
    pillars: [
      { key: "passing_short", name: "Short and combination passing" },
      { key: "passing_long", name: "Long and driven passing" },
      { key: "passing_air", name: "Passing in the air" },
    ],
  },
  {
    key: "speed",
    name: "Speed and agility",
    mode: "focus",
    pillars: [
      { key: "speed_technique", name: "Sprint technique" },
      { key: "acceleration", name: "Acceleration" },
      { key: "top_speed", name: "Top speed" },
      { key: "explosiveness", name: "Explosiveness" },
    ],
  },
  {
    key: "game_intelligence",
    name: "Game intelligence",
    mode: "focus",
    pillars: [
      { key: "scanning", name: "Scanning" },
      { key: "decision_making", name: "Decision making" },
    ],
  },
  {
    key: "strength",
    name: "Strength and power",
    mode: "thread",
    pillars: [],
  },
];

export const FOCUS_PILLARS: ProgramPillar[] = PROGRAM_CATEGORIES.filter((c) => c.mode === "focus").flatMap(
  (c) => c.pillars
);
export const FOCUS_PILLAR_KEYS: string[] = FOCUS_PILLARS.map((p) => p.key);
export const SPEED_PILLAR_KEYS: string[] =
  PROGRAM_CATEGORIES.find((c) => c.key === "speed")?.pillars.map((p) => p.key) ?? [];

export function isFocusPillar(key: unknown): key is string {
  return typeof key === "string" && FOCUS_PILLAR_KEYS.includes(key);
}

export function pillarName(key: string | null | undefined): string {
  return FOCUS_PILLARS.find((p) => p.key === key)?.name ?? "";
}

export const THREAD_KINDS = ["strength", "speed"] as const;
export type ThreadKind = (typeof THREAD_KINDS)[number];
export type ProgramThread = { kind: ThreadKind; from_block: number; to_block: number };

export const THREAD_NAMES: Record<ThreadKind, string> = {
  strength: "Strength (the finisher, every session)",
  speed: "Speed (after the warm-up, every session)",
};

// What Coach Yinka answers about the player before the three months are
// drafted. Free text is his words; limiters are ranked focus pillars.
export type ProgramQuiz = {
  target?: string; // the date or moment that matters (tryout, preseason, return)
  injury?: string; // area, what they are cleared for, what they wait on
  cleared_to_run?: boolean;
  limiters?: string[]; // focus pillar keys, most limiting first
  goal?: string; // what they want to be known for in three months
  notes?: string;
};

export type Program = {
  id: string;
  player_id: string;
  start_week: number; // the player's week number where block 1 begins
  weeks: number;
  status: "active" | "ended";
  focuses: string[]; // six pillar keys: block 1 half 1, block 1 half 2, ...
  threads: ProgramThread[];
  quiz: ProgramQuiz;
  created_at?: string;
};

// The one thing the builder needs to know about a week.
export type ProgramWeek = {
  index: number; // 0-based week of the program
  block: 1 | 2 | 3;
  half: 1 | 2;
  weekInHalf: 1 | 2; // the second week of a focus is the harder one
  focus: string; // pillar key
  focusName: string;
  strength: boolean; // strength thread on this month
  speed: boolean; // speed thread on this month
};

type ProgramShape = Pick<Program, "start_week" | "weeks" | "status" | "focuses" | "threads">;

// Program weeks follow the player's own week numbers, so a break moves
// the program with the player (pick up where you left off, 034).
export function programWeekFor(program: ProgramShape | null | undefined, week: number): ProgramWeek | null {
  if (!program || program.status !== "active") return null;
  const index = week - program.start_week;
  if (!Number.isInteger(index) || index < 0 || index >= program.weeks) return null;
  const block = (Math.floor(index / WEEKS_PER_BLOCK) + 1) as 1 | 2 | 3;
  const inBlock = index % WEEKS_PER_BLOCK;
  const half = (inBlock < 2 ? 1 : 2) as 1 | 2;
  const focus = program.focuses[(block - 1) * 2 + (half - 1)];
  if (!isFocusPillar(focus)) return null;
  const on = (kind: ThreadKind) =>
    (program.threads ?? []).some((t) => t.kind === kind && t.from_block <= block && block <= t.to_block);
  return {
    index,
    block,
    half,
    weekInHalf: ((inBlock % 2) + 1) as 1 | 2,
    focus,
    focusName: pillarName(focus),
    strength: on("strength"),
    speed: on("speed"),
  };
}

// Six clean focus keys or null. Anything else never reaches the table.
export function cleanFocuses(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length !== FOCUS_SLOTS) return null;
  return input.every(isFocusPillar) ? (input as string[]) : null;
}

export function cleanThreads(input: unknown): ProgramThread[] {
  if (!Array.isArray(input)) return [];
  const out: ProgramThread[] = [];
  for (const raw of input) {
    const t = raw as Partial<ProgramThread> | null;
    if (!t || !(THREAD_KINDS as readonly string[]).includes(String(t.kind))) continue;
    const from = Number(t.from_block);
    const to = Number(t.to_block);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 3 || from > to) continue;
    if (out.some((o) => o.kind === t.kind)) continue; // one span per kind
    out.push({ kind: t.kind as ThreadKind, from_block: from, to_block: to });
  }
  return out;
}

export function cleanQuiz(input: unknown): ProgramQuiz {
  const q = (input ?? {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return {
    target: text(q.target, 200),
    injury: text(q.injury, 400),
    cleared_to_run: q.cleared_to_run !== false,
    limiters: Array.isArray(q.limiters) ? q.limiters.filter(isFocusPillar).slice(0, FOCUS_SLOTS) : [],
    goal: text(q.goal, 300),
    notes: text(q.notes, 600),
  };
}

// The quiz's draft of the six focuses: the ranked limiters in order, the
// biggest first. Fewer than six repeat in the same order, so three
// limiters each get a full month across the program. A player not yet
// cleared to run gets every speed pillar moved to the end (his own
// comeback: the ball first, speed once he could sprint). Only pillars
// with drills this player can do are drafted; the coach edits the rest.
export function draftFocuses(limiters: string[], clearedToRun: boolean, available: string[]): string[] {
  const ok = new Set(available.filter(isFocusPillar));
  let ranked = [...new Set(limiters.filter((k) => ok.has(k)))];
  if (ranked.length === 0) ranked = FOCUS_PILLAR_KEYS.filter((k) => ok.has(k));
  if (ranked.length === 0) return [];
  if (!clearedToRun) {
    const isSpeed = (k: string) => SPEED_PILLAR_KEYS.includes(k);
    ranked = [...ranked.filter((k) => !isSpeed(k)), ...ranked.filter(isSpeed)];
  }
  const out: string[] = [];
  for (let i = 0; out.length < FOCUS_SLOTS; i++) out.push(ranked[i % ranked.length]);
  if (!clearedToRun) {
    // Repeats must not pull a speed pillar back into the first two months.
    const nonSpeed = ranked.filter((k) => !SPEED_PILLAR_KEYS.includes(k));
    if (nonSpeed.length) {
      for (let i = 0; i < 4; i++) if (SPEED_PILLAR_KEYS.includes(out[i])) out[i] = nonSpeed[i % nonSpeed.length];
    }
  }
  return out;
}

// "Month 1, weeks 1 and 2" for the coach's strip.
export function slotLabel(slot: number): string {
  const block = Math.floor(slot / 2) + 1;
  const first = slot * 2 + 1;
  return `Month ${block}, weeks ${first} and ${first + 1}`;
}

// A drill's level: 1 easier, 2 standard, 3 harder. Unset reads as 2.
export function levelOf(d: { level?: number | null }): number {
  return d.level === 1 || d.level === 3 ? d.level : 2;
}
