import { describe, expect, it } from "vitest";
import { FOCUS_MAX, ensureSentence, playerFocus, weekFocusLine } from "@/lib/elite/text";

// The Sept 30 2026 SMS recurrence. Every new_week template is a colon
// construction ("This week: X Let's have..."), which only reads cleanly
// when X is a complete sentence with its own terminal punctuation.
const template = (focus: string) => `This week: ${ensureSentence(focus)} Let's have Marcus open the app.`;

describe("ensureSentence", () => {
  it("adds a period when missing and never doubles one", () => {
    expect(ensureSentence("Lock in the first touch")).toBe("Lock in the first touch.");
    expect(ensureSentence("Lock in the first touch.")).toBe("Lock in the first touch.");
    expect(ensureSentence("  Earn it!  ")).toBe("Earn it!");
  });
  it("the real reported string renders with a single period and no run-on", () => {
    const sms = template("Lock in the first touch and force the right foot to earn its keep.");
    expect(sms).not.toMatch(/\.\./);
    expect(sms).toMatch(/keep\. Let's/);
  });
});

// The line a player reads when their week arrives (Coach Yinka, Nov 24
// 2026: copy people actually want to see, easy to read). Production was
// showing "Back to the pillars: ball mastery, scanning, passing, confidence."
describe("the week's focus line", () => {
  it("names what the week goes after, in the player's words, two areas at most", () => {
    expect(weekFocusLine(["Weak foot"])).toBe("This week goes after your weak foot.");
    expect(weekFocusLine(["Weak foot", "First touch"])).toBe("This week goes after your weak foot and first touch.");
    expect(weekFocusLine(["Ball mastery", "Passing", "1v1 moves", "Speed"])).toBe("This week goes after your ball mastery and passing.");
    expect(weekFocusLine(["Passing", "passing", " Passing "])).toBe("This week goes after your passing.");
    expect(weekFocusLine([])).toBe("This week is built around your game.");
  });

  it("is one short sentence whatever wrote it: no list after a colon, no second sentence, never long", () => {
    expect(playerFocus("Back to the pillars: ball mastery, scanning, passing, confidence")).toBe("Back to the pillars.");
    expect(playerFocus("This week goes after your weak foot. Keep stacking clean reps every day.")).toBe("This week goes after your weak foot.");
    expect(playerFocus("  This week is first touch and quick feet  ")).toBe("This week is first touch and quick feet.");
    const long = playerFocus("Reset the week with ruthless consistency on close control and the first touch under pressure from every single angle you can find");
    expect(long.length).toBeLessThanOrEqual(FOCUS_MAX + 1);
    expect(long.endsWith(".")).toBe(true);
    expect(long).not.toMatch(/\s\.$/);
    expect(playerFocus("")).toBe("This week is built around your game.");
    expect(playerFocus("   ")).toBe("This week is built around your game.");
  });

  it("carries no long dash and no shouting", () => {
    for (const line of [weekFocusLine(["Weak foot"]), weekFocusLine([]), playerFocus("Lock in the first touch \u2014 every day")]) {
      expect(line).not.toMatch(/[\u2014\u2013!]/);
    }
  });
});
