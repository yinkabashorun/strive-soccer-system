// Content generator templates that align with the Strive Soccer philosophy:
// creative, intelligent football over robotic training.
//
// Designed to slot in front of a real LLM (Claude / OpenAI) later — the
// generate() functions return the same shape an LLM call would, so the UI
// doesn't change when the backend swaps. For now they pull from curated banks
// so the engine works offline and feels on-brand from day one.

export type Pillar =
  | "Ball Mastery"
  | "Mindset"
  | "Behind the Scenes"
  | "Player Spotlight"
  | "Education";

const HOOKS: Record<Pillar, string[]> = {
  "Ball Mastery": [
    "If you can't do this — you're not training, you're guessing.",
    "Most kids skip this. Then wonder why they freeze under pressure.",
    "3 touches that separate good from elite.",
    "Watch how the ball never leaves his foot.",
    "Stop kicking. Start manipulating.",
  ],
  Mindset: [
    "The fastest player isn't the one running the most.",
    "Slow players win. Here's the proof.",
    "Football IQ beats speed every single time.",
    "Pros don't do different things. They do the same things — every day.",
    "Composure is taught. Panic is also taught.",
  ],
  "Behind the Scenes": [
    "This is what real training looks like.",
    "No cone-tapping. No fluff. Just reps.",
    "5am. Empty pitch. 1,000 touches.",
    "Inside a Strive session — unfiltered.",
  ],
  "Player Spotlight": [
    "He's 11. Watch how he sets this up.",
    "She's 13. Composure most adults don't have.",
    "Remember this name.",
    "This is what 4 months of Strive looks like.",
  ],
  Education: [
    "5 minutes a day. 30 days. Results no parent will believe.",
    "The 1% habit that builds pros.",
    "Why every great player was once obsessed.",
    "The first touch decides everything else.",
  ],
};

const SCRIPT_BEATS: Record<Pillar, string[]> = {
  "Ball Mastery": [
    "[0-2s] Slow-mo of a perfect first touch.",
    "[2-4s] Cut to a kid losing the ball in chaos.",
    "[4-7s] VO: 'Most players skip the basics.'",
    "[7-12s] Three rapid drill demos — snappy cuts.",
    "[12-15s] CTA: Link in bio for the full method.",
  ],
  Mindset: [
    "[0-2s] Fast game footage, suddenly slows to 25%.",
    "[2-5s] On-screen text: 'Speed isn't fast. Decisions are.'",
    "[5-10s] VO over training cuts — the principle.",
    "[10-14s] Coach piece-to-camera, one line.",
    "[14-15s] CTA card.",
  ],
  "Behind the Scenes": [
    "[0-2s] Empty pitch, sunrise, single ball.",
    "[2-6s] Cuts of coach setting up — natural sound.",
    "[6-12s] Players arrive, hugs, first reps.",
    "[12-15s] Title card + CTA.",
  ],
  "Player Spotlight": [
    "[0-2s] Player's best move in slow-mo.",
    "[2-5s] Name, age, one sentence about them.",
    "[5-12s] 3 highlight clips — escalating.",
    "[12-15s] Coach quote + CTA.",
  ],
  Education: [
    "[0-2s] Question hook, on-screen text.",
    "[2-5s] Answer setup with one visual.",
    "[5-12s] Step-by-step breakdown.",
    "[12-15s] CTA to the method.",
  ],
};

const CAPTIONS: Record<Pillar, string[]> = {
  "Ball Mastery": [
    "Master the basics or get exposed. #ballmastery #strivesoccer",
    "Touches before tricks. Always. #soccertraining",
    "The boring reps build the unforgettable players.",
  ],
  Mindset: [
    "Composure > chaos. Slow the game down. #footballiq",
    "Think faster. Move slower. #strivesoccer",
    "Pros are obsessed. That's the secret.",
  ],
  "Behind the Scenes": [
    "Real reps under real pressure. No fluff.",
    "This is the work no one posts.",
    "Inside the lab. #strivesoccer",
  ],
  "Player Spotlight": [
    "Remember this name. 🎯 #strivesoccer",
    "Composure is taught. Creativity is unlocked.",
    "This is what 4 months of Strive looks like.",
  ],
  Education: [
    "5 minutes a day. 30 days. Comment 'METHOD' for the link.",
    "Save this. Train it. Become unrecognizable.",
    "Share this with a parent who needs to see it.",
  ],
};

const VOICEOVER_TEMPLATES: Record<Pillar, string> = {
  "Ball Mastery":
    "Most players skip the basics. They want the highlight, not the habit. But the truth is — the player who masters their first touch decides every play before it even starts. Slow it down. Cushion the ball. Scan before you receive. The unsexy reps are the ones that change everything.",
  Mindset:
    "Speed isn't running fast. Speed is deciding fast. The best players in the world don't move quicker — they think quicker. They've seen the picture before the ball arrives. That's not talent. That's training. Slow your body. Speed up your mind.",
  "Behind the Scenes":
    "5am. Empty pitch. One ball. This is the part no one posts — and it's the part that builds everything. The 1,000 touches before anyone is watching. The reps that turn into reflexes. This is the work.",
  "Player Spotlight":
    "Watch closely. She's 13. She's already playing two passes ahead. That's not luck — that's a year of obsession. Composure under pressure. Touch before turn. Scan, breathe, execute. This is what Strive looks like.",
  Education:
    "Five minutes. Every day. Thirty days. That's all it takes to change the trajectory of a player. Not an hour. Not a fancy academy. Five minutes of intentional, deliberate touches — daily. The compound effect is real. Start tonight.",
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateHook(pillar: Pillar): string {
  return pick(HOOKS[pillar]);
}

export function generateCaption(pillar: Pillar): string {
  return pick(CAPTIONS[pillar]);
}

export function generateScript(pillar: Pillar): string {
  return SCRIPT_BEATS[pillar].join("\n");
}

export function generateVoiceover(pillar: Pillar): string {
  return VOICEOVER_TEMPLATES[pillar];
}

export function generateIdea(pillar: Pillar) {
  return {
    pillar,
    hook: generateHook(pillar),
    caption: generateCaption(pillar),
    script: generateScript(pillar),
    voiceover: generateVoiceover(pillar),
  };
}

export const PILLARS: Pillar[] = [
  "Ball Mastery",
  "Mindset",
  "Behind the Scenes",
  "Player Spotlight",
  "Education",
];
