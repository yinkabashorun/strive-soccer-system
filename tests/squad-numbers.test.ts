import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  calendarWeek,
  fmtCount,
  fmtWait,
  NOT_STARTED_DAYS,
  QUIET_DAYS,
  squadNumbers,
  type NumbersPlayer,
  type NumbersRow,
} from "@/lib/elite/squad-numbers";

// The seven numbers on the coach dashboard (Nov 24 2026): counted from
// drills ticked off, progress clips and the membership, never estimated.

const TODAY = "2026-11-24"; // a Tuesday
// noon New York on a given date
const at = (day: string) => `${day}T17:00:00.000Z`;

function session(week: number, n: number, done: number, total = 4, when: string | null = null, extra = false): NumbersRow[] {
  return Array.from({ length: total }, (_, i) => ({
    week,
    session: n,
    is_extra: extra,
    completed: i < done,
    completed_at: i < done ? when : null,
  }));
}

function player(over: Partial<NumbersPlayer>): NumbersPlayer {
  return {
    id: over.name ?? "p",
    name: "Sam Example",
    member: true,
    tier: "elite",
    startDay: "2026-11-23",
    liveWeek: 1,
    onBreak: false,
    rows: [],
    clipWeeks: [],
    ...over,
  };
}

describe("the first week", () => {
  it("counts who started, who finished a session and who finished a week", () => {
    const fresh = player({ name: "Fresh One", startDay: "2026-11-23", rows: session(1, 1, 0) });
    const started = player({ name: "Started Two", rows: session(1, 1, 2, 4, at("2026-11-23")) });
    const oneSession = player({ name: "Session Three", rows: [...session(1, 1, 4, 4, at("2026-11-24")), ...session(1, 2, 0)] });
    const wholeWeek = player({
      name: "Week Four",
      startDay: "2026-11-16",
      liveWeek: 2,
      rows: [...session(1, 1, 4, 4, at("2026-11-16")), ...session(1, 2, 4, 4, at("2026-11-18")), ...session(2, 1, 0)],
    });
    const n = squadNumbers([fresh, started, oneSession, wholeWeek], TODAY);
    expect(n.members).toBe(4);
    expect(n.started).toMatchObject({ n: 3, of: 4 });
    expect(n.firstSession).toEqual({ n: 2, of: 4 });
    // only one of them is past week 1, and that one finished it
    expect(n.firstWeek).toEqual({ n: 1, of: 1 });
  });

  it("the typical wait is a real player's, in days from their week going live", () => {
    const sameDay = player({ name: "A A", startDay: "2026-11-16", rows: session(1, 1, 1, 4, at("2026-11-16")) });
    const twoDays = player({ name: "B B", startDay: "2026-11-16", rows: session(1, 1, 1, 4, at("2026-11-18")) });
    const fiveDays = player({ name: "C C", startDay: "2026-11-16", rows: session(1, 1, 1, 4, at("2026-11-21")) });
    expect(squadNumbers([sameDay, twoDays, fiveDays], TODAY).started.typicalDays).toBe(2);
    expect(squadNumbers([sameDay, twoDays], TODAY).started.typicalDays).toBe(0); // the lower middle
    expect(squadNumbers([player({})], TODAY).started.typicalDays).toBeNull();
  });

  it("an extra session is not needed for a whole week, and unfinished plan work is", () => {
    const withExtra = player({
      liveWeek: 2,
      startDay: "2026-11-16",
      rows: [...session(1, 1, 4, 4, at("2026-11-17")), ...session(1, 2, 0, 3, null, true)],
    });
    expect(squadNumbers([withExtra], TODAY).firstWeek).toEqual({ n: 1, of: 1 });
    const short = player({ liveWeek: 2, startDay: "2026-11-16", rows: [...session(1, 1, 4, 4, at("2026-11-17")), ...session(1, 2, 3)] });
    expect(squadNumbers([short], TODAY).firstWeek).toEqual({ n: 0, of: 1 });
  });

  it("a player whose first week has not begun is not counted as late", () => {
    const next = player({ startDay: "2026-11-30" });
    const n = squadNumbers([next], TODAY);
    expect(n.started).toMatchObject({ n: 0, of: 0 });
    expect(n.flags).toEqual([]);
  });
});

