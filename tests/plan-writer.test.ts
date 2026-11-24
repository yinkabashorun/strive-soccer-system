import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BACKUP_MARK, backupIssue, backupReasonIn, backupSummary, writerReason } from "@/lib/elite/plan-writer";

// Nov 24 2026: every week built from Nov 7 on had been written by the
// backup (a pillar rotation, none of the player's notes) because the
// account behind the plan writer was out of credits, and nothing said so.
// These hold the rule that the backup never writes a week quietly again.
describe("why the plan writer did not write a week", () => {
  it("says an empty account in words the coach can act on", () => {
    const real =
      '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}';
    expect(writerReason("api_error", real)).toBe("the Anthropic account is out of credits (console.anthropic.com, Plans & Billing)");
  });
  it("names the other causes", () => {
    expect(writerReason("no_key", undefined)).toContain("ANTHROPIC_API_KEY");
    expect(writerReason("api_error", "401 authentication_error")).toContain("refused");
    expect(writerReason("api_error", "404 not_found_error: model")).toContain("ANTHROPIC_MODEL");
    expect(writerReason("api_error", "529 overloaded_error")).toContain("busy");
    expect(writerReason("parse", "The AI responded but the plan could not be read.")).toBe("the plan came back unreadable twice");
    expect(writerReason("api_error", "socket hang up")).toBe("the plan writer could not be reached (socket hang up)");
  });
});

describe("a run that the backup built for", () => {
  const reason = writerReason("api_error", "Your credit balance is too low");
  const built = [
    { name: "Tim Kovalev", week: 5, reason },
    { name: "Abdul Rahim", week: 9, reason },
  ];
  it("says who, which week and why in the run's summary", () => {
    expect(backupSummary(built)).toBe(`${BACKUP_MARK}: Tim wk 5, Abdul wk 9 (${reason})`);
    expect(backupSummary([])).toBe("");
  });
  it("the reason can be read back out of a stored summary, so the issue stands on later runs", () => {
    const summary = `built Tim wk 5, Abdul wk 9 · 6 already built · ${backupSummary(built)} · audit clean`;
    expect(backupReasonIn(summary)).toBe(reason);
    expect(backupReasonIn("built Tim wk 5 · audit clean")).toBeNull();
    expect(backupReasonIn(null)).toBeNull();
  });
  it("is a line on the Plan builder card and in the coach's text", () => {
    const issue = backupIssue(reason);
    expect(issue.name).toBe("Plan writer");
    expect(issue.issue).toContain("backup builder");
    expect(issue.issue).toContain("out of credits");
  });
});

describe("the builder never throws the reason away", () => {
  const src = readFileSync(path.resolve(__dirname, "../lib/elite/auto-plan.ts"), "utf8");
  it("keeps how each week was written, and puts it on the result", () => {
    expect(src).toContain('written.source === "fallback" ? writerReason(written.reasonKind, written.reason) : undefined');
    expect(src).toContain("...(backup ? { backup } : {})");
    expect(src).not.toMatch(/const \{ plan \} = await generatePlanFromNotes\(/);
  });
  it("says it in the summary and raises it as an issue that stands until the plan writer writes again", () => {
    expect(src).toContain("backupSummary(backupsIn(o)),");
    expect(src).toContain("const backup = await standingBackupIssue(outcome, admin);");
    expect(src).toContain("if (backup) issues = [...issues, backup];");
    expect(src).toContain("if (o.built > 0 || !admin) return null;");
  });
});
