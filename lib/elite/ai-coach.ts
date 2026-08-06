// Strive Elite AI coaching engine.
//
// Turns a coach's plain-English session notes into a structured development
// plan: weekly focus, homework checklist, parent update, player summary,
// progress updates, and next week's objectives. Uses Claude when
// ANTHROPIC_API_KEY is set; otherwise a deterministic fallback keeps the
// feature fully functional offline / in demo mode.

import Anthropic from "@anthropic-ai/sdk";
import { PROGRESS_METRICS, type GeneratedPlan, type Player } from "./types";

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
premium youth soccer program. Your philosophy: creative, intelligent football —
ball mastery, composure under pressure, scanning, slowing the game down.

A coach gives you raw notes from a 1-on-1 session. You turn them into a
structured weekly development plan for the player and a warm, clear update for
the parent.

Voice:
- Confident, direct, encouraging. Never corny. No emoji. No exclamation marks.
- Parent update: warm and specific, celebrates real progress, plain English.
- Player summary: motivating, second person ("you"), short.
- Homework: concrete drills with clear rep counts a young player can follow.

The seven development pillars you may rate are exactly:
Ball Mastery, Weak Foot, Passing, Scanning, Decision Making, Confidence, Speed.

Return ONLY valid JSON, no prose, matching this shape:
{
  "weekly_focus": "one sentence, the single theme for the week",
  "homework": [ { "title": "...", "exercise": "...", "reps": "...", "notes": "..." } ],
  "parent_update": "2-4 sentences for the parent",
  "player_summary": "2-3 sentences to the player, second person",
  "progress_updates": [ { "metric": "Scanning", "value": 72 } ],
  "next_week_objectives": [ "objective 1", "objective 2", "objective 3" ]
}
Rules:
- 3 to 5 homework items.
- progress_updates: only pillars the notes actually touched, value 0-100.
- next_week_objectives: 2-4 items.`;

function extractJSON<T>(raw: string): T | null {
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
      } catch {
        return null;
      }
    }
    return null;
  }
}

function sanitize(plan: Partial<GeneratedPlan>, player?: Player): GeneratedPlan {
  const validMetrics = new Set(PROGRESS_METRICS as readonly string[]);
  return {
    weekly_focus:
      plan.weekly_focus?.trim() || "Sharpen this week's technical focus",
    homework: (plan.homework ?? [])
      .filter((h) => h && h.title)
      .slice(0, 5)
      .map((h) => ({
        title: String(h.title),
        exercise: String(h.exercise ?? ""),
        reps: String(h.reps ?? ""),
        notes: h.notes ? String(h.notes) : undefined,
      })),
    parent_update:
      plan.parent_update?.trim() ||
      `${player?.full_name ?? "Your player"} put in strong work this session and has a clear plan for the week ahead.`,
    player_summary:
      plan.player_summary?.trim() ||
      "Great session. Stay on the homework this week and you'll feel the difference.",
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

// Deterministic fallback: light heuristic parse of the coach's notes so the
// feature works with no API key.
function titleCase(s: string): string {
  const t = s.trim().replace(/[.:;]+$/, "");
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

function fallbackPlan(notes: string, player?: Player): GeneratedPlan {
  // Split the notes into a "coaching" part and an explicit homework part
  // when the coach used a "Homework:" heading (common in the product).
  const hwSplit = notes.split(/homework\s*:/i);
  const coachingText = hwSplit[0];
  const homeworkText = hwSplit.slice(1).join("\n");

  const sentences = coachingText
    .split(/\n|(?<=[.!?])\s+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Homework items: split the homework section on newlines / commas.
  const rawHwItems = (homeworkText || coachingText)
    .split(/\n|,(?![^(]*\))/)
    .map((l) => l.replace(/^[-*•\d.\s]+/, "").trim())
    .filter((l) => l.length > 2);

  const homework = (
    homeworkText
      ? rawHwItems
      : rawHwItems.filter((l) =>
          /\b(\d+|watch|practice|work on|drill|reps|passes|finishes|touches|study)\b/i.test(
            l
          )
        )
  )
    .slice(0, 5)
    .map((l, i) => {
      const repMatch = l.match(/\b\d+[\s\w]*/);
      const title = titleCase(
        l.replace(/\b\d+[\s\w]*(passes|reps|finishes|touches|strikes)?/i, "").trim()
      );
      return {
        title: title.slice(0, 52) || `Focus drill ${i + 1}`,
        exercise: titleCase(l),
        reps: repMatch ? repMatch[0].trim() : "10-15 min",
      };
    });

  if (homework.length === 0) {
    homework.push({
      title: "Session focus reps",
      exercise: titleCase(sentences[0] ?? "Repeat this session's key drill"),
      reps: "15 min daily",
    });
  }

  const focus = titleCase(sentences[0] ?? "").slice(0, 120) ||
    "This week's technical focus";
  const touched: GeneratedPlan["progress_updates"] = [];
  const lower = notes.toLowerCase();
  const bump = (metric: (typeof PROGRESS_METRICS)[number], base: number) => {
    touched.push({ metric, value: base });
  };
  if (/scan/.test(lower)) bump("Scanning", 70);
  if (/weak foot|left foot|right foot/.test(lower)) bump("Weak Foot", 58);
  if (/pass/.test(lower)) bump("Passing", 74);
  if (/touch|control|mastery|dribbl/.test(lower)) bump("Ball Mastery", 78);
  if (/decision|choice|pressure/.test(lower)) bump("Decision Making", 68);
  if (/confiden|brave|fear/.test(lower)) bump("Confidence", 76);
  if (/speed|quick|fast|explos/.test(lower)) bump("Speed", 72);

  return sanitize(
    {
      weekly_focus: focus,
      homework,
      parent_update: `${player?.full_name ?? "Your player"} had a productive session focused on ${focus.toLowerCase()}. We've set clear homework for the week and will track the progress closely.`,
      player_summary: `Good work this session. Lock in on your homework — ${homework[0]?.title.toLowerCase() ?? "the basics"} — and you'll see the jump.`,
      progress_updates: touched,
      next_week_objectives: [
        "Complete all assigned homework",
        focus,
        "Bring the same intensity to the next session",
      ],
    },
    player
  );
}

export async function generatePlanFromNotes(
  notes: string,
  player?: Player
): Promise<{ plan: GeneratedPlan; source: "ai" | "fallback" }> {
  const c = client();
  if (!c) return { plan: fallbackPlan(notes, player), source: "fallback" };

  try {
    const context = player
      ? `Player: ${player.full_name}, age ${player.age}, ${player.position}, level ${player.level}. Current goals: ${player.goals.join("; ") || "n/a"}. Known weaknesses: ${player.weaknesses.join("; ") || "n/a"}.`
      : "";
    const res = await c.messages.create({
      model: MODEL,
      max_tokens: 1600,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `${context}\n\nCoach's raw session notes:\n"""\n${notes}\n"""\n\nGenerate the plan JSON now.`,
        },
      ],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const parsed = extractJSON<Partial<GeneratedPlan>>(text);
    if (!parsed) return { plan: fallbackPlan(notes, player), source: "fallback" };
    return { plan: sanitize(parsed, player), source: "ai" };
  } catch {
    return { plan: fallbackPlan(notes, player), source: "fallback" };
  }
}
