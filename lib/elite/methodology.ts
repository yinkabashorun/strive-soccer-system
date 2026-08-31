// =====================================================================
// Strive Soccer FC - training methodology (single source of truth)
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

// The seven development pillars, each with the coaching lens Strive uses and
// a starter library of room/yard-friendly drills the AI can draw from.
// Every drill carries a real prescription: sets x reps, never a bare
// duration. These are shown to players verbatim when the AI is offline.
export type PillarDrill = {
  title: string;
  how: string; // what to actually do, with the coaching cue
  reps: string; // real sets and reps WITH rest where it matters
  minutes: number; // honest time: work + rest between sets + setup
};

export type PillarGuide = {
  pillar: ProgressMetric;
  lens: string;
  drills: PillarDrill[];
};

export const METHOD_PILLARS: PillarGuide[] = [
  {
    pillar: "Ball Mastery",
    lens: "The ball is an extension of the foot. Manipulate, don't kick.",
    drills: [
      {
        title: "Foundations + sole rolls",
        how: "Foundations into sole rolls, both feet, eyes up for the whole set",
        reps: "6 x 60 sec on, 40 sec off",
        minutes: 10,
      },
      {
        title: "Toe-taps + V-pulls",
        how: "Toe-taps into V-pulls at a steady rhythm, switch the lead foot every set",
        reps: "4 x 30 each foot, rest 30 sec",
        minutes: 8,
      },
      {
        title: "Figure-8 dribble",
        how: "Tight figure-8 through two shoes, close touches, head up on the straights",
        reps: "6 x 45 sec on, 45 sec off",
        minutes: 9,
      },
    ],
  },
  {
    pillar: "Weak Foot",
    lens: "Two-footed players are twice the problem. Force the weak side.",
    drills: [
      {
        title: "Weak-foot patterns",
        how: "Dribble patterns through shoes, weak foot only. Slow is fine, clean is required",
        reps: "6 x 45 sec weak foot only, 45 sec off",
        minutes: 9,
      },
      {
        title: "Weak-foot push-pulls",
        how: "Push-pulls and toe-taps, weak foot only, eyes up on the last five",
        reps: "4 x 40, rest 30 sec",
        minutes: 8,
      },
      {
        title: "Weak-foot rebounds",
        how: "Rebound passes off a wall: garage door, brick wall, or fence. Weak side only, cushion the return. No wall? Pass to a marker, sprint to the ball, repeat",
        reps: "4 x 20, rest 45 sec",
        minutes: 9,
      },
      {
        title: "Weak-foot strikes",
        how: "Strikes at a target: a shoe, a bag, anything to hit. Laces, follow through",
        reps: "4 x 10, collect and reset between sets",
        minutes: 9,
      },
    ],
  },
  {
    pillar: "Passing",
    lens: "Weight, accuracy, and a scan before every pass. The ball must come back: a wall makes solo passing real.",
    drills: [
      {
        title: "Rebound passing",
        how: "Firm two-touch passes off a wall: garage door, brick wall, or fence. Both feet. No wall? Pass to a marker, sprint to the ball, pass back the other way",
        reps: "5 x 20 two-touch, rest 40 sec",
        minutes: 10,
      },
      {
        title: "Rebound rhythm",
        how: "One-touch returns off the wall, stay on your toes, scan between reps",
        reps: "5 x 45 sec one-touch, 45 sec off",
        minutes: 8,
      },
      {
        title: "Weighted rolls",
        how: "Inside-of-foot passes that stop dead on a towel or marker. Weight over power",
        reps: "3 x 12 each foot, walk and reset each set",
        minutes: 9,
      },
    ],
  },
  {
    pillar: "Scanning",
    lens: "Two shoulder checks before every touch. Make it automatic.",
    drills: [
      {
        title: "Scan + touch",
        how: "Shoulder-check before every touch in a dribble pattern. Say what you saw out loud",
        reps: "5 x 45 sec on, 45 sec off",
        minutes: 8,
      },
      {
        title: "Number-call scanning",
        how: "A parent holds up fingers mid-drill. Read the number before your next touch",
        reps: "4 x 20 touches, rest 30 sec",
        minutes: 8,
      },
      {
        title: "Half-turn receives",
        how: "Shadow rondo: receive on the half-turn away from imagined pressure, first touch out of your feet",
        reps: "3 x 15, reset after every receive",
        minutes: 10,
      },
    ],
  },
  {
    pillar: "Decision Making",
    lens: "Right choice, right time. Read the cue, then act.",
    drills: [
      {
        title: "Two-gate finish",
        how: "Two gates made of shoes. Attack, then pick the open gate on a late call and explode through it",
        reps: "5 x 8, walk-back reset each rep",
        minutes: 10,
      },
      {
        title: "1v1 shadow",
        how: "Commit the imaginary defender with a move, then decide: exit left, exit right, or stop and shield",
        reps: "4 x 10, rest 40 sec",
        minutes: 9,
      },
      {
        title: "Clip study",
        how: "Watch a pro in your position, note three decisions they made early, copy them tomorrow",
        reps: "10 focused minutes, 3 takeaways written down",
        minutes: 10,
      },
    ],
  },
  {
    pillar: "Confidence",
    lens: "Bravery on the ball is trained. Reps remove fear.",
    drills: [
      {
        title: "Take-on reps",
        how: "Attack an imaginary defender, sell the move, burst two steps past. No hesitation",
        reps: "5 x 10 full speed, rest 45 sec",
        minutes: 10,
      },
      {
        title: "Juggling record",
        how: "Beat yesterday's best number, any surface counts",
        reps: "6 record attempts, rest as needed",
        minutes: 8,
      },
      {
        title: "Move mirror",
        how: "One skill move in slow motion until it's clean, then at full speed",
        reps: "3 x 12 each side, slow then full speed",
        minutes: 9,
      },
    ],
  },
  {
    pillar: "Speed",
    lens: "Explosive first steps and quick feet, not just top speed.",
    drills: [
      {
        title: "Quick feet",
        how: "Fast feet over a line or low ladder, minimal ground contact, think hot floor",
        reps: "8 x 20 sec on, 40 sec off",
        minutes: 8,
      },
      {
        title: "Acceleration starts",
        how: "5-yard explosions from a standstill, walk back to recover fully",
        reps: "8 sprints, walk back for full recovery",
        minutes: 10,
      },
      {
        title: "Reaction starts",
        how: "Sprint on a visual cue from a parent or a dropped sock. React, don't guess",
        reps: "6 starts, full recovery between",
        minutes: 8,
      },
    ],
  },
];

