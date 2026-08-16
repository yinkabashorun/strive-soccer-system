import { NextResponse } from "next/server";
import { getViewer } from "@/lib/elite/session";
import { getPlayer } from "@/lib/elite/data";
import { generatePlanFromNotes } from "@/lib/elite/ai-coach";
import { buildPlayerMemory } from "@/lib/elite/memory";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  // real history, not just the notes. Best-effort — never blocks generation.
  let memory = "";
  if (player) {
    try {
      memory = await buildPlayerMemory(player);
    } catch {
      memory = "";
    }
  }

  const { plan, source } = await generatePlanFromNotes(notes, player, memory);
  return NextResponse.json({ plan, source });
}
