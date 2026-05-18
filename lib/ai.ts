// AI content generation for Strive Soccer.
//
// When ANTHROPIC_API_KEY is set we call Claude with a Strive-tuned system
// prompt. Without a key we fall back to curated, on-brand templates so the
// engine still works offline and the UI never breaks.

import Anthropic from "@anthropic-ai/sdk";

export type Pillar =
  | "Ball Mastery"
  | "Mindset"
  | "Behind the Scenes"
  | "Player Spotlight"
  | "Education";

export const PILLARS: Pillar[] = [
  "Ball Mastery",
  "Mindset",
  "Behind the Scenes",
  "Player Spotlight",
  "Education",
];

export type Idea = {
  pillar: Pillar;
  title: string;
  hook: string;
  script: string;
  caption: string;
  voiceover: string;
  creatorPitch: string;
};

const STRIVE_SYSTEM = `You are the head of content for Strive Soccer — a premium youth soccer
training brand. The philosophy: creative, intelligent football over robotic
drills. Ball mastery, composure under pressure, scanning, slowing the game
down. The flagship product is a $67 Ball Mastery course.

Voice rules:
- Direct, confident, never corny. No exclamation marks. No emoji.
- Short sentences. Earn every word.
- Sound like a coach who's been around real players, not a marketer.
- No clichés like "level up" or "game changer".
- Premium feel — sport-luxury, not bargain.

Pillars and their angle:
- Ball Mastery: technical, the boring reps that build elite players.
- Mindset: composure, IQ, scanning, slowing the game down.
- Behind the Scenes: real training, unfiltered.
- Player Spotlight: kids you'd remember, framed with respect.
- Education: parent-facing, the why behind the method.

Output is for TikTok / Instagram Reels — 15-30 seconds.`;

const FALLBACK_HOOKS: Record<Pillar, string[]> = {
  "Ball Mastery": [
    "If you can't do this — you're not training, you're guessing.",
    "Most kids skip this. Then wonder why they freeze under pressure.",
    "Three touches that separate good from elite.",
    "Watch how the ball never leaves his foot.",
    "Stop kicking. Start manipulating.",
  ],
  Mindset: [
    "The fastest player isn't the one running the most.",
    "Slow players win. Here's the proof.",
    "Football IQ beats speed every single time.",
    "Composure is taught. Panic is also taught.",
  ],
  "Behind the Scenes": [
    "This is what real training looks like.",
    "No cone-tapping. No fluff. Just reps.",
    "5am. Empty pitch. 1,000 touches.",
  ],
  "Player Spotlight": [
    "He's 11. Watch how he sets this up.",
    "She's 13. Composure most adults don't have.",
    "Remember this name.",
  ],
  Education: [
    "Five minutes a day. Thirty days. Results no parent will believe.",
    "The 1% habit that builds pros.",
    "The first touch decides everything else.",
  ],
};

const FALLBACK_CAPTIONS: Record<Pillar, string[]> = {
  "Ball Mastery": [
    "Master the basics or get exposed. #ballmastery #strivesoccer",
    "Touches before tricks. Always.",
  ],
  Mindset: [
    "Composure over chaos. Slow the game down.",
    "Think faster. Move slower.",
  ],
  "Behind the Scenes": [
    "Real reps under real pressure. No fluff.",
    "This is the work no one posts.",
  ],
  "Player Spotlight": [
    "Remember this name.",
    "This is what four months of Strive looks like.",
  ],
  Education: [
    "Five minutes a day. Thirty days. Comment METHOD for the link.",
    "Save this. Train it. Become unrecognizable.",
  ],
};

const FALLBACK_SCRIPTS: Record<Pillar, string> = {
  "Ball Mastery": `[0-2s] Slow-mo of a perfect first touch.
[2-4s] Cut to a kid losing the ball in chaos.
[4-7s] VO: "Most players skip the basics."
[7-12s] Three rapid drill demos — snappy cuts.
[12-15s] CTA: Link in bio for the Ball Mastery course.`,
  Mindset: `[0-2s] Fast game footage, suddenly slows to 25%.
[2-5s] On-screen text: "Speed isn't fast. Decisions are."
[5-10s] VO over training cuts — the principle.
[10-14s] Coach piece-to-camera, one line.
[14-15s] CTA card.`,
  "Behind the Scenes": `[0-2s] Empty pitch, sunrise, single ball.
[2-6s] Cuts of coach setting up — natural sound.
[6-12s] Players arrive, hugs, first reps.
[12-15s] Title card + CTA.`,
  "Player Spotlight": `[0-2s] Player's best move in slow-mo.
[2-5s] Name, age, one sentence about them.
[5-12s] Three highlight clips — escalating.
[12-15s] Coach quote + CTA.`,
  Education: `[0-2s] Question hook, on-screen text.
[2-5s] Answer setup with one visual.
[5-12s] Step-by-step breakdown.
[12-15s] CTA to the method.`,
};

