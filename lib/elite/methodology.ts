// =====================================================================
// Strive Soccer FC — training methodology (single source of truth)
// =====================================================================
// This is THE canonical description of how Strive trains. The AI plan
// generator builds every weekly plan from it, so editing this file changes
// how the whole system coaches. A human-readable version lives in
// docs/METHODOLOGY.md.
// =====================================================================

import { PROGRESS_METRICS, type ProgressMetric } from "./types";
import { SESSIONS_PER_WEEK } from "./training";

// The non-negotiable structure of a Strive training week.
export const METHOD_STRUCTURE = {
  sessionsPerWeek: SESSIONS_PER_WEEK, // 4 — the player trains four times
  minutesPerSession: 40, // ~40 minutes each
  warmup: "plyometrics", // every session opens with a room plyo warm-up
  warmupMinutes: 10,
  skillDrillsPerSession: 3, // three focused drills, done with intent
  setting: "at-home / room-and-yard friendly",
  // The ONLY equipment we assume: a ball and a small space. Anything else
  // (wall, goal, rebounder, partner, ladder) must come from the coach's
  // notes or the player's profile — never assumed.
  assumedEquipment: "a ball and a small room/yard space",
};

// The Strive philosophy — the principles behind every plan.
export const METHOD_PRINCIPLES: string[] = [
  "Creative, intelligent football over robotic drills.",
  "Touches before tricks — master the basics or get exposed.",
  "The fastest player is the one who decides fastest, not who runs most.",
  "Composure is taught. So is panic. We teach composure.",
  "Scan before you receive — see the picture before the ball arrives.",
  "Every session starts with explosive plyometrics in the room — this is what turns training into results.",
  "Five focused minutes a day compounds. Consistency beats intensity.",
  "Fewer, deeper reps done with intent beat a long list rushed.",
];

// The seven development pillars, each with the coaching lens Strive uses and
// a starter library of room/yard-friendly drills the AI can draw from.
export type PillarGuide = {
  pillar: ProgressMetric;
  lens: string;
  drills: string[];
};

export const METHOD_PILLARS: PillarGuide[] = [
  {
    pillar: "Ball Mastery",
    lens: "The ball is an extension of the foot. Manipulate, don't kick.",
    drills: [
      "Foundations + sole rolls, both feet, eyes up",
      "Toe-taps and V-pulls to a metronome",
      "Figure-8 dribble through two shoes/cones in the room",
    ],
  },
  {
    pillar: "Weak Foot",
    lens: "Two-footed players are twice the problem. Force the weak side.",
    drills: [
      "Weak-foot-only dribble patterns through shoes/cones",
      "Weak-foot toe-taps and push-pulls",
      "Weak-foot cushion rebound passes — weak side only, cushion the return",
      "Weak-foot strikes at a target (a shoe, a bag — anything to hit)",
    ],
  },
  {
    pillar: "Passing",
    lens: "Weight, accuracy, and a scan before every pass. The ball must come back — a rebound surface makes solo passing real.",
    drills: [
      "Cushion rebound passing — lean a couch cushion or mattress against a wall/chair, firm two-touch passes off the return, both feet",
      "Rebound rhythm — one-touch returns off the cushion, stay on your toes, scan between reps",
      "Weighted rolls — inside-of-foot passes that stop dead on a towel/marker",
    ],
  },
  {
    pillar: "Scanning",
    lens: "Two shoulder checks before every touch — make it automatic.",
    drills: [
      "Shoulder-check before every touch in a dribble pattern",
      "Number-call scanning (a parent holds up fingers to read)",
      "Shadow rondo — receive on the half-turn away from pressure",
    ],
  },
  {
    pillar: "Decision Making",
    lens: "Right choice, right time. Read the cue, then act.",
    drills: [
      "Two-gate finish: pick the open gate on a cue",
      "1v1 shadow — commit the defender, then decide",
      "Clip breakdown: study a pro, note 3 decisions, copy them",
    ],
  },
  {
    pillar: "Confidence",
    lens: "Bravery on the ball is trained. Reps remove fear.",
    drills: [
      "Take-on reps — beat an imaginary defender, no hesitation",
      "Juggling records — beat yesterday's number",
      "Mirror skill moves until they're automatic",
    ],
  },
  {
    pillar: "Speed",
    lens: "Explosive first steps and quick feet, not just top speed.",
    drills: [
      "Quick-feet ladder/line drills for 20 seconds on, 40 off",
      "Acceleration starts — 5-yard explosions from a still position",
      "Reaction starts off a visual cue",
    ],
  },
];

// Builds the methodology block injected into the AI coach's system prompt so
// every generated plan follows the Strive method.
export function methodologyContext(): string {
  const principles = METHOD_PRINCIPLES.map((p) => `- ${p}`).join("\n");
  const pillars = METHOD_PILLARS.map(
    (g) =>
      `- ${g.pillar}: ${g.lens} Sample drills: ${g.drills.join("; ")}.`
  ).join("\n");
  return `STRIVE TRAINING METHODOLOGY (follow this exactly):

Principles:
${principles}

Weekly structure:
- ${METHOD_STRUCTURE.sessionsPerWeek} sessions that week, about ${METHOD_STRUCTURE.minutesPerSession} minutes each.
- Every session opens with a ${METHOD_STRUCTURE.warmupMinutes}-minute room plyometric warm-up (added automatically).
- ${METHOD_STRUCTURE.skillDrillsPerSession} focused skill drills per session — fewer, deeper reps, ${METHOD_STRUCTURE.setting}.

Equipment rule (strict): assume the player has ONLY ${METHOD_STRUCTURE.assumedEquipment}.
Never prescribe a wall, rebounder, goal, net, ladder, or a partner unless the
coach's notes or the player's profile explicitly mention them. If the coach
mentions one (e.g. "200 wall passes"), you may use exactly that — nothing more.
Shoes or household objects as markers/targets are always fine.

The seven development pillars and how Strive coaches them (draw drills from here, adapted to the player's focus and level):
${pillars}`;
}

// Re-export so callers can rely on the canonical metric list too.
export const METHOD_PILLAR_NAMES = PROGRESS_METRICS;
