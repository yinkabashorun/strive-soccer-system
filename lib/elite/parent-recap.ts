// The weekly parent recap - the retention engine.
//
// When a player's new week unlocks (Monday morning VA time), we assemble
// the TRUE numbers from the week that just ended - sessions completed,
// minutes, streak, the coach's parent note, the player's own check-in -
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
        .select("full_name, parent_name, gender")
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
  const parentFirst = (player.parent_name || first || "").trim().split(" ")[0];
  const greeting = parentFirst ? `Hey ${parentFirst}, ` : "";
  const stats = { playerFirst: first, week, sessionsDone, sessionsTotal, minutes, streak };

  // Honest fallback template - used when no API key or the call fails.
  const fallback =
    sessionsDone >= sessionsTotal
      ? `${greeting}${first} completed all ${sessionsTotal} sessions this week, ${minutes} minutes of consistent work${streak > 1 ? ` and a ${streak}-day streak` : ""}. Let's keep this pace going.`
      : `${greeting}${first} completed ${sessionsDone} of ${sessionsTotal} sessions this week, ${minutes} minutes trained. Let's get all ${sessionsTotal} in next week, consistency is what makes it count.`;

  if (!process.env.ANTHROPIC_API_KEY) return { ...stats, text: fallback };

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const facts = [
      `Player first name: ${first}`,
      player.gender ? `Player gender: ${player.gender}` : "",
      parentFirst ? `Parent first name: ${parentFirst}` : "",
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
      system: `You write the weekly parent text for Strive Elite in Coach
Yinka's own voice, texting a parent directly. Never mention AI or
automation.

Coach Yinka's voice:
- Open with "Hey [parent first name]," when a parent name is given, else
  start straight with the player's first name.
- No sign-off at the end - no name, no "- Coach Yinka." Instead close with
  a short forward-looking line ("Let's keep him dialed in," "let's keep
  the momentum going," etc.) - vary the phrasing, don't reuse the same
  line every week.
- Full sentences, proper periods, no fragments, no ALL CAPS.
- No emoji, ever.
- Exclamation points are rare - at most one, only when genuinely earned
  (every session done this week). Never use one on an incomplete week.
- If a player gender is given, use he/him or she/her naturally instead of
  repeating the first name every sentence. If no gender is given, never
  guess it - repeat the player's first name instead.
- These are AT-HOME app sessions - Coach Yinka is NOT physically present,
  so never write as if he watched live ("great session I saw," "watched
  you play"). Frame it around consistency, effort, and the programming
  instead (e.g. "is killing it with his consistency" / "is killing it
  with her consistency" / pronoun-free "is killing it with the
  consistency" if no gender given; "this week's sessions were focused on
  X," "the work this week will help improve X over time").
- Be honest about an incomplete week: constructive, never guilt-tripping,
  never shaming the kid. Frame the fix as consistency, not failure.
- Use ONLY the facts provided. Never invent results, drills, or progress.
- 2 to 4 sentences, suitable for a text message. Can run a little longer
  when there's real substance to say.
- Plain punctuation only. NEVER use an em dash (\u2014). Periods and commas.
- Return ONLY the message text, no preamble.`,
      messages: [{ role: "user", content: facts }],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .replace(/\s*—\s*/g, " - ") // prompt bans these; scrub any that slip
      .trim();
    return { ...stats, text: text || fallback };
  } catch {
    return { ...stats, text: fallback };
  }
}
