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

import type { Drill, GeneratedDrill, GeneratedSession, Player, SessionTemplate, TrainingSpace } from "./types";
import { PLYO_PILLAR, STRENGTH_PILLAR } from "./types";

// What the builder knows about where a player trains (019 wall, 033 space)
// and which course drills the coach has offered them (040).
export type PlayerEnv = {
  has_wall?: boolean | null;
  space?: TrainingSpace | null;
  offer_opt_in?: boolean | null;
  opt_in_drill_ids?: string[] | null;
};

// Can this player do this bank drill where they train? Wall drills need a
// wall (019). On the tight space setting ("a ball and a few yards", 033)
// only drills the coach ticked as small_space are allowed. Plyo warm-ups
// and strengthening finishers are room work by definition and are never
// space-filtered. Open space (the default, every pre-033 player) filters
// nothing beyond the wall rule, so today's weeks are unchanged.
// An opt-in course drill (040) fits only a player the coach switched on
// AND ticked that exact drill for; for everyone else it does not exist.
export function drillFitsPlayer(d: Drill, env?: PlayerEnv | null): boolean {
  if (d.needs_wall && env?.has_wall !== true) return false;
  if (env?.space === "tight" && isSkillPillar(d.pillar) && !d.small_space) return false;
  if (d.opt_in && !isOffered(d, env)) return false;
  return true;
}

export function isOffered(d: Drill, env?: PlayerEnv | null): boolean {
  return env?.offer_opt_in === true && (env.opt_in_drill_ids ?? []).includes(d.id);
}

// The bank as this player may see it: every ordinary drill, plus only the
// opt-in course drills the coach offered them. Applied before the AI is
// shown the menu, before the fallback composes, at the publish gate and
// in Extra Work, so an unoffered course drill is never on the menu, never
// matched by title, never placed.
export function offeredBank(bank: Drill[], env?: PlayerEnv | null): Drill[] {
  return bank.filter((d) => !d.opt_in || isOffered(d, env));
}

// Course drills are a SLOT, not skill drills (Coach Yinka, Oct 24 2026:
// "when you add them add them after plyometrics with the warm up. Keep
// all other drills"). In every session the offered course drills sit
// right after the plyo warm-up, before the three skill drills, and never
// count toward those three. One per session, rotating through the ticked
// drills in bank order (the ladder, easiest first) across the week; the
// system places them like plyos and finishers, so they are never on the
// AI's menu and a title the AI or the studio writes for one is routed to
// the slot, never matched as a skill drill.
export const COURSE_SLOTS_PER_SESSION = 1;

export function isCourseDrill(d: Drill): boolean {
  return Boolean(d.opt_in);
}

// The offered course drills for this player, in ladder order.
export function coursePoolFor(bank: Drill[], env?: PlayerEnv | null): Drill[] {
  return bank
    .filter((d) => isCourseDrill(d) && drillFitsPlayer(d, env))
    .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title));
}

// The skill drills the AI may compose from and the builder may fill with:
// never a plyo, never a finisher, never a course drill.
export function skillBank(bank: Drill[]): Drill[] {
  return bank.filter((d) => isSkillPillar(d.pillar) && !isCourseDrill(d));
}

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
// A skill drill, by title: not a warm-up, not a finisher.
export function isSkillTitle(title: string): boolean {
  return !isPlyoTitle(title) && !isStrengthTitle(title);
}

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

// Pick a skill drill for a pillar from a pool, avoiding what's already
// used this week, then this session, then anything. Fallback pillars when
// the pillar has nothing filmed the player can do.
function pickSkillFrom(
  skillsPool: Drill[],
  pillar: string | null,
  usedWeek: Set<string>,
  usedSession: Set<string>
): Drill {
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
}

