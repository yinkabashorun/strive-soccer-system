// =====================================================================
// Strive Soccer FC - training methodology (single source of truth)
// =====================================================================
// This is THE canonical description of how Strive trains. The AI plan
// generator builds every weekly plan from it, so editing this file changes
// how the whole system coaches. A human-readable version lives in
// docs/METHODOLOGY.md.
// =====================================================================

import { PLYO_PILLAR, STRENGTH_PILLAR, PROGRESS_METRICS, type Drill, type ProgressMetric } from "./types";
import { SESSIONS_PER_WEEK } from "./training";

// The non-negotiable structure of a Strive training week.
export const METHOD_STRUCTURE = {
  sessionsPerWeek: SESSIONS_PER_WEEK, // 4 - the player trains four times
  minutesPerSession: 40, // ~40 minutes each
  warmup: "plyometrics", // every session opens with a room plyo warm-up
  warmupMinutes: 10,
  skillDrillsPerSession: 3, // three focused drills, done with intent
  setting: "solo, at home or nearby: driveway, backyard, garage, or a park",
  // The ONLY equipment we assume: a ball and a small space. Anything else
  // (wall, goal, rebounder, partner, ladder) must come from the coach's
  // notes or the player's profile - never assumed.
  assumedEquipment: "a ball and a small open space",
};

// The Strive philosophy - the principles behind every plan.
export const METHOD_PRINCIPLES: string[] = [
  "Creative, intelligent football over robotic drills.",
  "Touches before tricks: master the basics or get exposed.",
  "The fastest player is the one who decides fastest, not who runs most.",
  "Composure is taught. So is panic. We teach composure.",
  "Scan before you receive: see the picture before the ball arrives.",
  "Every session starts with explosive plyometrics in the room. This is what turns training into results.",
  "Five focused minutes a day compounds. Consistency beats intensity.",
  "Fewer, deeper reps done with intent beat a long list rushed.",
];

// The seven development pillars and the coaching lens Strive uses for each.
// THERE IS NO BUILT-IN DRILL LIST. Until Oct 2 2026 this file carried a
// "starter library" of drills with no videos; whenever the real bank was
// unreachable the AI, the fallback plan, and the warm-ups all quietly drew
// from it, and real players got weeks of drills with nothing to watch.
// Coach Yinka: delete every drill without a video. The ONLY drills in this
// app are the filmed rows in elite_drills. No bank reachable = no plan
// (the generator throws, the run logs it, the coach gets a text).
export type PillarGuide = {
  pillar: ProgressMetric;
  lens: string;
};

// Coach Yinka's 1v1 move library - the named moves every take-on drill
// draws from. Shown to players by name so the vocabulary sticks.
export const ONE_V_ONE_MOVES = [
  "Stepover",
  "Body Feint",
  "Neymar Feint",
  "Maradona",
  "Mbappe Chop",
  "La Croqueta",
  "Elastico",
  "Reverse Elastico",
] as const;

export const METHOD_PILLARS: PillarGuide[] = [
  {
    pillar: "Ball Mastery",
    lens: "The ball is an extension of the foot. Manipulate, don't kick. Cone work builds the touches; cones or shoes as markers.",
  },
  {
    pillar: "Weak Foot",
    lens: "Two-footed players are twice the problem. Force the weak side.",
  },
  {
    pillar: "Passing",
    lens: "Weight, accuracy, and a scan before every pass. Passing is trained on a wall (garage door, brick wall, fence): the ball must come back. A player with no wall does their passing work in coached sessions, never through watered-down solo substitutes.",
  },
  {
    pillar: "Scanning",
    lens: "Two shoulder checks before every touch. Make it automatic.",
  },
  {
    pillar: "Decision Making",
    lens: "Right choice, right time. Read the cue, then act.",
  },
  {
    pillar: "Confidence",
    lens: `Bravery on the ball is trained. Reps remove fear. The Strive 1v1 move library: ${ONE_V_ONE_MOVES.join(", ")}. Every take-on drill names a real move from this list and follows the Strive pattern: the cone is the defender, dribble at it, hit the move right at the cone, explode past.`,
  },
  {
    pillar: "Speed",
    lens: "Explosive first steps and quick feet, not just top speed.",
  },
];

