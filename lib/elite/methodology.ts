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
  how: string; // setup first, then the execution
  reps: string; // real sets and reps WITH rest where it matters
  minutes: number; // honest time: work + rest between sets + setup
  cues?: string; // 2-3 key cues, short and punchy
  needsWall?: boolean; // only prescribed to players who have a wall (019)
};

export type PillarGuide = {
  pillar: ProgressMetric;
  lens: string;
  drills: PillarDrill[];
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
    drills: [
      {
        title: "Inside-outside cone weave",
        how: "Line of 5 cones a yard apart. Weave through with inside and outside of the foot only, tight touches",
        reps: "6 x 45 sec on, 45 sec off",
        minutes: 9,
        cues: "Small touches, ball close, eyes up between gates",
      },
      {
        title: "La Croqueta cone weave",
        how: "Line of 5 cones a yard apart. La croqueta at every cone: quick shift foot to foot, glide past. Both directions",
        reps: "5 x 45 sec on, 45 sec off",
        minutes: 8,
        cues: "Quick shift, stay low, accelerate out",
      },
      {
        title: "8-cone freestyle",
        how: "8 cones scattered in a box. Free dribble, every surface of both feet, one skill move at each cone you pass",
        reps: "5 x 60 sec on, 45 sec off",
        minutes: 9,
        cues: "Never the same move twice, change direction, head up",
      },
      {
        title: "Ronaldinho drill",
        how: "Ball at your feet, small space. Inside-touch inside-touch between the feet, then a sole roll to reset. Steady rhythm",
        reps: "4 x 60 sec on, 30 sec off",
        minutes: 8,
        cues: "Rhythm over speed, soft touches, eyes up on the last 10",
      },
      {
        title: "Figure-8 dribble",
        how: "Two cones two yards apart. Tight figure-8 through them, close touches both feet",
        reps: "6 x 45 sec on, 45 sec off",
        minutes: 9,
        cues: "Ball glued to the foot, head up on the straights",
      },
      {
        title: "Foundations + sole rolls",
        how: "Ball at your feet, small space. Foundations into sole rolls, both feet",
        reps: "6 x 60 sec on, 40 sec off",
        minutes: 10,
        cues: "Eyes up the whole set, quick feet, stay on your toes",
      },
    ],
  },
  {
    pillar: "Weak Foot",
    lens: "Two-footed players are twice the problem. Force the weak side.",
    drills: [
      {
        title: "Weak-foot patterns",
        how: "Line of cones or shoes. Dribble patterns through them, weak foot only",
        reps: "6 x 45 sec weak foot only, 45 sec off",
        minutes: 9,
        cues: "Slow is fine, clean is required, every surface of the foot",
      },
      {
        title: "Weak-foot push-pulls",
        how: "Ball at your feet, small space. Push-pulls and toe-taps, weak foot only",
        reps: "4 x 40, rest 30 sec",
        minutes: 8,
        cues: "Sole to inside, steady rhythm, eyes up on the last five",
      },
      {
        title: "Weak-foot rebounds",
        how: "Stand 5 yards from your wall: garage door, brick wall, or fence. Rebound passes, weak side only",
        reps: "4 x 20, rest 45 sec",
        minutes: 9,
        cues: "Cushion the return, firm pass back, ankle locked",
        needsWall: true,
      },
      {
        title: "Weak-foot strikes",
        how: "Set a target 10 yards out: a cone, a shoe, a fence post. Strikes with the weak foot, laces only",
        reps: "4 x 10, collect and reset between sets",
        minutes: 9,
        cues: "Plant foot beside the ball, laces, follow through at the target",
      },
    ],
  },
  {
    pillar: "Passing",
    lens: "Weight, accuracy, and a scan before every pass. A wall makes solo passing real; without one, pass-and-chase does the job.",
    drills: [
      {
        title: "Rebound passing",
        how: "Stand 5 yards from your wall: garage door, brick wall, or fence. Firm two-touch passes, both feet",
        reps: "5 x 20 two-touch, rest 40 sec",
        minutes: 10,
        cues: "Scan before the ball arrives, firm pass, first touch out of your feet",
        needsWall: true,
      },
      {
        title: "Rebound rhythm",
        how: "Close to the wall, 3 yards. One-touch returns, keep the rally alive",
        reps: "5 x 45 sec one-touch, 45 sec off",
        minutes: 8,
        cues: "On your toes, ankle locked, scan between reps",
        needsWall: true,
      },
      {
        title: "Weighted rolls",
        how: "Set a marker 10 yards out. Inside-of-foot passes that stop dead on it",
        reps: "3 x 12 each foot, walk and reset each set",
        minutes: 9,
        cues: "Weight over power, the ball dies on the marker",
      },
      {
        title: "Pass and chase",
        how: "Set a marker 15 yards out. Drive a firm pass at it, sprint after the ball, control it before it stops, pass back the other way. Both feet",
        reps: "5 x 8 passes, the sprint is the rest",
        minutes: 10,
        cues: "Firm pass, sprint immediately, clean first touch on arrival",
      },
      {
        title: "Gate passing",
        how: "Two markers a foot apart, 10 yards out. Pass through the gate, jog to collect, widen the distance every clean set",
        reps: "4 x 10 each foot, collect between sets",
        minutes: 9,
        cues: "Strike through the middle, follow through at the gate",
      },
    ],
  },
  {
    pillar: "Scanning",
    lens: "Two shoulder checks before every touch. Make it automatic.",
    drills: [
      {
        title: "Scan + touch",
        how: "Ball at your feet, open space. Shoulder-check before every touch in a dribble pattern",
        reps: "5 x 45 sec on, 45 sec off",
        minutes: 8,
        cues: "Check both shoulders, say what you saw out loud",
      },
      {
        title: "Number-call scanning",
        how: "A parent or sibling stands behind you holding up fingers mid-drill. Read the number before your next touch",
        reps: "4 x 20 touches, rest 30 sec",
        minutes: 8,
        cues: "Scan first, touch second, never guess",
      },
      {
        title: "Half-turn receives",
        how: "Roll the ball to yourself or off a rebound. Receive on the half-turn away from imagined pressure, first touch out of your feet into space",
        reps: "3 x 15, reset after every receive",
        minutes: 10,
        cues: "Shoulder-check before the ball arrives, open your hips, touch into space",
      },
    ],
  },
  {
    pillar: "Decision Making",
    lens: "Right choice, right time. Read the cue, then act.",
    drills: [
      {
        title: "Two-gate finish",
        how: "Two gates of cones or shoes, 5 yards apart. Attack the middle, pick one gate late, and explode through it",
        reps: "5 x 8, walk-back reset each rep",
        minutes: 10,
        cues: "Decide late, commit fully, burst through the gate",
      },
      {
        title: "1v1 shadow",
        how: "One cone as the defender. Dribble at it, commit it with a move, then decide: exit left, exit right, or stop and shield",
        reps: "4 x 10, rest 40 sec",
        minutes: 9,
        cues: "Sell the move, decide on the way in, never the same exit twice",
      },
      {
        title: "Clip study",
        how: "Pull up a full match or extended highlights of a pro in your position. Watch them off the ball, note three decisions they made early",
        reps: "10 focused minutes, 3 takeaways written down",
        minutes: 10,
        cues: "Watch the player, not the ball, steal one habit tomorrow",
      },
    ],
  },
  {
    pillar: "Confidence",
    lens: `Bravery on the ball is trained. Reps remove fear. The Strive 1v1 move library: ${ONE_V_ONE_MOVES.join(", ")}. Every take-on drill names a real move from this list and follows the Strive pattern: the cone is the defender, dribble at it, hit the move right at the cone, explode past.`,
    drills: [
      {
        title: "Move of the day",
        how: `One cone as the defender, 10 yards of run-up. Pick one move (${ONE_V_ONE_MOVES.slice(0, 4).join(", ")}...), dribble at the cone, hit the move right at it, burst two steps past. Slow until clean, then full speed`,
        reps: "3 x 12 each side, slow then full speed",
        minutes: 9,
        cues: "Sell the fake, drop the shoulder, explode out",
      },
      {
        title: "Chain two moves",
        how: "Two cones 5 yards apart. Dribble at the first, hit move one, attack the second, hit move two: stepover into the chop, body feint into la croqueta",
        reps: "4 x 10 full speed, rest 40 sec",
        minutes: 9,
        cues: "Defenders stop one move, not two, accelerate between cones",
      },
      {
        title: "1v1 freestyle",
        how: "One cone as the defender, full run-up. Dribble at it with speed, sell any move from the library right at the cone, explode past",
        reps: "5 x 8 full speed, walk-back reset",
        minutes: 10,
        cues: "No hesitation, no repeats back to back, game speed only",
      },
      {
        title: "Juggling record",
        how: "Just you and the ball. Beat yesterday's best number, any surface counts",
        reps: "6 record attempts, rest as needed",
        minutes: 8,
        cues: "Soft touches, knees bent, reset calmly after a drop",
      },
    ],
  },
  {
    pillar: "Speed",
    lens: "Explosive first steps and quick feet, not just top speed.",
    drills: [
      {
        title: "Quick feet",
        how: "Any line on the ground. Fast feet over and back, minimal ground contact",
        reps: "8 x 20 sec on, 40 sec off",
        minutes: 8,
        cues: "Think hot floor, stay on the balls of your feet, arms pumping",
      },
      {
        title: "Acceleration starts",
        how: "Two markers 5 yards apart. Explode from a standstill to the far marker, walk back",
        reps: "8 sprints, walk back for full recovery",
        minutes: 10,
        cues: "Low first step, drive the arms, full recovery every rep",
      },
      {
        title: "Reaction starts",
        how: "Athletic stance, 10 yards of space. Sprint on a visual cue: a parent's hand drop or a tossed ball hitting the ground",
        reps: "6 starts, full recovery between",
        minutes: 8,
        cues: "React, don't guess, first step forward never up",
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
        .map(
          (d) =>
            `${d.title}${d.needsWall ? " [wall]" : ""} (${d.reps} = ~${d.minutes} min): ${d.how}${d.cues ? `. Cues: ${d.cues}` : ""}`
        )
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
The player's TRAINING ENVIRONMENT line (in the user message) is a HARD
constraint. Wall drills (marked "wall" below) ONLY for players who HAVE a
wall; a goal only for players who HAVE a goal. If they lack it, the plan
simply doesn't include those drills; swap in ball-and-space work that trains
the same pillar (pass and chase, gate passing, weighted rolls). NEVER
prescribe furniture or improvised household equipment: no couch cushions,
chairs, mattresses, or anything that sounds like a hack. This is a
professional program; every drill must sound like it. Never prescribe a
net, ladder, rebounder machine, or a partner unless the coach's notes or
the player's profile explicitly mention them. If the coach mentions
equipment (e.g. "200 wall passes"), use exactly that, nothing more.
Cones or shoes as markers, gates, and targets are always fine.

The seven development pillars and how Strive coaches them (draw drills from here, adapted to the player's focus and level):
${pillars}`;
}

// Re-export so callers can rely on the canonical metric list too.
export const METHOD_PILLAR_NAMES = PROGRESS_METRICS;
