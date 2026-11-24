// How a week was written, and why the backup wrote it when it did.
//
// A week is written by the plan writer (ai-coach.ts generatePlanFromNotes)
// from the player's notes. When the writer cannot be reached the week is
// still built, from filmed bank drills, by the backup (fallbackPlan): a
// pillar rotation with none of the player's notes in it. That is the right
// thing to do for one week and the wrong thing to do quietly.
//
// Nov 24 2026: every week built from Nov 7 on (24 plans, 3 Sunday builds)
// had been written by the backup, because the account behind the plan
// writer had run out of credits. Nothing said so: the builder threw the
// reason away and its card read "audit clean". Found only because every
// week's line read "Back to the pillars: ...".
//
// From here: the builder records which weeks the backup wrote and why, the
// summary says it, the Plan builder card shows it in red, the coach gets
// one text, and the issue STANDS on every later run until a week is
// written by the plan writer again. Pure, unit-tested
// (tests/plan-writer.test.ts). Coach-only words: nothing here reaches a
// player or a parent.
export type WriterFailure = "no_key" | "parse" | "api_error";

// The mark the standing check looks for in a run's summary.
export const BACKUP_MARK = "backup builder";

// Why the plan writer did not write the week, in words the coach can act on.
export function writerReason(kind: WriterFailure | undefined, detail: string | undefined): string {
  const d = (detail ?? "").toLowerCase();
  if (kind === "no_key") return "the plan writer has no key set in Vercel (ANTHROPIC_API_KEY)";
  if (d.includes("credit balance")) return "the Anthropic account is out of credits (console.anthropic.com, Plans & Billing)";
  if (d.includes("authentication") || d.includes("invalid x-api-key") || d.includes("401")) {
    return "the plan writer's key was refused (check ANTHROPIC_API_KEY in Vercel)";
  }
  if (d.includes("not_found") || d.includes("404")) return "the plan writer's model was not found (check ANTHROPIC_MODEL in Vercel)";
  if (d.includes("rate limit") || d.includes("429") || d.includes("overloaded") || d.includes("529")) {
    return "the plan writer was busy or rate limited";
  }
  if (kind === "parse") return "the plan came back unreadable twice";
  return `the plan writer could not be reached (${(detail ?? "unknown error").replace(/\s+/g, " ").slice(0, 90)})`;
}

export type BackupBuilt = { name: string; week: number; reason: string };

// "backup builder: Tim wk 5, Abdul wk 9 (the Anthropic account is out of credits ...)"
export function backupSummary(built: BackupBuilt[]): string {
  if (built.length === 0) return "";
  const who = built.map((b) => `${b.name.split(" ")[0]} wk ${b.week}`).join(", ");
  const reasons = [...new Set(built.map((b) => b.reason))].join("; ");
  return `${BACKUP_MARK}: ${who} (${reasons})`;
}

// The reason out of a stored summary, for the standing check.
export function backupReasonIn(summary: string | null | undefined): string | null {
  const s = summary ?? "";
  const at = s.indexOf(`${BACKUP_MARK}:`);
  if (at < 0) return null;
  const part = s.slice(at).split(" · ")[0];
  const open = part.indexOf("(");
  const close = part.lastIndexOf(")");
  return open > -1 && close > open ? part.slice(open + 1, close) : "the plan writer could not be reached";
}

// The line on the card and in the text.
export function backupIssue(reason: string): { name: string; issue: string } {
  return {
    name: "Plan writer",
    issue: `the latest weeks were put together by the backup builder, without the players' notes: ${reason}`,
  };
}
