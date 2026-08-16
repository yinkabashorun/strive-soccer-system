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
structured WEEKLY at-home plan the player follows on their own, plus a warm,
clear update for the parent.

The week is FOUR sessions (the player trains four times that week). Each
session is about ONE HOUR of work. A plyometric warm-up (~10 minutes) is added
to every session automatically, so give EXACTLY 2 skill drills per session and
size their minutes so the warm-up plus your two drills totals about 60 minutes
(roughly 25 minutes each). Fewer, deeper drills — not a long list. Do NOT
include a warm-up; only give the 2 skill drills.

Voice:
- Confident, direct, encouraging. Never corny. No emoji. No exclamation marks.
- Parent update: warm and specific, celebrates real progress, plain English.
- Player summary: motivating, second person ("you"), short.
- Drills: concrete, room- or yard-doable, with clear rep counts a young player
  can follow on their own.

The seven development pillars you may rate are exactly:
Ball Mastery, Weak Foot, Passing, Scanning, Decision Making, Confidence, Speed.

Return ONLY valid JSON, no prose, matching this shape:
{
  "weekly_focus": "one sentence, the single theme for the week",
  "sessions": [
    { "title": "Session 1 — short label",
      "drills": [ { "title": "...", "exercise": "...", "reps": "...", "minutes": 15, "notes": "..." } ] }
  ],
  "parent_update": "2-4 sentences for the parent",
  "player_summary": "2-3 sentences to the player, second person",
  "progress_updates": [ { "metric": "Scanning", "value": 72 } ],
  "next_week_objectives": [ "objective 1", "objective 2", "objective 3" ]
}
Rules:
- EXACTLY 4 sessions. EXACTLY 2 skill drills each (no warm-ups — added
  automatically). Each session ~60 minutes total including the ~10-min warm-up.
- minutes: an integer per drill (15-40), so the two drills sum to ~50 minutes.
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

function clampMin(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 25;
  return Math.max(10, Math.min(40, n));
}

// Normalizes to EXACTLY four sessions and prepends the plyometric warm-up to
// each one — the plyo-first rule holds no matter what the AI returned.
function buildSessions(
  raw: GeneratedSession[] | undefined,
  focus: string
): GeneratedSession[] {
  const src = Array.isArray(raw) ? raw : [];
  const out: GeneratedSession[] = [];
  for (let i = 0; i < SESSIONS_PER_WEEK; i++) {
    const s = src[i];
    // Two focused skill drills per session (a ~1-hour session with the
    // auto-added ~10-min warm-up).
    let skills = (s?.drills ?? [])
      .filter((d) => d && d.title)
      .slice(0, 2)
      .map((d) => ({
        title: String(d.title),
        exercise: String(d.exercise ?? ""),
        reps: String(d.reps ?? ""),
        minutes: clampMin(d.minutes),
        notes: d.notes ? String(d.notes) : undefined,
      }));
    if (skills.length === 0) {
      skills = [
        {
          title: "Focus block",
          exercise: focus,
          reps: "25 min",
          minutes: 25,
          notes: undefined,
        },
        {
          title: "Apply under pressure",
          exercise: `Repeat the focus at game speed: ${focus}`,
          reps: "25 min",
          minutes: 25,
          notes: undefined,
        },
      ];
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
      "Great session. Hit all four sessions this week — start each one with your plyometrics — and you'll feel the difference.",
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

// Deterministic fallback so the feature works with no API key: parse skill
// drills from the notes and spread them across four sessions.
function fallbackPlan(notes: string, player?: Player): GeneratedPlan {
  const hwSplit = notes.split(/homework\s*:/i);
  const coachingText = hwSplit[0];
  const homeworkText = hwSplit.slice(1).join("\n");

  const sentences = coachingText
    .split(/\n|(?<=[.!?])\s+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rawHwItems = (homeworkText || coachingText)
    .split(/\n|,(?![^(]*\))/)
    .map((l) => l.replace(/^[-*•\d.\s]+/, "").trim())
    .filter((l) => l.length > 2);

  const skillDrills = (
    homeworkText
      ? rawHwItems
      : rawHwItems.filter((l) =>
          /\b(\d+|watch|practice|work on|drill|reps|passes|finishes|touches|study)\b/i.test(
            l
          )
        )
  )
    .slice(0, 8)
    .map((l, i) => {
      const repMatch = l.match(/\b\d+[\s\w]*/);
      const title = titleCase(
        l.replace(/\b\d+[\s\w]*(passes|reps|finishes|touches|strikes)?/i, "").trim()
      );
      return {
        title: title.slice(0, 52) || `Focus drill ${i + 1}`,
        exercise: titleCase(l),
        reps: repMatch ? repMatch[0].trim() : "25 min",
        minutes: 25,
      };
    });

  const focus = titleCase(sentences[0] ?? "").slice(0, 120) ||
    "This week's technical focus";

  // spread the drills round-robin across four sessions
  const buckets: GeneratedSession[] = Array.from(
    { length: SESSIONS_PER_WEEK },
    (_, i) => ({ title: `Session ${i + 1}`, drills: [] })
  );
  skillDrills.forEach((d, i) => buckets[i % SESSIONS_PER_WEEK].drills.push(d));

  const touched: GeneratedPlan["progress_updates"] = [];
  const lower = notes.toLowerCase();
  const bump = (metric: (typeof PROGRESS_METRICS)[number], base: number) =>
    touched.push({ metric, value: base });
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
      sessions: buckets,
      parent_update: `${player?.full_name ?? "Your player"} had a productive session focused on ${focus.toLowerCase()}. We've built a four-session week — each session opens with a plyometric warm-up — and will track the progress closely.`,
      player_summary: `Good work this session. Get all four sessions in this week, and always start with your plyometrics.`,
      progress_updates: touched,
      next_week_objectives: [
        "Complete all four sessions",
        focus,
        "Start every session with the plyometric warm-up",
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
      max_tokens: 2200,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `${context}\n\nCoach's raw session notes:\n"""\n${notes}\n"""\n\nGenerate the four-session weekly plan JSON now.`,
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
