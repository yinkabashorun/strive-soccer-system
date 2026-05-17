import { NextResponse } from "next/server";
import { isAnthropicConfigured } from "@/lib/ai";
import { isElevenLabsConfigured } from "@/lib/elevenlabs";
import { isHiggsfieldConfigured } from "@/lib/higgsfield";
import { isGHLConfigured } from "@/lib/ghl";
import { getAutopilotState, nextScheduledRun } from "@/lib/autopilot-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = getAutopilotState();
  const configured = {
    anthropic: isAnthropicConfigured(),
    elevenlabs: isElevenLabsConfigured(),
    higgsfield: isHiggsfieldConfigured(),
    ghl: isGHLConfigured(),
  };
  const fullyAutonomous = Object.values(configured).every(Boolean);
  return NextResponse.json({
    fullyAutonomous,
    configured,
    nextRun: nextScheduledRun(),
    inFlight: state.inFlight,
    startedAt: state.startedAt,
    lastRun: state.lastRun
      ? {
          startedAt: state.lastRun.startedAt,
          finishedAt: state.lastRun.finishedAt,
          totals: state.lastRun.totals,
          produced: state.lastRun.produced,
        }
      : null,
  });
}
