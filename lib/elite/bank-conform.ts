// Bank conformance - the one rule that makes "only assign drills from the
// drill bank" actually true.
//
// Everything upstream of this is advisory: the AI is SHOWN the bank and
// TOLD to compose from it, the deterministic fallback reads from it, the
// plyo helper prefers it. None of that stops a drill that isn't in the
// bank from reaching a player - an AI paraphrase, a built-in pad like
// "Apply under pressure", a library plyo like "Pogo & Tuck", a title the
// coach typed into the studio by hand. Real players got exactly those
// (Oct 1 2026: a player's week had two filmed drills and six that weren't
// bank drills at all).
//
// This module runs on the OUTPUT instead: every drill in a plan is either
// matched to a bank drill (and takes its exact title, so the publish-time
// id link always hits) or replaced by a bank drill of the right pillar.
// It is called in sanitize() for every generated plan AND again at publish
// time, so a hand-edited plan can't bypass it either. With no bank at all
// (demo / pre-020) it leaves the plan alone.

import type { Drill, GeneratedDrill, GeneratedSession, Player } from "./types";
import { PLYO_PILLAR, STRENGTH_PILLAR } from "./types";

const MIN_SKILLS = 3;

// Strengthening finishers (bank pillar "Strengthening"): "required" puts
// exactly one at the end of EVERY session; "optional" keeps the ones the
// AI placed (capped at one per session, moved last) and adds none.
export type StrengthMode = "required" | "optional";

// The player needs strengthening work this week when the coach's note,
// the call notes, or the player's own check-in say so. Deliberately
// specific: "back" alone would fire on "back on track".
const STRENGTH_SIGNALS =
  /injur|rehab|prehab|prevention|\bcore\b|hip flexor|\bhips?\b|lower back|low back|back (pain|issue|problem|injur|strain)|\bstrength(en|ening)?\b|groin|hamstring|\bquads?\b|\bknees?\b|\bankles?\b|physio|physical therap|\bpt\b|cleared to|return(ing)? (from|to play)/i;

export function strengthRequired(text: string | null | undefined): boolean {
  return STRENGTH_SIGNALS.test(text ?? "");
}

export function isSkillPillar(pillar: string): boolean {
  return pillar !== PLYO_PILLAR && pillar !== STRENGTH_PILLAR;
}

const PILLAR_HINTS: [RegExp, string][] = [
  [/weak.?foot|left foot|right foot|both feet/, "Weak Foot"],
  [/wall|pass|rebound|receiv/, "Passing"],
  [/scan|head up|shoulder|awareness|turn/, "Scanning"],
  [/decision|choice|gate|finish|composure/, "Decision Making"],
  [/confiden|1v1|feint|elastico|chop|croqueta|maradona|move|take.?on|stepover/, "Confidence"],
  [/speed|quick|fast|explos|sprint|accel|react/, "Speed"],
  [/touch|control|mastery|dribbl|cone|sole|roll|juggl/, "Ball Mastery"],
];

// A pillar with no filmed drills falls through to one that has them.
const PILLAR_FALLBACK: Record<string, string[]> = {
  Scanning: ["Ball Mastery", "Confidence"],
  "Decision Making": ["Confidence", "Ball Mastery"],
  Speed: ["Ball Mastery", "Confidence"],
  Passing: ["Weak Foot", "Ball Mastery", "Confidence"],
  "Weak Foot": ["Passing", "Ball Mastery", "Confidence"],
  "Ball Mastery": ["Confidence"],
  Confidence: ["Ball Mastery"],
};

export function normalizeDrillTitle(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:]+$/g, "");
}

export function isPlyoTitle(title: string): boolean {
  return /^plyo\b|warm.?up/i.test(title.trim());
}

// Bank strengthening titles carry the "Strength:" prefix (added on save in
// drill-actions.ts), so the player UI can badge a finisher from its title
// alone, same as plyos.
export function isStrengthTitle(title: string): boolean {
  return /^strength(ening)?\b/i.test(title.trim());
}