export function conformSessionsToBank(
  sessions: GeneratedSession[],
  bank: Drill[] | undefined,
  player?: PlayerEnv | null,
  weeklyFocus = "",
  strength: StrengthMode = "optional",
  tpl?: TemplateContext | null
): GeneratedSession[] {
  if (!bank || bank.length === 0) return sessions;

  // Few-yards players (035): the week IS the coach's hand-built templates,
  // whatever the AI or the studio wrote. Same gate, both call sites.
  if (player?.space === "tight" && tpl) {
    const t = templateSessions({
      templates: tpl.templates,
      bank,
      player,
      count: sessions.length,
      usage: tpl.usage,
      strength,
    });
    if (t) return t.sessions;
  }

  const canDo = (d: Drill) => drillFitsPlayer(d, player);
  const skillsPool = skillBank(bank).filter(canDo);
  const plyoPool = bank.filter((d) => d.pillar === PLYO_PILLAR);
  const strengthPool = bank.filter((d) => d.pillar === STRENGTH_PILLAR);
  // Course drills (040): the ones offered to this player fill the slot
  // after the warm-up; EVERY course drill in the bank, offered or not, is
  // recognised by title so one the AI or the studio wrote is never kept
  // as a skill drill (offered: the slot already places it; unoffered: it
  // does not exist for this player).
  const coursePool = coursePoolFor(bank, player);
  const courseTitles = bank.filter(isCourseDrill);
  if (skillsPool.length === 0) return sessions;

  // Titles already placed this week - replacements avoid repeats while the
  // pool allows it.
  const usedWeek = new Set<string>();
  let plyoSpin = 0;
  let strengthSpin = 0;
  let courseSpin = 0;
  const isStrengthDrill = (d: GeneratedDrill) =>
    isStrengthTitle(d.title) || Boolean(matchBankDrill(d.title, strengthPool));
  const isCourseTitle = (d: GeneratedDrill) =>
    courseTitles.length > 0 && Boolean(matchBankDrill(d.title, courseTitles));

  const pickSkill = (pillar: string | null, usedSession: Set<string>): Drill =>
    pickSkillFrom(skillsPool, pillar, usedWeek, usedSession);

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

    // A session reads warm-up, course slot, skill drills, finisher. The
    // four parts are collected apart so each rule holds whatever order
    // the AI or the studio wrote them in.
    const warm: GeneratedDrill[] = [];
    const skills: GeneratedDrill[] = [];
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
        warm.push(hit ? { ...fromBank(chosen), ...keepTailoring(d) } : fromBank(chosen));
        continue;
      }
      // A course drill written as a skill drill: the slot below places the
      // offered ones; an unoffered one does not exist for this player.
      if (isCourseTitle(d)) continue;
      const hit = matchBankDrill(d.title, skillsPool);
      if (hit && !usedSession.has(hit.title)) {
        usedSession.add(hit.title);
        usedWeek.add(hit.title);
        // Canonical title (the id link is by title), the AI's tailoring kept.
        skills.push({ ...fromBank(hit), ...keepTailoring(d), title: hit.title });
        continue;
      }
      const pillar = hit ? hit.pillar : pillarFor(d.title) ?? sessionPillar;
      const sub = pickSkill(pillar, usedSession);
      usedSession.add(sub.title);
      usedWeek.add(sub.title);
      skills.push(fromBank(sub));
    }
    // A session is plyo + three skill drills. A thin or empty session is
    // filled from the filmed bank, same pillar first - never with an
    // invented padding drill (the old "Apply under pressure" / "Focus
    // block" rows reached real players with no video). Course drills are
    // not skill drills and never count here.
    while (skills.length < MIN_SKILLS) {
      const sub = pickSkill(sessionPillar, usedSession);
      if (usedSession.has(sub.title)) break; // bank exhausted for this session
      usedSession.add(sub.title);
      usedWeek.add(sub.title);
      skills.push(fromBank(sub));
    }
    // Course slot, right after the warm-up: the offered course drills in
    // ladder order, rotating across the sessions of the week.
    const course: GeneratedDrill[] = [];
    for (let i = 0; i < COURSE_SLOTS_PER_SESSION && i < coursePool.length; i++) {
      const pick = coursePool[courseSpin++ % coursePool.length];
      if (usedSession.has(pick.title)) continue;
      usedSession.add(pick.title);
      course.push(fromBank(pick));
    }
    // Strengthening finisher, last. Required mode guarantees one per
    // session (rotating through the pool across the week) even when the
    // AI placed none; optional mode only keeps what the AI placed.
    if (!finisher && strength === "required" && strengthPool.length > 0) {
      finisher = fromBank(strengthPool[strengthSpin++ % strengthPool.length]);
    }
    const drills = [...warm, ...course, ...skills];
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

// ---------------------------------------------------------------------
// Extra Work (offer stack item 1, Oct 12 2026): "I've got more today."
// A structured session the player adds on top of the plan: one plyo
// warm-up plus three skill drills from one shelf, NEVER a drill the
// player has already done (any week), then never one from this week,
// then the least recently done. Same filmed bank, same wall and space
// rules, same guard at the database. Returns null when the shelf has no
// drill this player can do (e.g. Wall Work with no wall).
// ---------------------------------------------------------------------
export type ExtraShelf = "ball_mastery" | "wall_work" | "one_v_one";