describe("every week", () => {
  it("counts this week's planned sessions and leaves a break out of both sides", () => {
    const a = player({
      name: "A A",
      startDay: "2026-11-09",
      liveWeek: 3,
      rows: [...session(3, 1, 4, 4, at("2026-11-23")), ...session(3, 2, 2, 4, at("2026-11-24")), ...session(3, 3, 0), ...session(3, 4, 0)],
    });
    const resting = player({ name: "B B", startDay: "2026-11-09", liveWeek: 3, onBreak: true, rows: session(3, 1, 0) });
    const n = squadNumbers([a, resting], TODAY);
    expect(n.thisWeekSessions).toEqual({ n: 1, of: 4 });
    expect(n.thisWeekPlayers).toEqual({ n: 1, of: 1 });
    expect(n.flags.map((f) => f.name)).not.toContain("B B"); // a resting player is never flagged
  });

  it("an extra session this week adds no planned session", () => {
    const a = player({ rows: [...session(1, 1, 4, 4, at("2026-11-23")), ...session(1, 5, 3, 3, at("2026-11-24"), true)] });
    expect(squadNumbers([a], TODAY).thisWeekSessions).toEqual({ n: 1, of: 1 });
  });

  it("weeks trained is weeks with any training, out of weeks had", () => {
    const a = player({
      startDay: "2026-11-02",
      liveWeek: 4,
      rows: [...session(1, 1, 1, 4, at("2026-11-03")), ...session(3, 1, 4, 4, at("2026-11-17")), ...session(4, 1, 0)],
    });
    const b = player({ startDay: "2026-11-23", liveWeek: 1, rows: session(1, 1, 1, 4, at("2026-11-23")) });
    expect(squadNumbers([a, b], TODAY).weeksTrained).toEqual({ n: 3, of: 5 });
  });

  it("proof needs two clips, a membership that has them, and three weeks", () => {
    const two = player({ name: "A A", startDay: "2026-11-02", liveWeek: 4, clipWeeks: [1, 2] });
    const one = player({ name: "B B", startDay: "2026-11-02", liveWeek: 4, clipWeeks: [1, 1] });
    const tooNew = player({ name: "C C", startDay: "2026-11-16", liveWeek: 2, clipWeeks: [1] });
    const pro = player({ name: "D D", tier: "pro", startDay: "2026-11-02", liveWeek: 4 });
    expect(squadNumbers([two, one, tooNew, pro], TODAY).proof).toEqual({ n: 1, of: 2 });
  });

  it("still a member is counted from everyone who started that long ago", () => {
    const stayed12 = player({ name: "A A", startDay: "2026-08-31", liveWeek: 13 });
    const left = player({ name: "B B", member: false, startDay: "2026-08-17", liveWeek: 15 });
    const stayed5 = player({ name: "C C", startDay: "2026-10-26", liveWeek: 5 });
    const fresh = player({ name: "D D", startDay: "2026-11-23", liveWeek: 1 });
    const n = squadNumbers([stayed12, left, stayed5, fresh], TODAY);
    expect(n.members).toBe(3);
    expect(n.staying).toEqual([
      { week: 4, n: 2, of: 3 },
      { week: 8, n: 1, of: 2 },
      { week: 12, n: 1, of: 2 },
    ]);
    expect(calendarWeek("2026-11-23", TODAY)).toBe(1);
    expect(calendarWeek("2026-11-16", TODAY)).toBe(2);
    expect(calendarWeek("2026-08-31", TODAY)).toBe(13);
  });
});

