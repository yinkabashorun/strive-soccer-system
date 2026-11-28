// THE APP'S VOICE (marketing/copy/voice-guide.md, approved by Coach Yinka
// Nov 28 2026). The rotation helper and every rotating set of lines the
// app says, held to the guide's rules.
import { describe, expect, it } from "vitest";
import { pickLine, seedDay, seedHash } from "@/lib/elite/voice";
import { friendPostLines, passedBodies, reminderReadyLines } from "@/lib/elite/notices";
import { matchupAheadLines } from "@/lib/elite/club-matchup-words";
import { FRIEND_SHARE_FIRST_LINES } from "@/lib/elite/free-door";
import { clubShareFirstLines } from "@/lib/elite/club-app";
import { milestoneEarnedLines } from "@/lib/elite/session-flow";
import { landedLines } from "@/lib/elite/standing";
import { weekCard, weekCardLines, type WeekCardInput } from "@/lib/elite/week-recap";
import { UPGRADE_CARD_LINE } from "@/lib/elite/upgrade-card";
import { FRIENDS_EMPTY_TITLE } from "@/lib/elite/tracker";

describe("pickLine: a mix that holds still", () => {
  const lines = ["a", "b", "c"];
  it("the same seed always gives the same line", () => {
    for (const seed of ["u1:2026-11-28", "", "club:x:2026-12-01"]) {
      expect(pickLine(lines, seed)).toBe(pickLine(lines, seed));
      expect(seedHash(seed)).toBe(seedHash(seed));
    }
  });
  it("every line is reachable", () => {
    const seen = new Set<string>();
    for (let k = 0; k < 200; k++) seen.add(pickLine(lines, `p${k}:2026-11-28`));
    expect([...seen].sort()).toEqual(lines);
  });
  it("one line is that line; none is a bug", () => {
    expect(pickLine(["only"], "x")).toBe("only");
    expect(() => pickLine([], "x")).toThrow();
  });
  it("the day is New York's", () => {
    expect(seedDay(new Date("2026-11-29T03:00:00Z"))).toBe("2026-11-28"); // 10 PM Saturday in New York
    expect(seedDay(new Date("2026-11-29T05:00:00Z"))).toBe("2026-11-29");
  });
});

// Every sentence of every rotating set, with example names and numbers.
function everyLine(): string[] {
  const out: string[] = [];
  for (const m of [1, 45, 75, 150]) {
    out.push(...passedBodies(m), ...landedLines(m), ...milestoneEarnedLines(m === 150 ? 100 : m === 1 ? 1 : 5));
    for (const kind of ["training", "gym"] as const) {
      for (const mine of [null, 0, 200]) for (const l of friendPostLines({ first: "Kai", kind, minutes: m, mine })) out.push(l.title, l.body);
    }
    const facts = { session: 2, drills: 4, drillsLeft: 4, minutes: m, lastOpen: false };
    for (const area of [null, "Weak foot", "Dribbling and 1v1", "Speed"]) for (const l of reminderReadyLines({ ...facts, area })) out.push(l.title, l.body);
  }
  for (const [mine, theirs] of [[72, 60], [60, 72], [60, 60], [61, 60]]) out.push(...matchupAheadLines({ mine, theirs, other: "Haymarket 08s", club: "Renegados FC" }));
  out.push(...FRIEND_SHARE_FIRST_LINES, ...clubShareFirstLines("Renegados FC"), UPGRADE_CARD_LINE, FRIENDS_EMPTY_TITLE);
  const f = (name: string, minutes: number) => ({ name, minutes });
  const base: WeekCardInput = { moment: "sunday", week: "2026-11-23", mine: 190, earlier: [], gym: 45, friends: [] };
  for (const moment of ["sunday", "monday"] as const) {
    for (const friends of [[], [f("Nico A.", 60)], [f("Nico A.", 60), f("Diego R.", 80)], [f("Kai T.", 400)]]) {
      for (const earlier of [[], [10, 20, 30]]) out.push(...weekCardLines(weekCard({ ...base, moment, friends, earlier })!));
    }
  }
  // a line may be two sentences: each is held on its own
  return out.flatMap((l) => l.split(/(?<=[.?])\s+/)).filter(Boolean);
}

describe("the guide's rules on every rotating line", () => {
  const lines = everyLine();
  it("there are lines to hold", () => {
    expect(lines.length).toBeGreaterThan(100);
  });
  it("none of the words that stay out of the app's own voice", () => {
    for (const l of lines) expect(l, l).not.toMatch(/\b(bro|boys|dawg|king)\b|your move/i);
  });
  it("no exclamation mark, no emoji, no long dash", () => {
    for (const l of lines) {
      expect(l, l).not.toMatch(/!/);
      expect(l, l).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(l, l).not.toMatch(/[—–]/);
    }
  });
  it("at most one number with a unit a sentence", () => {
    const units = /\d+h( \d+m)?\b|\d+m\b|\d+ (minutes?|hours?)\b/g;
    for (const l of lines) expect((l.match(units) ?? []).length, l).toBeLessThanOrEqual(1);
  });
  it("never they, them or their", () => {
    for (const l of lines) expect(l, l).not.toMatch(/\b(they|them|their)\b/i);
  });
  it("never the machinery", () => {
    for (const l of lines) expect(l, l).not.toMatch(/\b(AI|automated|algorithm)\b/);
  });
});