const FALLBACK_VOICEOVERS: Record<Pillar, string> = {
  "Ball Mastery":
    "Most players skip the basics. They want the highlight, not the habit. But the player who masters their first touch decides every play before it even starts. Slow it down. Cushion the ball. Scan before you receive. The unsexy reps are the ones that change everything.",
  Mindset:
    "Speed isn't running fast. Speed is deciding fast. The best players in the world don't move quicker. They think quicker. They've seen the picture before the ball arrives. That's not talent. That's training.",
  "Behind the Scenes":
    "5am. Empty pitch. One ball. This is the part no one posts. The thousand touches before anyone is watching. The reps that turn into reflexes. This is the work.",
  "Player Spotlight":
    "Watch closely. She's thirteen. She's already playing two passes ahead. That's not luck. That's a year of obsession. Composure under pressure. Touch before turn. This is what Strive looks like.",
  Education:
    "Five minutes. Every day. Thirty days. That's all it takes to change the trajectory of a player. Not an hour. Not a fancy academy. Five minutes of deliberate, intentional touches. The compound effect is real.",
};

const FALLBACK_PITCHES: Record<Pillar, string> = {
  "Ball Mastery":
    "Hey — if your kid plays soccer and you've been wondering why their first touch isn't getting better, look. I just finished the Strive Ball Mastery course. Sixty-seven bucks. Five minutes a day. My son's coach pulled me aside last week to ask what we changed. Link's right here.",
  Mindset:
    "My kid used to panic every time he got the ball. Strive's Ball Mastery course flipped a switch. Now he scans before he receives. He's slower on his feet — and faster than everyone else on the field. Sixty-seven dollars.",
  "Behind the Scenes":
    "I drove past Strive training at 6am this week. Empty field, one coach, twelve kids, a thousand touches. That's the program. The course brings it home. Link below.",
  "Player Spotlight":
    "Remember the kid who joined four months ago and couldn't trap a ball? She just made the regional team. Strive Ball Mastery course. Sixty-seven dollars. Run it.",
  Education:
    "Parents — five minutes a day. Thirty days. That's the whole pitch. Strive's Ball Mastery course. Sixty-seven dollars. Better than another camp you'll forget.",
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let _client: Anthropic | null = null;
function client() {
  if (!isAnthropicConfigured()) return null;
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

async function callClaude(userPrompt: string): Promise<string> {
  const c = client();
  if (!c) throw new Error("no_anthropic");
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: STRIVE_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });
  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  return text;
}

function fallbackIdea(pillar: Pillar): Idea {
  const hook = pick(FALLBACK_HOOKS[pillar]);
  return {
    pillar,
    title: hook,
    hook,
    script: FALLBACK_SCRIPTS[pillar],
    caption: pick(FALLBACK_CAPTIONS[pillar]),
    voiceover: FALLBACK_VOICEOVERS[pillar],
    creatorPitch: FALLBACK_PITCHES[pillar],
  };
}

function parseJSON<T>(raw: string): T | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  try {
    return JSON.parse(body) as T;
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1)) as T;
      } catch {}
    }
    return null;
  }
}

export async function generateIdea(pillar: Pillar): Promise<Idea> {
  if (!isAnthropicConfigured()) return fallbackIdea(pillar);
  try {
    const raw = await callClaude(
      `Generate one TikTok/Reel concept for the "${pillar}" pillar.
Return JSON with these exact keys: title, hook, script, caption, voiceover, creatorPitch.

- title: 3-7 words, internal label.
- hook: the spoken/written hook in the first 2 seconds. One sentence.
- script: timestamped beat sheet for a 15-second video. Use [0-2s] etc.
- caption: the social caption, under 220 chars, no more than 2 hashtags.
- voiceover: the spoken voiceover, 30-50 words, conversational.
- creatorPitch: a 30-second UGC creator script promoting the $67 Ball Mastery course. First person, parent or older athlete tone, casual handheld feel.

Return only the JSON.`,
    );
    const parsed = parseJSON<Omit<Idea, "pillar">>(raw);
    if (!parsed) return fallbackIdea(pillar);
    return { pillar, ...parsed };
  } catch {
    return fallbackIdea(pillar);
  }
}