export const EXTRA_SHELVES: Record<ExtraShelf, { label: string; blurb: string }> = {
  ball_mastery: { label: "Ball Mastery", blurb: "Touches, cones, control. Any space." },
  wall_work: { label: "Wall Work", blurb: "Passing and weak foot against a wall." },
  one_v_one: { label: "1v1 Skills", blurb: "Moves, feints, beating a defender." },
};

export const EXTRA_SKILL_DRILLS = 3;

function shelfPool(skillsPool: Drill[], shelf: ExtraShelf): Drill[] {
  if (shelf === "wall_work") return skillsPool.filter((d) => d.needs_wall);
  if (shelf === "one_v_one") return skillsPool.filter((d) => d.pillar === "Confidence");
  return skillsPool.filter((d) => d.pillar === "Ball Mastery");
}

// Rank within a pool for Extra Work: not in this week's plan first, then
// by how long ago it was done (doneTitles is most-recent-first, so a
// larger index = older = better). Whether a drill has been done at all is
// decided OUTSIDE this ranking, in passes, because "never a drill the
// player has already done" is a hard rule, not a preference.
function rankForExtra(pool: Drill[], doneTitles: string[], weekTitles: Set<string>): Drill[] {
  const doneIdx = new Map<string, number>();
  doneTitles.forEach((t, i) => {
    const k = normalizeDrillTitle(t);
    if (!doneIdx.has(k)) doneIdx.set(k, i);
  });
  const score = (d: Drill) => {
    const k = normalizeDrillTitle(d.title);
    const recency = doneIdx.has(k) ? 1_000_000 - (doneIdx.get(k) ?? 0) : 0;
    return recency + (weekTitles.has(k) ? 2_000_000 : 0);
  };
  return [...pool].sort((a, b) => score(a) - score(b) || a.sort - b.sort);
}

export function composeExtraSession(opts: {
  bank: Drill[];
  player?: PlayerEnv | null;
  shelf: ExtraShelf;
  doneTitles: string[]; // every title the player has completed, most recent first
  weekTitles: string[]; // every title in the current week's plan
  strength?: StrengthMode;
}): GeneratedSession | null {
  const { bank, player, shelf, doneTitles, weekTitles, strength = "optional" } = opts;
  const fits = (d: Drill) => drillFitsPlayer(d, player);
  // Skill drills only: course drills belong to the week's warm-up slot,
  // never to an Extra Work shelf.
  const skillsPool = skillBank(bank).filter(fits);
  const weekSet = new Set(weekTitles.map(normalizeDrillTitle));

  const done = new Set(doneTitles.map(normalizeDrillTitle));
  const isDone = (d: Drill) => done.has(normalizeDrillTitle(d.title));
  const shelfDrills = shelfPool(skillsPool, shelf);
  if (shelfDrills.length === 0) return null;

  const drills: GeneratedDrill[] = [];
  const used = new Set<string>();
  const take = (pool: Drill[]) => {
    for (const d of rankForExtra(pool, doneTitles, weekSet)) {
      if (drills.length >= EXTRA_SKILL_DRILLS) return;
      if (used.has(d.title)) continue;
      used.add(d.title);
      drills.push(fromBank(d));
    }
  };
  // Pass 1: the shelf, never-done drills only.
  take(shelfDrills.filter((d) => !isDone(d)));
  // Pass 2: the nearest pillars, still never-done - a thin shelf is topped
  // up with new work before ANY repeat is considered.
  take(skillsPool.filter((d) => !isDone(d)));
  // Pass 3: only when the player has done every drill they can do, the
  // shelf's least recently done ones, so the session still exists.
  take(shelfDrills);
  if (drills.length === 0) return null;

  // Warm-up first: a filmed bank plyo, preferring one not in this week.
  const plyos = rankForExtra(bank.filter((d) => d.pillar === PLYO_PILLAR), [], weekSet);
  const warm = plyos[0] ? [fromBank(plyos[0])] : [];

  // Finisher last when the player's note requires strengthening.
  const strengthPool = bank.filter((d) => d.pillar === STRENGTH_PILLAR);
  const finisher =
    strength === "required" && strengthPool.length
      ? [fromBank(rankForExtra(strengthPool, doneTitles, weekSet)[0])]
      : [];

  return {
    title: `Extra: ${EXTRA_SHELVES[shelf].label}`,
    drills: [...warm, ...drills, ...finisher],
  };
}