// Builds the methodology block injected into the AI coach's system prompt so
// every generated plan follows the Strive method. The AI composes STRICTLY
// from the coach's filmed drill bank passed in. With no skill drills in it
// there is nothing legitimate to prescribe, so this throws rather than
// handing the AI anything else - a plan built from invented drills is worse
// than no plan, and the failure is logged and texted to the coach.
export class EmptyBankError extends Error {
  constructor() {
    super("No filmed skill drills in the drill bank - refusing to build a plan");
    this.name = "EmptyBankError";
  }
}

export function methodologyContext(bank?: Drill[]): string {
  const principles = METHOD_PRINCIPLES.map((p) => `- ${p}`).join("\n");
  const lensFor = (pillar: string) =>
    METHOD_PILLARS.find((g) => g.pillar === pillar)?.lens ?? "";
  const grouped = new Map<string, { title: string; how: string; reps: string; minutes: number; cues: string; wall: boolean }[]>();
  const finishers: string[] = [];
  for (const d of bank ?? []) {
    // Plyo warm-ups are prepended server-side; the AI must never see
    // them as prescribable skill drills.
    if (d.pillar === PLYO_PILLAR) continue;
    // Strengthening finishers get their own block with their own rules
    // below - they are never a skill drill and never fill a pillar day.
    if (d.pillar === STRENGTH_PILLAR) {
      finishers.push(`${d.title} (${d.reps} = ~${d.minutes} min): ${d.how}${d.cues ? `. Cues: ${d.cues}` : ""}`);
      continue;
    }
    const list = grouped.get(d.pillar) ?? [];
    list.push({ title: d.title, how: d.how, reps: d.reps, minutes: d.minutes, cues: d.cues, wall: d.needs_wall });
    grouped.set(d.pillar, list);
  }
  if (grouped.size === 0) throw new EmptyBankError();
  const pillars = Array.from(grouped.entries())
    .map(
      ([pillar, drills]) =>
        `- ${pillar}: ${lensFor(pillar)} Drills: ${drills
          .map(
            (d) =>
              `${d.title}${d.wall ? " [wall]" : ""} (${d.reps} = ~${d.minutes} min): ${d.how}${d.cues ? `. Cues: ${d.cues}` : ""}`
          )
          .join("; ")}.`
    )
    .join("\n");
  return `STRIVE TRAINING METHODOLOGY (follow this exactly):

Principles:
${principles}

Weekly structure:
- ${METHOD_STRUCTURE.sessionsPerWeek} sessions that week, about ${METHOD_STRUCTURE.minutesPerSession} minutes each.
- Every session opens with a ${METHOD_STRUCTURE.warmupMinutes}-minute room plyometric warm-up (added automatically).
- ${METHOD_STRUCTURE.skillDrillsPerSession} focused skill drills per session. Fewer, deeper reps, ${METHOD_STRUCTURE.setting}.
- DRILL TITLES (strict): every drill's title is copied EXACTLY, character for
  character, from the drill list below. Never rename, shorten, combine, or
  invent a drill. If no listed drill fits, pick the closest listed drill and
  put the adjustment in its notes. A title that is not in the list is
  replaced by the system before the player sees it, so inventing one only
  loses your intent.

Equipment rule (strict): assume the player has ONLY ${METHOD_STRUCTURE.assumedEquipment}.
The player's TRAINING ENVIRONMENT line (in the user message) is a HARD
constraint. Wall drills (marked "wall" below) ONLY for players who HAVE a
wall; a goal only for players who HAVE a goal. Passing drills are wall
drills, full stop: a player with no wall gets NO passing-focused drills or
sessions (their passing work happens in coached sessions); give them other
pillars instead. NEVER
prescribe furniture or improvised household equipment: no couch cushions,
chairs, mattresses, or anything that sounds like a hack. This is a
professional program; every drill must sound like it.

PILLAR MAP (strict): three pillars are trained without their own drill
days, so NEVER build a session for them:
- Speed is trained by the plyometric warm-ups that open every session.
  If the notes call for speed work, push warm-up intent in the player
  summary ("attack every rep of the warm-ups this week"), never a speed day.
- Decision Making is trained in film sessions with the coach, never in
  solo homework. If the notes call for decision work, mention the film
  focus in the parent update, never a decision-making drill day.
- Scanning lives INSIDE wall work: wall drills carry a shoulder-check
  habit while the ball travels to the wall and back. When the notes flag
  scanning, keep the bank drills verbatim but use each wall drill's notes
  field to add ONE scan emphasis (e.g. "shoulder check both ways while
  the ball travels"). For a player with no wall, put the same scan
  emphasis in the notes of their cone drills instead.

WALL DAY RULE (strict): a wall drill means the player travels to a wall,
so wall work is BATCHED, never scattered. If a session contains any wall
drill, EVERY skill drill in that session must be a wall drill - the player
goes to the wall once and gets a full session out of the trip. Build the
week as one or two dedicated wall sessions (for players who have a wall)
and keep the remaining sessions completely wall-free. Never place a single
wall drill inside an otherwise no-wall session.

FRICTION RULE (strict): every drill is FULLY SOLO and needs at most ONE
factor beyond the ball: cones/markers, OR a wall, OR a phone (clip study).
Never a second person (no parents, siblings, partners) and never two
factors in one drill (e.g. a wall AND a person). Training must be
no-nonsense and repetitive with zero friction between reps: one simple
setup, then reps. Never prescribe a net, ladder, or rebounder machine.
If the coach's notes explicitly mention equipment or a partner (e.g.
"200 wall passes", "with his brother"), use exactly that, nothing more.
Cones or shoes as markers, gates, and targets are always fine.

THE DRILL BANK (compose-only, strict): every drill you prescribe MUST come
from the bank below: keep the drill's title, setup/execution and cues
essentially verbatim. What you ADAPT per player is the selection (which
drills fit their weaknesses and the coach's notes) and the reps/minutes
(scaled to their level, timing still adding up). Do NOT invent new drills,
rename bank drills, or merge two into one. If the notes ask for work no
bank drill covers, pick the closest bank drill and say what to emphasize
in its notes field.

The bank, by pillar:
${pillars}

${
  finishers.length
    ? `STRENGTHENING FINISHERS (bank pillar "Strengthening", strict): these
are NOT skill drills and never count toward the 3 skill drills. A
finisher is always the LAST drill of a session, at most ONE per session,
title copied exactly like every other drill. When the coach's note, the
call notes, or the player's own check-in mention an injury, rehab,
injury prevention, core, hip, back, groin, hamstring or strength work,
put ONE finisher at the end of EVERY session (the system enforces this
too), and when the finisher's own setup says what to avoid, keep the
skill drills and the player summary consistent with it. Otherwise add a
finisher to at most two sessions that week, where it fits the player,
or none. When a session has a finisher, size its three skill drills at
about 8 minutes each so the session still lands near 45 minutes.
The finishers: ${finishers.join("; ")}.`
    : `STRENGTHENING: the bank has no strengthening finishers yet. Do not
invent one. If the notes mention an injury or core/strength work, keep
every drill from the bank above, steer the selection around the injury
(no jumping or sprint-style work for a lower-body or back issue goes in
the player summary and the drill notes), and leave it there.`
}`;
}

// Re-export so callers can rely on the canonical metric list too.
export const METHOD_PILLAR_NAMES = PROGRESS_METRICS;
