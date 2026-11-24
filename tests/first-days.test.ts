import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FIRST_DAYS, FIRST_FRIENDS, firstDays, type FirstFacts } from "../lib/elite/first-days";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const DAY = 86_400_000;
const NOW = Date.parse("2026-11-24T15:00:00Z");
const facts = (over: Partial<FirstFacts> = {}): FirstFacts => ({
  joinedAt: new Date(NOW - 2 * DAY).toISOString(),
  posted: false,
  friends: 0,
  clubs: 0,
  gaveProps: false,
  ...over,
});

// The free app's first-days list: the leaders' finding that a new player
// who posts, adds friends and joins a group early is the one who stays.
describe("your first days", () => {
  it("is four steps, in the order a new player meets them", () => {
    const list = firstDays(facts(), NOW)!;
    expect(list.steps.map((s) => s.key)).toEqual(["post", "friends", "club", "props"]);
    expect(list.steps.map((s) => s.label)).toEqual([
      "Post your first training",
      `Add ${FIRST_FRIENDS} friends`,
      "Join a club or start one",
      "Give a friend props",
    ]);
    expect(list).toMatchObject({ done: 0, total: 4 });
  });

  it("a step is done from what the player really did, and friends say how far along", () => {
    const list = firstDays(facts({ posted: true, friends: 1, clubs: 2 }), NOW)!;
    expect(list.steps.map((s) => s.done)).toEqual([true, false, true, false]);
    expect(list.steps[1].note).toBe(`1 of ${FIRST_FRIENDS}`);
    expect(firstDays(facts({ friends: FIRST_FRIENDS }), NOW)!.steps[1]).toMatchObject({ done: true, note: null });
    expect(firstDays(facts(), NOW)!.steps[1].note).toBeNull();
  });

  it("is gone for good once all four are done", () => {
    expect(firstDays(facts({ posted: true, friends: 3, clubs: 1, gaveProps: true }), NOW)).toBeNull();
  });

  it("is only for the first days, and never for an account with no join date", () => {
    expect(firstDays(facts({ joinedAt: new Date(NOW - (FIRST_DAYS - 1) * DAY).toISOString() }), NOW)).not.toBeNull();
    expect(firstDays(facts({ joinedAt: new Date(NOW - FIRST_DAYS * DAY).toISOString() }), NOW)).toBeNull();
    expect(firstDays(facts({ joinedAt: null }), NOW)).toBeNull();
    expect(firstDays(facts({ joinedAt: "not a date" }), NOW)).toBeNull();
  });

  it("never counts what was missed, never sells, never orders with a deadline", () => {
    const words = JSON.stringify(firstDays(facts({ friends: 2 }), NOW));
    expect(words).not.toMatch(/missed|late|behind|days left|hurry|upgrade|pro\b|\$|!/i);
  });

  it("is on the Friends tab of the website and the phone, from the one rule", () => {
    expect(read("lib/elite/free-app-server.ts")).toContain("firstDays(");
    expect(read("app/(free)/log/page.tsx")).toContain("firstDays(");
    expect(read("components/elite/FriendsFeed.tsx")).toContain("<FirstDaysCard");
    expect(read("mobile/app/(free)/friends.tsx")).toContain("<FirstDaysCard");
    // the server reads three counts, never the rows
    const facts = read("lib/elite/tracker-server.ts");
    expect(facts).toMatch(/firstDaysFacts[\s\S]{0,900}head: true/);
  });
});
