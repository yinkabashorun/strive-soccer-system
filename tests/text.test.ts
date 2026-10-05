import { describe, expect, it } from "vitest";
import { ensureSentence } from "@/lib/elite/text";

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