function tokens(s: string): Set<string> {
  return new Set(
    normalizeDrillTitle(s)
      .replace(/[^a-z0-9 ]/g, " ")
      .split(" ")
      .filter((t) => t.length > 2)
  );
}

// Exact normalized title, else a clear fuzzy hit (one title inside the
// other, or most of the words shared). Never a loose guess - a wrong match
// would silently swap one drill for another.
export function matchBankDrill(title: string, bank: Drill[]): Drill | null {
  const want = normalizeDrillTitle(title);
  if (!want) return null;
  const exact = bank.find((d) => normalizeDrillTitle(d.title) === want);
  if (exact) return exact;
  const wt = tokens(title);
  let best: { d: Drill; score: number } | null = null;
  for (const d of bank) {
    const have = normalizeDrillTitle(d.title);
    if (want.length >= 8 && have.length >= 8 && (have.includes(want) || want.includes(have))) {
      return d;
    }
    const ht = tokens(d.title);
    if (!wt.size || !ht.size) continue;
    let shared = 0;
    for (const t of wt) if (ht.has(t)) shared++;
    const score = shared / Math.max(wt.size, ht.size);
    if (score >= 0.6 && (!best || score > best.score)) best = { d, score };
  }
  return best?.d ?? null;
}

function pillarFor(text: string): string | null {
  const hay = text.toLowerCase();
  for (const [re, pillar] of PILLAR_HINTS) if (re.test(hay)) return pillar;
  return null;
}

function fromBank(d: Drill): GeneratedDrill {
  return {
    title: d.title,
    exercise: d.how,
    reps: d.reps,
    minutes: d.minutes,
    notes: d.cues || undefined,
  };
}

