import type { AdAsset, AdGoal, AdPillar } from "./types";

/**
 * AI content strategist for Strive Soccer.
 *
 * This module turns a one-line idea (or "auto-pick" mode) into a full ad
 * blueprint — hook, script, caption, CTA, video prompt, and voiceover script.
 *
 * Today these are deterministic templates seeded by brand pillars. When the
 * Anthropic / OpenAI key is wired (see /api/ai/generate), replace
 * `synthesizeAd()` with a streaming LLM call using the prompt builder below.
 */

const BRAND = {
  name: "Strive Soccer",
  founder: "Yinka Bashorun",
  voice:
    "Direct, energetic, expert-tier. Speaks to soccer parents and players ages 11–15. " +
    "Hormozi on offers — make saying no feel stupid. Andy Elliott on closes. " +
    "No fluff. Every post drives toward a booking, a course buy, or a follow.",
  url: "strivesoccer100x.com",
  ig: "@strivesoccerfc",
  hookFormulas: [
    "If you can't do this — you're not training, you're guessing.",
    "Most {audience} skip this. Here's why they freeze.",
    "{number} {things} most {audience} get wrong.",
    "She's {age}. Watch how she sets this up.",
    "The fastest player isn't the one running the most.",
    "Pros don't do different things. They do the same things — every day.",
  ],
  ctas: {
    "Lead-gen":
      "DM 'TRAINING' for the summer schedule — spots cap at 6 per group.",
    Brand: "Follow @strivesoccerfc — new drill every day.",
    Course: "Link in bio: 30-Day Dribbling Masterclass · $60.",
    Camp: "Camp July 21–23 with DC United coach. Comment 'CAMP' to lock a spot.",
    Booking:
      "Comment 'TRAINING' or visit strivesoccer100x.com — sessions start May 20.",
  },
} as const;

const PILLAR_TEMPLATES: Record<
  AdPillar,
  { hooks: string[]; angles: string[]; visuals: string[] }
> = {
  "Ball Mastery": {
    hooks: [
      "3 touches most kids skip — and why they freeze under pressure.",
      "If your first touch isn't this, you're already losing the duel.",
      "200 touches a day. 30 days. Watch what happens.",
    ],
    angles: [
      "demonstrate the wrong way → cut to the right way → 3 drills + rep count",
      "slow-mo of pro's touch → side-by-side amateur → what changed",
      "200-touch wall drill walkthrough → before/after of a 12-yr-old who did it",
    ],
    visuals: [
      "tight close-up on cleats touching ball, golden-hour pitch, anamorphic flare",
      "wide of empty pitch fading to player working alone at sunset, slow zoom",
      "split-screen: pro receiving vs amateur receiving, freeze-frame on touch",
    ],
  },
  Mindset: {
    hooks: [
      "The fastest player isn't the one running the most.",
      "Pros don't do different things. They do the same things — every day.",
      "Slow the game down. Think before you receive.",
    ],
    angles: [
      "myth-bust speed = winning → 3 examples of composure beating chaos",
      "1% habit talk: same drills every day, compounding over a season",
      "scan-every-2-seconds rule → demonstrate with overhead drone footage",
    ],
    visuals: [
      "POV from midfielder scanning, overlay arrows showing decisions, kinetic typography",
      "training-ground time-lapse, sweat, focus, one player working alone",
      "drone overhead of game showing space opening before the player sees it",
    ],
  },
  "Behind the Scenes": {
    hooks: [
      "This is what real training looks like — no cone tapping.",
      "Inside a Strive session — what 60 minutes actually buys you.",
      "Coach Yinka, 18, runs the most-talked-about youth sessions in NoVA.",
    ],
    angles: [
      "session b-roll → quick athlete interview → CTA",
      "founder origin: quit college soccer for this — here's why",
      "Coach Gonzalo cameo for credibility, then session footage",
    ],
    visuals: [
      "handheld doc-style of session warmup, dust kicks, kids running drills",
      "founder talking-head intercut with action — interview lighting, log+grade",
      "Gonzalo + Yinka on sideline, golden hour, candid coaching",
    ],
  },
  "Player Spotlight": {
    hooks: [
      "She's 13. Watch how she sets this up.",
      "Before / after — 30 days of Strive.",
      "This is what 12 sessions does to a 10-year-old.",
    ],
    angles: [
      "player intro → signature move → before/after montage → parent testimonial",
      "speed/accuracy stats over 30 days → highlight reel → CTA",
      "kid demonstrates one move slowly → game-speed clip → coaching call-out",
    ],
    visuals: [
      "warm cinematic close-up of player, name lower-third, signature move slow-mo",
      "split frame: 'Day 1' vs 'Day 30' on same drill, gritty grade",
      "overhead drone tracking a single player through traffic",
    ],
  },
  Education: {
    hooks: [
      "5 minutes a day for 30 days. Results no parent will believe.",
      "Why every parent gets first-touch training wrong.",
      "The 3-rule scanning framework pros use every match.",
    ],
    angles: [
      "step-by-step framework → on-screen demo → save-and-share CTA",
      "parent-targeted myth-bust → expert (Gonzalo or Yinka) explains correct rep",
      "course teaser: pull one lesson from 30-Day Dribbling Masterclass",
    ],
    visuals: [
      "whiteboard-meets-pitch: numbered captions overlay on player demoing",
      "Yinka talking to camera, B-roll of drills, info-graphic overlays",
      "course UI cutaway over player working through the lesson",
    ],
  },
  Offer: {
    hooks: [
      "Summer 2026: 60 spots. We're at 20.",
      "Development Pack: 10 sessions for $319. Camp + privates inside.",
      "$40 for a drop-in is the most expensive thing you'll buy this summer.",
    ],
    angles: [
      "price stack: drop-in vs pack vs Strive value — math on screen",
      "scarcity: spot counter on screen, urgency line, comment-to-claim",
      "objection handling: too expensive → it's less than last year's drop-in rate",
    ],
    visuals: [
      "kinetic typography over session b-roll, accent yellow highlights, ticker tape feel",
      "spot-counter UI animating down, pitch background, ominous-but-hopeful score",
      "split: dollar bills vs game-day photo — value comparison",
    ],
  },
};

