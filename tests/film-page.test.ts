import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

// App Store punch list A14: for a member the Film page is one Film Room
// card. The game schedule is one line until it is opened, and the old
// monthly timeline only shows for the retired Complete tier.
describe("the Film page is short", () => {
  const page = read("app/(player)/film/page.tsx");

  it("leads with the Film Room card", () => {
    expect(page.indexOf("<FilmRoomCard")).toBeGreaterThan(-1);
    expect(page.indexOf("<FilmRoomCard")).toBeLessThan(page.indexOf("<Fold"));
  });

  it("folds the game schedule into one line with a plain hint", () => {
    expect(page).toMatch(/<Fold title="Your games" hint=\{gamesHint\}>\s*<GameSchedule games=\{games\} \/>\s*<\/Fold>/);
    expect(page).toContain('"Add a game"');
    expect(page).toContain("coming up");
  });

  it("keeps the monthly timeline for the retired tier only", () => {
    expect(page).toMatch(/\{player\.tier !== "elite" && \(\s*<FilmTimeline/);
  });

  it("the fold is a full-width, full-height target that says whether it is open", () => {
    const fold = read("components/elite/Fold.tsx");
    expect(fold).toContain("min-h-[56px]");
    expect(fold).toContain("aria-expanded={open}");
    expect(fold).toContain("aria-controls={id}");
  });

  it("with no Film Room announced the card says what happens next", () => {
    const card = read("components/elite/FilmRoomCard.tsx");
    expect(card).toContain("has not been announced yet");
    expect(card).toContain("get a text the moment it is");
    expect(card).not.toMatch(/—|\bAI\b|automated|algorithm/);
  });
});
