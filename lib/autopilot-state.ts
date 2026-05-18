// In-process autopilot status cache.
//
// Survives within a running server instance so the UI can read the last
// run without a database. In production wire this to Supabase if you want
// persistence across cold starts. Best-effort by design — the truth of
// what's scheduled lives in GoHighLevel.

import type { AutopilotRunResult } from "./autopilot";

type State = {
  lastRun?: AutopilotRunResult;
  inFlight: boolean;
  startedAt?: string;
};

const g = globalThis as unknown as { __striveAutopilot?: State };
if (!g.__striveAutopilot) g.__striveAutopilot = { inFlight: false };

export function getAutopilotState(): State {
  return g.__striveAutopilot!;
}

export function markAutopilotStart() {
  g.__striveAutopilot!.inFlight = true;
  g.__striveAutopilot!.startedAt = new Date().toISOString();
}

export function markAutopilotFinish(result: AutopilotRunResult) {
  g.__striveAutopilot!.lastRun = result;
  g.__striveAutopilot!.inFlight = false;
}

export function markAutopilotError() {
  g.__striveAutopilot!.inFlight = false;
}

// Best guess at the next cron run. The actual schedule is in vercel.json
// (daily). If you change the cron, change this too.
export function nextScheduledRun(): string {
  const d = new Date();
  d.setUTCHours(8, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
