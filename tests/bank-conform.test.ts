import { describe, expect, it } from "vitest";
import { conformSessionsToBank, matchBankDrill } from "@/lib/elite/bank-conform";
import type { Drill, GeneratedSession } from "@/lib/elite/types";

// The "only drills from the bank, only with video" rule, on the OUTPUT.
// Encodes the Oct 1 2026 recurrence (a real player's week had unfilmed
// drills from three different gaps). The bank passed here is always the
// filmed-only bank, so "every title is in the bank" == "every drill has
// a video".
function drill(partial: Partial<Drill> & { title: string; pillar: string }): Drill {
  return {
    id: partial.title.toLowerCase().replace(/\W+/g, "-"),
    how: `How to do ${partial.title}`,
    reps: "3 x 1 min",
    minutes: 6,
    cues: "",
    needs_wall: false,
    active: true,
    video_url: `https://videos.example/${partial.title}`,
    sort: 0,
    ...partial,
  } as Drill;
}

const bank: Drill[] = [
  drill({ title: "Maradona turn", pillar: "Confidence" }),
  drill({ title: "Ronaldinho elastico", pillar: "Confidence" }),
  drill({ title: "Sole roll chain", pillar: "Ball Mastery" }),
  drill({ title: "Inside-outside cuts", pillar: "Ball Mastery" }),
  drill({ title: "Weak foot wall passes", pillar: "Weak Foot", needs_wall: true }),
  drill({ title: "Plyo warm-up: Pogo hops", pillar: "Plyo" }),
];
const bankTitles = new Set(bank.map((d) => d.title));

const week: GeneratedSession[] = [
  {
    title: "Session 1",
    drills: [
      { title: "Plyo warm-up: Pogo & Tuck", exercise: "library plyo", reps: "3 rounds" },
      { title: "maradona turn", exercise: "AI tailored this for the player and wrote a long exercise.", reps: "5 x 30s" },
      { title: "Apply under pressure", exercise: "a pad", reps: "2 x 1 min" },
      { title: "Driven wall passes", exercise: "unfilmed, deleted from bank", reps: "3 x 20" },
    ],
  },
  {
    title: "Session 2",
    drills: [
      { title: "Scan + touch", exercise: "pillar with no filmed drills", reps: "4 x 45s" },
      { title: "Ronaldinho Elastico", exercise: "x", reps: "x" },
    ],
  },
];

describe("conformSessionsToBank", () => {
  it("every output drill title is a bank (filmed) title", () => {
    const out = conformSessionsToBank(week, bank, { has_wall: false }, "First touch.");
    for (const s of out) for (const d of s.drills) expect(bankTitles.has(d.title)).toBe(true);
  });
  it("keeps the AI's tailoring but takes the bank's exact title", () => {
    const out = conformSessionsToBank(week, bank, { has_wall: false }, "");
    const m = out[0].drills.find((d) => d.title === "Maradona turn");
    expect(m).toBeTruthy();
    expect(m!.reps).toBe("5 x 30s");
    expect(m!.exercise).toContain("AI tailored");
  });
  it("replaces a library plyo with a bank plyo, and drops plyos when the bank has none", () => {
    const withPlyo = conformSessionsToBank(week, bank, null, "");
    expect(withPlyo[0].drills[0].title).toBe("Plyo warm-up: Pogo hops");
    const noPlyoBank = bank.filter((d) => d.pillar !== "Plyo");
    const without = conformSessionsToBank(week, noPlyoBank, null, "");
    expect(without[0].drills.some((d) => /plyo/i.test(d.title))).toBe(false);
  });
  it("respects the wall rule and never repeats a drill inside a session", () => {
    const out = conformSessionsToBank(week, bank, { has_wall: false }, "");
    for (const s of out) {
      const titles = s.drills.map((d) => d.title);
      expect(new Set(titles).size).toBe(titles.length);
      expect(titles).not.toContain("Weak foot wall passes");
    }
  });
  it("leaves the plan alone only when there is no bank at all", () => {
    expect(conformSessionsToBank(week, [], null, "")).toEqual(week);
    expect(conformSessionsToBank(week, undefined, null, "")).toEqual(week);
  });
});

describe("matchBankDrill", () => {
  it("matches exact and clearly-fuzzy titles, never loose ones", () => {
    expect(matchBankDrill("maradona turn.", bank)?.title).toBe("Maradona turn");
    expect(matchBankDrill("Ronaldinho elastico (both feet)", bank)?.title).toBe("Ronaldinho elastico");
    expect(matchBankDrill("Focus block", bank)).toBeNull();
    expect(matchBankDrill("Turn", bank)).toBeNull();
  });
});