const PILLAR_ROTATION: AdPillar[] = [
  "Ball Mastery",
  "Player Spotlight",
  "Mindset",
  "Offer",
  "Education",
  "Behind the Scenes",
  "Ball Mastery",
];

/**
 * Auto-pick a pillar based on day-of-year (deterministic rotation).
 * Mondays = Ball Mastery, etc — keeps the brand on track without random drift.
 */
export function pickPillar(d: Date = new Date()): AdPillar {
  const dow = d.getUTCDay();
  return PILLAR_ROTATION[dow] ?? "Ball Mastery";
}

export function pickGoal(d: Date = new Date()): AdGoal {
  // 5 days lead-gen, 1 day brand, 1 day course
  const dow = d.getUTCDay();
  if (dow === 0) return "Brand";
  if (dow === 6) return "Course";
  return "Lead-gen";
}

const rng = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (n: number) => h % n;
};

/**
 * Build the master LLM prompt for the AI strategist. Swap into
 * /api/ai/generate when ANTHROPIC_API_KEY is set.
 */
export function buildStrategistPrompt({
  idea,
  pillar,
  goal,
}: {
  idea: string;
  pillar: AdPillar;
  goal: AdGoal;
}) {
  return `You are the AI head of marketing for ${BRAND.name} (${BRAND.url}, ${BRAND.ig}).
Voice: ${BRAND.voice}

Task: turn the idea below into a full TikTok-ready short-form ad. Output strict JSON:
{
  "hook": "≤15 words, scroll-stopping, opens the first 2 seconds",
  "script": "30-second script with [0-2s] [2-5s] [5-15s] [15-25s] [25-30s] timestamps",
  "caption": "≤220 chars, 3–5 hashtags, soft CTA",
  "cta": "explicit close — what action, by when",
  "videoPrompt": "single paragraph cinematic visual brief for text-to-video model (Higgsfield). Include shot type, lens, lighting, motion, mood.",
  "voiceoverScript": "exact words to be read by AI voice, max 28 seconds at 165wpm",
  "viralityScore": 0-100 estimate based on hook strength, novelty, emotion, and pattern interrupt",
  "viralityNotes": "1 sentence — what would push it higher"
}

Pillar: ${pillar}
Goal: ${goal}
Idea: ${idea || "(auto-pick — surprise me, but stay on pillar)"}
CTA library to draw from: ${BRAND.ctas[goal]}

Rules:
- No emojis in the hook.
- Don't use the word "elevate" or "level up" — banned.
- The script must reference a real Strive Soccer offering (Development Pack $319, Oscar camp, 30-Day Dribbling Masterclass, etc).
- Speak to the parent OR the player, never both in one ad.`;
}

/**
 * Synthesize an AdAsset locally (no LLM call). Used as a fallback and as the
 * shape contract for the live LLM response. Deterministic per (idea, pillar, goal).
 */