// ---------------------------------------------------------------------
// Few-yards template sessions (offer stack item 3b, Oct 12 2026). Coach
// Yinka hand-builds sessions for players with a ball and a few yards; a
// tight-space player's week is those templates, rotated, never AI
// composition. Decisions: templates replace composition entirely; a
// template is skill drills only (the system adds the plyo warm-up and any
// required finisher, exactly as for every other session); when there are
// fewer templates than sessions in the week, the least recently used one
// repeats and the audit says so.
// ---------------------------------------------------------------------
export type TemplateUsage = Record<string, number>; // template id -> last week it was used
export type TemplateContext = { templates: SessionTemplate[]; usage: TemplateUsage };

// Templates this player can actually train, each reduced to its usable
// drills (active, filmed, fits the wall rule), in the coach's order.
function usableTemplates(templates: SessionTemplate[], env: PlayerEnv | null | undefined): SessionTemplate[] {
  return templates
    .filter((t) => t.active)
    .map((t) => ({
      ...t,
      drills: t.drills.filter(
        (d) =>
          d.active !== false &&
          Boolean(d.video_url) &&
          isSkillPillar(d.pillar) &&
          !isCourseDrill(d) &&
          drillFitsPlayer(d, env)
      ),
    }))
    .filter((t) => t.drills.length > 0)
    .sort((a, b) => a.sort - b.sort);
}

// Rotation order: never used first (coach's order), then by the week they
// were last used, oldest first.
export function orderTemplatesForPlayer(templates: SessionTemplate[], usage: TemplateUsage): SessionTemplate[] {
  return [...templates].sort((a, b) => {
    const ua = usage[a.id];
    const ub = usage[b.id];
    if (ua == null && ub == null) return a.sort - b.sort;
    if (ua == null) return -1;
    if (ub == null) return 1;
    return ua - ub || a.sort - b.sort;
  });
}

export function templateSessions(opts: {
  templates: SessionTemplate[];
  bank: Drill[];
  player: PlayerEnv | null | undefined;
  count: number;
  usage: TemplateUsage;
  strength: StrengthMode;
}): { sessions: GeneratedSession[]; repeated: boolean } | null {
  const { bank, player, count, usage, strength } = opts;
  const usable = orderTemplatesForPlayer(usableTemplates(opts.templates, player), usage);
  if (usable.length === 0 || count <= 0) return null;

  const plyoPool = bank.filter((d) => d.pillar === PLYO_PILLAR && d.video_url);
  const strengthPool = bank.filter((d) => d.pillar === STRENGTH_PILLAR && d.video_url);
  const skillsPool = skillBank(bank).filter((d) => drillFitsPlayer(d, player));
  // Course slot (040): same rule as every other session, right after the
  // warm-up, never counted as one of the template's skill drills.
  const coursePool = coursePoolFor(bank, player).filter((d) => d.video_url);
  let courseSpin = 0;
  const usedWeek = new Set<string>();
  const sessions: GeneratedSession[] = [];
  for (let i = 0; i < count; i++) {
    const t = usable[i % usable.length];
    const usedSession = new Set<string>();
    const drills: GeneratedDrill[] = [];
    if (plyoPool.length) {
      const warm = plyoPool[i % plyoPool.length];
      usedSession.add(warm.title);
      drills.push(fromBank(warm));
    }
    for (let c = 0; c < COURSE_SLOTS_PER_SESSION && c < coursePool.length; c++) {
      const pick = coursePool[courseSpin++ % coursePool.length];
      if (usedSession.has(pick.title)) continue;
      usedSession.add(pick.title);
      drills.push(fromBank(pick));
    }
    for (const d of t.drills) {
      if (usedSession.has(d.title)) continue;
      usedSession.add(d.title);
      usedWeek.add(d.title);
      drills.push(fromBank(d));
    }
    // A short template (a drill lost its video, or needs a wall this
    // player lacks) is filled from the few-yards pool, never left thin.
    let skillCount = t.drills.length;
    while (skillCount < MIN_SKILLS && skillsPool.length) {
      const sub = pickSkillFrom(skillsPool, t.drills[0]?.pillar ?? null, usedWeek, usedSession);
      if (usedSession.has(sub.title)) break;
      usedSession.add(sub.title);
      usedWeek.add(sub.title);
      drills.push(fromBank(sub));
      skillCount++;
    }
    if (strength === "required" && strengthPool.length) {
      drills.push(fromBank(strengthPool[i % strengthPool.length]));
    }
    sessions.push({ title: t.title, drills, template_id: t.id });
  }
  return { sessions, repeated: usable.length < count };
}
