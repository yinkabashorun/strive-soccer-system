import { describe, expect, it } from "vitest";
import { FIVE_V_FIVE, dayOf, lastDayBefore, money, phaseAt, priceAt, registerTarget } from "@/lib/events/five-v-five";

const at = (iso: string) => Date.parse(iso);

describe("5v5 pricing", () => {
  it("early bird is $450 up to the last second of Nov 25 ET", () => {
    expect(priceAt(at("2026-11-19T15:00:00Z"))).toBe(450);
    expect(priceAt(at("2026-11-26T04:59:59Z"))).toBe(450); // 11:59:59pm EST Nov 25
  });
  it("$550 from midnight Nov 26 ET", () => {
    expect(FIVE_V_FIVE.earlyBirdEndsIso).toBe("2026-11-26T05:00:00.000Z");
    expect(priceAt(at("2026-11-26T05:00:00Z"))).toBe(550);
    expect(priceAt(at("2026-12-06T04:59:59Z"))).toBe(550); // last second of Dec 5
  });
  it("closes when Dec 6 starts in New York", () => {
    expect(phaseAt(at("2026-12-06T05:00:00Z"))).toBe("closed");
    expect(priceAt(at("2026-12-19T15:00:00Z"))).toBeNull();
    expect(registerTarget(at("2026-12-06T05:00:00Z"))).toBeNull();
  });
  it("labels the deadlines in New York days", () => {
    expect(lastDayBefore(FIVE_V_FIVE.earlyBirdEndsIso)).toBe("Wednesday, Nov 25");
    expect(dayOf(FIVE_V_FIVE.earlyBirdEndsIso)).toBe("Nov 26");
    expect(lastDayBefore(FIVE_V_FIVE.registrationClosesIso)).toBe("Saturday, Dec 5");
  });
  it("falls back to the Instagram DM until a Stripe link is set", () => {
    expect(registerTarget(at("2026-11-19T15:00:00Z"))).toEqual({ href: FIVE_V_FIVE.instagramDm, kind: "dm" });
  });
  it("formats money", () => {
    expect(money(3000)).toBe("$3,000");
  });
});