export async function generateIdeaFeed(count = 5): Promise<Idea[]> {
  if (!isAnthropicConfigured()) {
    return PILLARS.slice(0, count).map(fallbackIdea);
  }
  try {
    const raw = await callClaude(
      `Generate ${count} distinct TikTok/Reel ideas for Strive Soccer.
Spread them across pillars (Ball Mastery, Mindset, Behind the Scenes, Player Spotlight, Education).
Return a JSON array. Each element: { pillar, title, hook, script, caption, voiceover, creatorPitch }.
- pillar: one of the five pillars exactly.
- hook: one sentence.
- script: timestamped 15s beat sheet.
- caption: under 220 chars, max 2 hashtags.
- voiceover: 30-50 words.
- creatorPitch: 30s UGC script promoting the $67 Ball Mastery course, first person, casual.
Return only the JSON array.`,
    );
    const parsed = parseJSON<Idea[]>(raw);
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return PILLARS.slice(0, count).map(fallbackIdea);
    }
    return parsed.filter((i) => PILLARS.includes(i.pillar)).slice(0, count);
  } catch {
    return PILLARS.slice(0, count).map(fallbackIdea);
  }
}

export async function generateHook(pillar: Pillar): Promise<string> {
  if (!isAnthropicConfigured()) return pick(FALLBACK_HOOKS[pillar]);
  try {
    const raw = await callClaude(
      `Give me one hook for a "${pillar}" TikTok. One sentence. No quotes around it. No emoji. No exclamation marks.`,
    );
    return raw.replace(/^["']|["']$/g, "").trim() || pick(FALLBACK_HOOKS[pillar]);
  } catch {
    return pick(FALLBACK_HOOKS[pillar]);
  }
}

export async function generateCaption(pillar: Pillar): Promise<string> {
  if (!isAnthropicConfigured()) return pick(FALLBACK_CAPTIONS[pillar]);
  try {
    const raw = await callClaude(
      `Write one social caption for a "${pillar}" Strive Soccer post. Under 220 characters. At most 2 hashtags. No emoji. Return only the caption.`,
    );
    return raw.trim() || pick(FALLBACK_CAPTIONS[pillar]);
  } catch {
    return pick(FALLBACK_CAPTIONS[pillar]);
  }
}

export async function generateScript(pillar: Pillar): Promise<string> {
  if (!isAnthropicConfigured()) return FALLBACK_SCRIPTS[pillar];
  try {
    const raw = await callClaude(
      `Write a 15-second TikTok beat sheet for a "${pillar}" Strive Soccer post. Use timestamps like [0-2s]. 4-5 beats. End with a CTA to the Ball Mastery course. Return only the beat sheet.`,
    );
    return raw.trim() || FALLBACK_SCRIPTS[pillar];
  } catch {
    return FALLBACK_SCRIPTS[pillar];
  }
}

export async function generateVoiceover(pillar: Pillar): Promise<string> {
  if (!isAnthropicConfigured()) return FALLBACK_VOICEOVERS[pillar];
  try {
    const raw = await callClaude(
      `Write a 30-50 word voiceover for a "${pillar}" Strive Soccer Reel. Conversational, confident, no emoji. Return only the voiceover.`,
    );
    return raw.trim() || FALLBACK_VOICEOVERS[pillar];
  } catch {
    return FALLBACK_VOICEOVERS[pillar];
  }
}

export async function generateCreatorPitch(pillar: Pillar): Promise<string> {
  if (!isAnthropicConfigured()) return FALLBACK_PITCHES[pillar];
  try {
    const raw = await callClaude(
      `Write a 30-second UGC creator script promoting Strive Soccer's $67 Ball Mastery course. Frame it through the "${pillar}" pillar. First person, casual handheld phone tone, parent or older athlete. End with "link in bio" or similar. Return only the script.`,
    );
    return raw.trim() || FALLBACK_PITCHES[pillar];
  } catch {
    return FALLBACK_PITCHES[pillar];
  }
}