// Builds the methodology block injected into the AI coach's system prompt so
// every generated plan follows the Strive method.
export function methodologyContext(): string {
  const principles = METHOD_PRINCIPLES.map((p) => `- ${p}`).join("\n");
  const pillars = METHOD_PILLARS.map(
    (g) =>
      `- ${g.pillar}: ${g.lens} Sample drills: ${g.drills
        .map((d) => `${d.title} (${d.reps} = ~${d.minutes} min): ${d.how}`)
        .join("; ")}.`
  ).join("\n");
  return `STRIVE TRAINING METHODOLOGY (follow this exactly):

Principles:
${principles}

Weekly structure:
- ${METHOD_STRUCTURE.sessionsPerWeek} sessions that week, about ${METHOD_STRUCTURE.minutesPerSession} minutes each.
- Every session opens with a ${METHOD_STRUCTURE.warmupMinutes}-minute room plyometric warm-up (added automatically).
- ${METHOD_STRUCTURE.skillDrillsPerSession} focused skill drills per session. Fewer, deeper reps, ${METHOD_STRUCTURE.setting}.

Equipment rule (strict): assume the player has ONLY ${METHOD_STRUCTURE.assumedEquipment}.
Rebound drills may assume a real wall: a garage door, brick wall, or fence.
When a player might not have one, build the alternative into the drill itself
using only the ball and space (e.g. "no wall? pass to a marker, sprint to the
ball, repeat"). NEVER prescribe furniture or improvised household equipment:
no couch cushions, chairs, mattresses, or anything that sounds like a hack.
This is a professional program; every drill must sound like it. Never
prescribe a goal, net, ladder, rebounder machine, or a partner unless the
coach's notes or the player's profile explicitly mention them. If the coach
mentions equipment (e.g. "200 wall passes"), use exactly that, nothing more.
Shoes as markers or targets are fine.

The seven development pillars and how Strive coaches them (draw drills from here, adapted to the player's focus and level):
${pillars}`;
}

// Re-export so callers can rely on the canonical metric list too.
export const METHOD_PILLAR_NAMES = PROGRESS_METRICS;
