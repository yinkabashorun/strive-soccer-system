// Strive Elite AI coaching engine.
//
// Turns a coach's plain-English session notes into a structured WEEKLY plan:
// four training sessions (each starting with a plyometric warm-up, added
// automatically), plus a parent update, player summary, progress updates,
// and next week's objectives. Uses Claude when ANTHROPIC_API_KEY is set;
// otherwise a deterministic fallback keeps it fully functional.

import Anthropic from "@anthropic-ai/sdk";
import {
  PROGRESS_METRICS,
  type GeneratedPlan,
  type GeneratedSession,
  type Player,
} from "./types";
import { SESSIONS_PER_WEEK, plyoForSession } from "./training";
import { METHOD_PILLARS, methodologyContext } from "./methodology";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let _client: Anthropic | null = null;
function client() {
  if (!isAnthropicConfigured()) return null;
  if (!_client)
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const SYSTEM = `You are the head of player development for Strive Soccer FC, a
premium youth soccer program.

${methodologyContext()}

A coach gives you raw notes from a 1-on-1 session. You turn them into a
structured WEEKLY at-home plan the player follows on their own, plus a warm,
clear update for the parent. Every plan MUST follow the Strive methodology above.

The week is FOUR sessions (the player trains four times that week). Each
session is about 40 MINUTES of work. A plyometric warm-up (~10 minutes) is
added to every session automatically, so give EXACTLY 3 skill drills per
session and size their minutes so the warm-up plus your three drills totals
about 40 minutes (roughly 10 minutes each). Focused drills, done with
intent. Do NOT include a warm-up; only give the 3 skill drills.

Voice:
- Confident, direct, encouraging. Never corny. No emoji. No exclamation marks.
- Parent update: warm and specific, celebrates real progress, plain English.
- Player summary: motivating, second person ("you"), short.
- Drills: concrete and doable solo with a ball and a small open space
  (driveway, backyard, garage, park), with clear rep counts a young player
  can follow on their own. Never prescribe furniture or improvised household
  equipment. Every drill must sound like it came from a professional program.
- These are competitive players. Nothing that would look out of place at an
  academy session: no jogging to collect, no remedial pace, no busywork.
  Frame every drill in game terms (cones are defenders, gaps are passing
  lanes, sprints chase real balls) and make the rep demand match a serious
  player's level.

The seven development pillars you may rate are exactly:
Ball Mastery, Weak Foot, Passing, Scanning, Decision Making, Confidence, Speed.

Return ONLY valid JSON, no prose, matching this shape:
{
  "weekly_focus": "one sentence, the single theme for the week",
  "sessions": [
    { "title": "Session 1: short label",
      "drills": [ { "title": "...", "exercise": "Setup first, one short sentence (what to lay out, e.g. 'Line of 5 cones a yard apart.'). Then the execution: exactly what to do, concrete and stepwise.", "reps": "real sets and reps like '3 x 20 each foot' or '4 x 45 sec', NEVER a bare duration", "minutes": 10, "notes": "2-3 key cues, short and punchy, like 'Sell the fake, drop the shoulder, explode out'" } ] }
  ],
  "parent_update": "2-4 sentences the coach can copy and paste directly into a text message to the parent. First person, the coach's voice ('I saw', 'this week I have him working on'). Refer to the player by first name. No greeting, no sign-off, no app jargon. It must read like a coach texting a parent, not a system summary.",
  "player_summary": "2-3 sentences to the player, second person",
  "progress_updates": [ { "metric": "Scanning", "value": 72 } ],
  "next_week_objectives": [ "objective 1", "objective 2", "objective 3" ]
}
Rules:
- EXACTLY 4 sessions. EXACTLY 3 skill drills each (no warm-ups; added
  automatically). Each session ~40 minutes total including the ~10-min warm-up.
- minutes: an integer per drill (8-15), so the three drills sum to ~30 minutes.
- TIMING MUST ADD UP. minutes = work time + rest between sets + setup, and the
  reps string must fill that time. 4 x 45 sec of work with 45 sec rests is
  6 minutes, not 10. If a drill is 10 minutes, prescribe enough sets to fill
  it (e.g. "6 x 60 sec on, 40 sec off") and bake the rest into the reps
  string. Short-burst speed work needs long recoveries spelled out
  ("8 sprints, walk back for full recovery"). Never pair a 3-minute
  prescription with a 10-minute drill.
- Every drill's exercise reads setup then execution, and every drill has
  notes with 2-3 key cues. A player should be able to run the drill from
  the card alone: what to set up, what to do, what to feel.
- progress_updates: only pillars the notes actually touched, value 0-100.
- next_week_objectives: 2-4 items.
- Write like a real coach texting his player: plain punctuation only. NEVER
  use an em dash (\u2014) anywhere. Use periods, commas, or colons instead.`;

function extractJSON<T>(raw: string): T | null {
  // Tolerates markdown fences (including an unclosed one from a truncated
  // response) and prose around the JSON; falls back to first-{ .. last-}.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  // Belt-and-suspenders: the prompt bans em dashes, but scrub any that slip
  // through so they never reach a player's screen.
  const body = (fenced ? fenced[1] : raw)
    .replace(/\s*—\s*/g, " - ")
    .trim();
  try {
    return JSON.parse(body) as T;
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function clampMin(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 10;
  return Math.max(5, Math.min(15, n));
}

// Normalizes to EXACTLY four sessions and prepends the plyometric warm-up to
// each one - the plyo-first rule holds no matter what the AI returned.
function buildSessions(
  raw: GeneratedSession[] | undefined,
  focus: string
): GeneratedSession[] {
  const src = Array.isArray(raw) ? raw : [];
  const out: GeneratedSession[] = [];
  for (let i = 0; i < SESSIONS_PER_WEEK; i++) {
    const s = src[i];
    // Three focused skill drills per session (a ~40-minute session with
    // the auto-added ~10-min warm-up).
    let skills = (s?.drills ?? [])
      .filter((d) => d && d.title)
      .slice(0, 3)
      .map((d) => {
        const rawReps = String(d.reps ?? "").trim();
        // The minutes chip already shows duration; a reps value that is
        // just "10 min" adds nothing, so drop it (the chip hides when empty).
        const reps = /^\d+\s*min(ute)?s?$/i.test(rawReps) ? "" : rawReps;
        return {
          title: String(d.title),
          exercise: String(d.exercise ?? ""),
          reps,
          minutes: clampMin(d.minutes),
          notes: d.notes ? String(d.notes) : undefined,
        };
      });
    if (skills.length === 0) {
      skills = [
        {
          title: "Focus block",
          exercise: focus,
          reps: "",
          minutes: 10,
          notes: undefined,
        },
      ];
    }
    // A session is always ~40 minutes: plyo + THREE drills. Pad a thin
    // session by re-applying its work at game speed, then at full detail.
    const PADS = [
      (t: string) =>
        `Repeat at game speed, tighter space, quicker decisions: ${t.toLowerCase()}`,
      (t: string) =>
        `Final block. Slow it down, perfect technique, max focus: ${t.toLowerCase()}`,
    ];
    let padIdx = 0;
    while (skills.length < 3 && padIdx < PADS.length) {
      skills.push({
        title: padIdx === 0 ? "Apply under pressure" : "Perfect the detail",
        exercise: PADS[padIdx](skills[0].title),
        reps: padIdx === 0 ? "Game speed" : "Slow + perfect",
        minutes: 10,
        notes: undefined,
      });
      padIdx++;
    }
    out.push({
      title: s?.title?.trim() || `Session ${i + 1}`,
      drills: [{ ...plyoForSession(i + 1) }, ...skills],
    });
  }
  return out;
}

function sanitize(plan: Partial<GeneratedPlan>, player?: Player): GeneratedPlan {
  const validMetrics = new Set(PROGRESS_METRICS as readonly string[]);
  const weekly_focus =
    plan.weekly_focus?.trim() || "Sharpen this week's technical focus";
  return {
    weekly_focus,
    sessions: buildSessions(plan.sessions, weekly_focus),
    parent_update:
      plan.parent_update?.trim() ||
      `${player?.full_name ?? "Your player"} put in strong work this session and has a clear four-session plan for the week ahead.`,
    player_summary:
      plan.player_summary?.trim() ||
      "Great session. Hit all four sessions this week, start each one with your plyometrics, and you'll feel the difference.",
    progress_updates: (plan.progress_updates ?? [])
      .filter((p) => p && validMetrics.has(p.metric))
      .map((p) => ({
        metric: p.metric,
        value: Math.max(0, Math.min(100, Math.round(Number(p.value) || 0))),
      })),
    next_week_objectives: (plan.next_week_objectives ?? [])
      .filter(Boolean)
      .slice(0, 4),
  };
}

function titleCase(s: string): string {
  const t = s.trim().replace(/[.:;]+$/, "");
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

// Deterministic fallback when the AI can't run. HARD RULE: nothing the
// coach typed may appear in any player-visible field — the notes are used
// ONLY to pick which pillars to train. Drills come verbatim from the
// Strive methodology library, so the week is generic but always real.
function fallbackPlan(notes: string, player?: Player): GeneratedPlan {
  const haystack = `${notes}\n${(player?.weaknesses ?? []).join("\n")}`.toLowerCase();
  const PILLAR_HINTS: [RegExp, (typeof PROGRESS_METRICS)[number]][] = [
    [/touch|control|mastery|dribbl/, "Ball Mastery"],
    [/scan|head up|shoulder|awareness/, "Scanning"],
    [/weak foot|left foot|right foot|both feet/, "Weak Foot"],
    [/pass/, "Passing"],
    [/decision|choice|pressure|composure/, "Decision Making"],
    [/confiden|brave|fear|1v1|take.?on/, "Confidence"],
    [/speed|quick|fast|explos|strong|stab|agil/, "Speed"],
  ];
  const picked: (typeof PROGRESS_METRICS)[number][] = [];
  for (const [re, pillar] of PILLAR_HINTS) {
    // Passing is wall-only: a player with no wall trains it in coached
    // sessions, so the pillar never becomes an at-home day for them.
    if (pillar === "Passing" && player?.has_wall !== true) continue;
    if (re.test(haystack) && !picked.includes(pillar)) picked.push(pillar);
  }
  for (const fill of [
    "Ball Mastery",
    "Scanning",
    "Decision Making",
    "Confidence",
  ] as const) {
    if (picked.length >= SESSIONS_PER_WEEK) break;
    if (!picked.includes(fill)) picked.push(fill);
  }
  const pillars = picked.slice(0, SESSIONS_PER_WEEK);

  // One pillar per session, three library drills each (cycling if short).
  // Wall drills only go to players who told us they have a wall.
  const sessions: GeneratedSession[] = pillars.map((pillar) => {
    const guide = METHOD_PILLARS.find((g) => g.pillar === pillar);
    const library = (guide?.drills ?? []).filter(
      (d) => !d.needsWall || player?.has_wall === true
    );
    const drills = Array.from({ length: 3 }, (_, d) => {
      const src = library[d % Math.max(1, library.length)];
      return {
        title: src?.title ?? `${pillar} drill`,
        exercise: src?.how ?? "Focused reps, full intent",
        reps: src?.reps ?? "3 x 10",
        minutes: src?.minutes ?? 10,
        notes: src?.cues,
      };
    });
    return { title: `${pillar} day`, drills };
  });

  const names = pillars.map((p) => p.toLowerCase());
  const focus = `Back to the pillars: ${names.join(", ")}`;

  return sanitize(
    {
      weekly_focus: focus,
      sessions,
      parent_update: `I've built ${player?.full_name?.split(" ")[0] ?? "your player"}'s full training week: four at-home sessions built on ${names.join(", ")}, each opening with a plyometric warm-up. It's all in the app, and I'll be watching what gets completed.`,
      player_summary:
        "Four sessions this week. Start each one with your plyometrics and attack every rep.",
      progress_updates: [],
      next_week_objectives: [
        "Complete all four sessions",
        `Sharpen ${names[0]}`,
        "Start every session with the plyo warm-up",
      ],
    },
    player
  );
}

export async function generatePlanFromNotes(
  notes: string,
  player?: Player,
  memory?: string
): Promise<{
  plan: GeneratedPlan;
  source: "ai" | "fallback";
  reason?: string; // human-readable cause shown to the coach
  reasonKind?: "no_key" | "parse" | "api_error"; // drives the banner's advice
}> {
  const c = client();
  if (!c)
    return {
      plan: fallbackPlan(notes, player),
      source: "fallback",
      reason: "no_key",
      reasonKind: "no_key",
    };

  try {
    // What this player can actually train with. Unknown (pre-019 intake)
    // is treated as having neither, so drills always make sense.
    const env = player
      ? `TRAINING ENVIRONMENT (hard constraint): ${
          player.has_wall
            ? "HAS a wall to pass against (garage door, brick wall, or fence). Rebound and wall-passing drills are allowed."
            : "NO wall available. NEVER prescribe rebound, wall-pass, or wall-return drills of any kind. Passing cannot be trained properly solo without a wall, so do NOT build passing-focused drills or sessions for this player. Train other pillars; their passing work happens in coached sessions."
        } ${
          player.has_goal
            ? "HAS a goal to shoot at. Finishing drills at a real goal are allowed."
            : "NO goal available. Never prescribe shooting at a goal or net; strikes go at a target like a cone, a shoe, or a fence line."
        }`
      : "";
    const context = player
      ? `Player: ${player.full_name}, age ${player.age}, ${player.position}, level ${player.level}. Current goals: ${player.goals.join("; ") || "n/a"}. Known weaknesses: ${player.weaknesses.join("; ") || "n/a"}.\n${env}`
      : "";
    const memoryBlock = memory?.trim() ? `\n\n${memory.trim()}` : "";
    const userMsg = `${context}${memoryBlock}\n\nCoach's raw session notes:\n"""\n${notes}\n"""\n\nUsing everything you know about this player above, generate the four-session weekly plan JSON now. Plan around their history, follow-through, trends, and the coach's note.`;

    // One attempt at a given output cap, with enough logging that a parse
    // failure is diagnosable from Vercel logs instead of guessed at.
    const attempt = async (maxTokens: number) => {
      const res = await c.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      });
      const text = res.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();
      console.log(
        `[strive-ai] model=${res.model} stop_reason=${res.stop_reason} max_tokens=${maxTokens} output_chars=${text.length}`
      );
      console.log(`[strive-ai] head: ${text.slice(0, 500)}`);
      console.log(`[strive-ai] tail: ${text.slice(-500)}`);
      return { stop: res.stop_reason, text };
    };

    let { stop, text } = await attempt(4096);
    let parsed = extractJSON<Partial<GeneratedPlan>>(text);
    if (!parsed || stop === "max_tokens") {
      // Truncated or malformed: one retry with double the room.
      console.log("[strive-ai] retrying: parse failed or hit max_tokens");
      ({ stop, text } = await attempt(8192));
      parsed = extractJSON<Partial<GeneratedPlan>>(text);
    }
    if (!parsed)
      return {
        plan: fallbackPlan(notes, player),
        source: "fallback",
        reason:
          stop === "max_tokens"
            ? "The plan came back longer than the output limit twice and got cut off. Trim the notes a little and generate again."
            : "The AI responded but the plan could not be read. Generate again; if it repeats, check the Vercel logs for [strive-ai] lines.",
        reasonKind: "parse",
      };
    return { plan: sanitize(parsed, player), source: "ai" };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message.slice(0, 200) : "unknown error";
    console.log(`[strive-ai] api error: ${msg}`);
    return {
      plan: fallbackPlan(notes, player),
      source: "fallback",
      reason: msg,
      reasonKind: "api_error",
    };
  }
}