describe("who to look at", () => {
  it("names the player who has not started, the quiet one and the one with no clip, in that order", () => {
    const notStarted = player({ id: "1", name: "Nia Start", startDay: "2026-11-16", liveWeek: 2, rows: session(1, 1, 0) });
    const quiet = player({ id: "2", name: "Quinn Quiet", startDay: "2026-11-02", liveWeek: 4, clipWeeks: [1], rows: session(1, 1, 4, 4, at("2026-11-10")) });
    const noClip = player({ id: "3", name: "Cole Clip", startDay: "2026-11-09", liveWeek: 3, rows: session(3, 1, 2, 4, at("2026-11-23")) });
    const fine = player({ id: "4", name: "Fay Fine", startDay: "2026-11-09", liveWeek: 3, clipWeeks: [1], rows: session(3, 1, 2, 4, at("2026-11-23")) });
    const flags = squadNumbers([fine, noClip, quiet, notStarted], TODAY).flags;
    expect(flags.map((f) => f.id)).toEqual(["1", "2", "3"]);
    expect(flags[0].reason).toBe("Nia has not started. Week 1 has been live for 8 days.");
    expect(flags[1].reason).toBe("Quinn has not trained for 14 days.");
    expect(flags[2].reason).toBe("Cole is training but has not filmed a first clip.");
  });

  it("gives a new player their first days and a week of quiet before flagging", () => {
    const dayOne = player({ startDay: "2026-11-23", rows: session(1, 1, 0) });
    expect(squadNumbers([dayOne], TODAY).flags).toEqual([]);
    const sixDays = player({ startDay: "2026-11-09", liveWeek: 3, clipWeeks: [1], rows: session(2, 1, 4, 4, at("2026-11-18")) });
    expect(squadNumbers([sixDays], TODAY).flags).toEqual([]);
    expect(NOT_STARTED_DAYS).toBe(2);
    expect(QUIET_DAYS).toBe(7);
  });

  it("never flags someone who is not a member, and a Pro member is never asked for a clip", () => {
    const left = player({ member: false, startDay: "2026-08-17", liveWeek: 15, rows: session(1, 1, 4, 4, at("2026-08-18")) });
    const pro = player({ tier: "pro", startDay: "2026-11-09", liveWeek: 3, rows: session(3, 1, 2, 4, at("2026-11-23")) });
    expect(squadNumbers([left, pro], TODAY).flags).toEqual([]);
  });
});

describe("how the numbers are written", () => {
  it("is a plain count, and a dash when there is nobody to count", () => {
    expect(fmtCount({ n: 3, of: 4 })).toBe("3 of 4");
    expect(fmtCount({ n: 0, of: 0 })).toBe("-");
    expect(fmtWait(0)).toBe("Typically the same day their week goes live.");
    expect(fmtWait(1)).toBe("Typically the day after their week goes live.");
    expect(fmtWait(3)).toBe("Typically 3 days after their week goes live.");
    expect(fmtWait(null)).toBe("");
  });

  it("an empty squad is all zeros, not an error", () => {
    const n = squadNumbers([], TODAY);
    expect(n.members).toBe(0);
    expect(n.started).toEqual({ n: 0, of: 0, typicalDays: null });
    expect(n.flags).toEqual([]);
  });
});

describe("where the numbers live", () => {
  const root = path.resolve(__dirname, "..");
  const read = (f: string) => readFileSync(path.join(root, f), "utf8");
  it("the calculator is pure and the loader only reads", () => {
    const calc = read("lib/elite/squad-numbers.ts");
    expect(calc).not.toMatch(/supabase|createClient|fetch\(/);
    const loader = read("lib/elite/squad-numbers-server.ts");
    expect(loader).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(loader).not.toContain("createServiceClient"); // the coach's own access, never the master key
    expect(loader).toContain("everyRow");
  });
  it("is on the coach dashboard and on no player screen", () => {
    expect(read("app/(coach)/coach/page.tsx")).toContain("<SquadNumbersCard");
    const card = read("components/elite/SquadNumbersCard.tsx");
    expect(card).not.toMatch(/\bAI\b|automated|algorithm|streak/i);
    expect(card).not.toContain("—");
  });
});
