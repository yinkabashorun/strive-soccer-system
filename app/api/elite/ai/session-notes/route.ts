import { NextResponse } from "next/server";
import { getViewer } from "@/lib/elite/session";
import { getDrillBank, getPlayer } from "@/lib/elite/data";
import { generatePlanFromNotes } from "@/lib/elite/ai-coach";
import { buildPlayerMemory } from "@/lib/elite/memory";

export const runtime = "nodejs";
// Long enough for a full generation plus one parse-failure retry.
export const maxDuration = 120;

// POST { playerId, notes } -> structured GeneratedPlan. Coach-only.
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "player") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { playerId?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const notes = (body.notes ?? "").trim();
  if (notes.length < 4) {
    return NextResponse.json({ error: "notes_required" }, { status: 400 });
  }

  const player = body.playerId
    ? (await getPlayer(body.playerId)) ?? undefined
    : undefined;

  // Assemble the player's training memory so the AI plans around their
  // real history, not just the notes. Best-effort - never blocks generation.
  let memory = "";
  if (player) {
    try {
      memory = await buildPlayerMemory(player);
    } catch {
      memory = "";
    }
  }

  // The coach's drill bank: generation composes strictly from it (falls
  // back to the built-in library pre-020). Video-having drills only - a
  // drill added but not yet filmed should never reach a real player.
  const { drills } = await getDrillBank({ onlyWithVideo: true });

  const { plan, source, reason, reasonKind } = await generatePlanFromNotes(
    notes,
    player,
    memory,
    drills
  );
  return NextResponse.json({ plan, source, reason, reasonKind });
}