export function synthesizeAd({
  idea,
  pillar,
  goal,
  platform = "TikTok",
}: {
  idea: string;
  pillar?: AdPillar;
  goal?: AdGoal;
  platform?: AdAsset["platform"];
}): AdAsset {
  const now = new Date();
  const p = pillar ?? pickPillar(now);
  const g = goal ?? pickGoal(now);
  const tpl = PILLAR_TEMPLATES[p];
  const seed = `${idea}|${p}|${g}`;
  const pick = rng(seed);
  const hook = idea
    ? hookFromIdea(idea)
    : tpl.hooks[pick(tpl.hooks.length)];
  const angle = tpl.angles[pick(tpl.angles.length)];
  const visual = tpl.visuals[pick(tpl.visuals.length)];

  const script = buildScript({ hook, angle, goal: g });
  const voiceoverScript = stripDirections(script);
  const cta = BRAND.ctas[g];
  const caption = buildCaption(hook, p);
  const videoPrompt = buildVideoPrompt(visual, p);
  const viralityScore = scoreVirality(hook, idea, p);

  return {
    id: `ad_${Date.now().toString(36)}_${pick(0xffff).toString(36)}`,
    idea: idea || `${p} · auto-pick · ${now.toISOString().slice(0, 10)}`,
    pillar: p,
    goal: g,
    hook,
    script,
    caption,
    cta,
    videoPrompt,
    voiceoverScript,
    voiceoverModel: "elevenlabs/eleven_turbo_v2_5",
    videoModel: "higgsfield/v1-fast",
    durationSec: 28,
    status: "queued",
    createdAt: now.toISOString(),
    platform,
    viralityScore,
    viralityNotes: viralityNoteFor(viralityScore),
  };
}

function hookFromIdea(idea: string): string {
  const s = idea.trim().replace(/[.!?]+$/, "");
  if (s.length > 80) return s.slice(0, 78) + "…";
  return s;
}

function buildScript({
  hook,
  angle,
  goal,
}: {
  hook: string;
  angle: string;
  goal: AdGoal;
}) {
  return `[0–2s] Cold open: "${hook}"
[2–5s] Pattern interrupt — visual flip / counter-example.
[5–15s] ${angle}. Cut every 1.2s. Captions on.
[15–25s] Proof beat — Coach Yinka or a Strive player demonstrating the rep at game-speed.
[25–30s] CTA card: "${BRAND.ctas[goal]}" Logo + URL hold for 1s.`;
}

function stripDirections(script: string) {
  return script
    .split("\n")
    .map((line) =>
      line.replace(/^\[[^\]]+\]\s*/, "").replace(/^[A-Z][a-z]+: /, ""),
    )
    .filter(Boolean)
    .join(" ")
    .replace(/Cut every 1\.2s\.|Captions on\.|Logo \+ URL hold for 1s\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCaption(hook: string, p: AdPillar) {
  const tags: Record<AdPillar, string> = {
    "Ball Mastery": "#ballmastery #soccertraining #youthsoccer",
    Mindset: "#footballiq #mindset #strivesoccer",
    "Behind the Scenes": "#strivesoccer #coachlife #youthsoccer",
    "Player Spotlight": "#playerspotlight #soccerkids #strivesoccer",
    Education: "#soccerdrills #soccercoach #youthdevelopment",
    Offer: "#soccertraining #summersoccer #strivesoccer",
  };
  return `${hook} ${tags[p]}`.slice(0, 220);
}

function buildVideoPrompt(visual: string, p: AdPillar) {
  return `Cinematic short-form ad shot for ${BRAND.name}. ${visual}. Color grade: contrasty, slightly green-shadowed, accent yellow (#E5FF3D) in titles. Pillar: ${p}. Aspect 9:16. Length 28s. Camera moves are confident, never shaky. Energetic but premium. Avoid generic stock-soccer cliches.`;
}

function scoreVirality(hook: string, idea: string, p: AdPillar): number {
  // Heuristic — gives an honest-feeling number without calling out to a model.
  let score = 50;
  if (hook.length >= 30 && hook.length <= 70) score += 8;
  if (/\?$/.test(hook) === false && /[.!]$/.test(hook)) score += 4;
  if (/\d/.test(hook)) score += 6; // numbers
  if (/most|why|how|secret|wrong|skip/i.test(hook)) score += 6;
  if (p === "Player Spotlight" || p === "Offer") score += 4;
  if (idea && idea.length > 0) score += 4;
  return Math.max(20, Math.min(96, score));
}

function viralityNoteFor(s: number) {
  if (s >= 85) return "Strong hook + pillar fit. Ship as-is.";
  if (s >= 70) return "Solid. Tighten the first 2 seconds for upside.";
  if (s >= 55) return "Average — try a sharper hook or a stronger pattern interrupt.";
  return "Weak. Reroll with a different idea or pillar.";
}
