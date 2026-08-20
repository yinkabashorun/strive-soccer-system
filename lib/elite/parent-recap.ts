// The weekly parent recap — the retention engine.
//
// When a player's new week unlocks (Monday morning VA time), we assemble
// the TRUE numbers from the week that just ended — sessions completed,
// minutes, streak, the coach's parent note, the player's own check-in —
// and have Claude turn them into 2–3 warm, specific sentences for the
// parent. No AI available → a clean stats template sends instead. Facts
// only; the model never invents results.

import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "./supabase/server";
import { computeSummary } from "./data";
import type { Homework } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export type ParentRecap = {
  playerFirst: string;
  week: number;
  sessionsDone: number;
  sessionsTotal: number;
  minutes: number;
  streak: number;
  text: string; // the sentences that go to the parent
};

export async function buildParentRecap(
  playerId: string,
  week: number
): Promise<ParentRecap | null> {
  const admin = createServiceClient();
  if (!admin || week < 1) return null;

  const [{ data: player }, { data: hw }, { data: checkin }, { data: report }] =
    await Promise.all([
      admin
        .from("elite_players")
        .select("full_name")
        .eq("id", playerId)
        .maybeSingle(),
      admin
        .from("elite_homework")
        .select("*")
        .eq("player_id", playerId)
        .eq("week", week),
      admin
        .from("elite_checkins")
        .select("rating, went_well, struggled")
        .eq("player_id", playerId)
        .eq("week", week)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("elite_parent_reports")
        .select("improvement, next_focus")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!player || !hw || hw.length === 0) return null;
  const rows = hw as Homework[];

  // Sessions = (week, session) groups fully completed; minutes from
  // completed drills. Streak via the shared pure calculator.
  const bySession = new Map<number, boolean[]>();
  for (const h of rows) {
    const s = h.session ?? 1;
    bySession.set(s, [...(bySession.get(s) ?? []), h.completed]);
  }
  const sessionsTotal = bySession.size;
  const sessionsDone = [...bySession.values()].filter((a) =>
    a.every(Boolean)
  ).length;
  const minutes = rows
    .filter((h) => h.completed)
    .reduce((s, h) => s + (h.duration_min ?? 15), 0);
  const streak = computeSummary(rows).current_streak;

  const first = player.full_name.split(" ")[0];
  const stats = { playerFirst: first, week, sessionsDone, sessionsTotal, minutes, streak };

  // Honest fallback template — used when no API key or the call fails.
  const fallback =
    sessionsDone >= sessionsTotal
      ? `${first} completed all ${sessionsTotal} sessions this week — ${minutes} minutes of focused work${streak > 1 ? ` and a ${streak}-day streak` : ""}. The new training week is live now.`
      : `${first} completed ${sessionsDone} of ${sessionsTotal} sessions this week (${minutes} minutes trained). We'll pick the pace back up — the new week is live now.`;

  if (!process.env.ANTHROPIC_API_KEY) return { ...stats, text: fallback };

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const facts = [
      `Player first name: ${first}`,
      `Week ${week} results: completed ${sessionsDone} of ${sessionsTotal} sessions, ${minutes} minutes trained, current streak ${streak} days.`,
      report?.improvement ? `Coach's note on their development: ${report.improvement}` : "",
      report?.next_focus ? `Coming up next: ${report.next_focus}` : "",
      checkin?.went_well ? `Player said went well: ${checkin.went_well}` : "",
      checkin?.struggled ? `Player said they struggled with: ${checkin.struggled}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: `You write the weekly parent update for Strive Soccer FC, a premium
youth soccer development program. Voice: warm, confident, specific, plain
English. No emoji. No exclamation marks. Never corny.

Rules:
- 2 to 3 sentences, suitable for a text message.
- Use ONLY the facts provided. Never invent results, drills, or progress.
- Be honest about incomplete weeks — constructive, never guilt-tripping.
- Refer to the player by first name. End by noting the new week is live.
- Return ONLY the message text, no preamble.`,
      messages: [{ role: "user", content: facts }],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return { ...stats, text: text || fallback };
  } catch {
    return { ...stats, text: fallback };
  }
}