export function conformSessionsToBank(
  sessions: GeneratedSession[],
  bank: Drill[] | undefined,
  player?: Pick<Player, "has_wall"> | null,
  weeklyFocus = "",
  strength: StrengthMode = "optional"
): GeneratedSession[] {
  if (!bank || bank.length === 0) return sessions;

  const canDo = (d: Drill) => !d.needs_wall || player?.has_wall === true;
  const skillsPool = bank.filter((d) => isSkillPillar(d.pillar) && canDo(d));
  const plyoPool = bank.filter((d) => d.pillar === PLYO_PILLAR);
  const strengthPool = bank.filter((d) => d.pillar === STRENGTH_PILLAR);
  if (skillsPool.length === 0) return sessions;

  // Titles already placed this week - replacements avoid repeats while the
  // pool allows it.
  const usedWeek = new Set<string>();
  let plyoSpin = 0;
  let strengthSpin = 0;
  const isStrengthDrill = (d: GeneratedDrill) =>
    isStrengthTitle(d.title) || Boolean(matchBankDrill(d.title, strengthPool));

  const pickSkill = (pillar: string | null, usedSession: Set<string>): Drill => {
    const order = pillar ? [pillar, ...(PILLAR_FALLBACK[pillar] ?? [])] : [];
    const tiers: Drill[][] = [
      ...order.map((p) => skillsPool.filter((d) => d.pillar === p)),
      skillsPool,
    ];
    for (const avoid of [usedWeek, usedSession, new Set<string>()]) {
      for (const tier of tiers) {
        const open = tier.filter((d) => !avoid.has(d.title) && !usedSession.has(d.title));
        if (open.length) return open[0];
      }
    }
    return skillsPool[0];
  };

  return sessions.map((s) => {
    const usedSession = new Set<string>();
    const sessionText = `${s.title} ${s.drills.map((d) => d.title).join(" ")} ${weeklyFocus}`;
    // Pillar of the session: the matched bank drills decide, else the text.
    const matchedPillars = s.drills
      .filter((d) => !isPlyoTitle(d.title))
      .map((d) => matchBankDrill(d.title, skillsPool)?.pillar)
      .filter((p): p is Drill["pillar"] => Boolean(p));
    const sessionPillar =
      mostCommon(matchedPillars) ?? pillarFor(sessionText) ?? null;

    const drills: GeneratedDrill[] = [];
    // Strengthening finishers are handled apart from the skill drills:
    // matched to the filmed strengthening pool (or replaced from it),
    // capped at one, and appended LAST after the skill fill below.
    let finisher: GeneratedDrill | null = null;
    for (const d of s.drills) {
      if (isStrengthDrill(d)) {
        if (finisher || strengthPool.length === 0) continue; // one max, never unfilmed
        const hit = matchBankDrill(d.title, strengthPool);
        const chosen = hit ?? strengthPool[strengthSpin++ % strengthPool.length];
        finisher = hit ? { ...fromBank(chosen), ...keepTailoring(d), title: chosen.title } : fromBank(chosen);
        continue;
      }
      if (isPlyoTitle(d.title)) {
        if (plyoPool.length === 0) continue; // never an unfilmed warm-up
        const hit = matchBankDrill(d.title, plyoPool);
        const chosen = hit ?? plyoPool[plyoSpin++ % plyoPool.length];
        if (usedSession.has(chosen.title)) continue;
        usedSession.add(chosen.title);
        drills.push(hit ? { ...fromBank(chosen), ...keepTailoring(d) } : fromBank(chosen));
        continue;
      }
      const hit = matchBankDrill(d.title, skillsPool);
      if (hit && !usedSession.has(hit.title)) {
        usedSession.add(hit.title);
        usedWeek.add(hit.title);
        // Canonical title (the id link is by title), the AI's tailoring kept.
        drills.push({ ...fromBank(hit), ...keepTailoring(d), title: hit.title });
        continue;
      }
      const pillar = hit ? hit.pillar : pillarFor(d.title) ?? sessionPillar;
      const sub = pickSkill(pillar, usedSession);
      usedSession.add(sub.title);
      usedWeek.add(sub.title);
      drills.push(fromBank(sub));
    }
    // A session is plyo + three skill drills. A thin or empty session is
    // filled from the filmed bank, same pillar first - never with an
    // invented padding drill (the old "Apply under pressure" / "Focus
    // block" rows reached real players with no video).
    let skillCount = drills.filter((d) => !isPlyoTitle(d.title)).length;
    while (skillCount < MIN_SKILLS) {
      const sub = pickSkill(sessionPillar, usedSession);
      if (usedSession.has(sub.title)) break; // bank exhausted for this session
      usedSession.add(sub.title);
      usedWeek.add(sub.title);
      drills.push(fromBank(sub));
      skillCount++;
    }
    // Strengthening finisher, last. Required mode guarantees one per
    // session (rotating through the pool across the week) even when the
    // AI placed none; optional mode only keeps what the AI placed.
    if (!finisher && strength === "required" && strengthPool.length > 0) {
      finisher = fromBank(strengthPool[strengthSpin++ % strengthPool.length]);
    }
    if (finisher) drills.push(finisher);
    return { ...s, drills };
  });
}

// The AI's reps/minutes/notes are tailored to the player; keep them when
// present and sane, otherwise the bank's own values stand.
function keepTailoring(d: GeneratedDrill): Partial<GeneratedDrill> {
  const out: Partial<GeneratedDrill> = {};
  if (d.exercise && d.exercise.trim().length > 20) out.exercise = d.exercise;
  if (d.reps && d.reps.trim()) out.reps = d.reps;
  if (typeof d.minutes === "number" && d.minutes >= 3 && d.minutes <= 30) out.minutes = d.minutes;
  if (d.notes && d.notes.trim()) out.notes = d.notes;
  return out;
}

function mostCommon<T extends string>(xs: T[]): T | null {
  if (!xs.length) return null;
  const counts = new Map<T, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
