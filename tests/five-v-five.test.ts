import { describe, expect, it } from "vitest";
import { FIVE_V_FIVE, money, phaseAt, priceAt, registerTarget } from "@/lib/events/five-v-five";

const at = (iso: string) => Date.parse(iso);

describe("5v5 pricing", () => {
  it("early bird is $450 up to the last second of Dec 4 ET", () => {
    expect(priceAt(at("2026-11-19T15:00:00Z"))).toBe(450);
    expect(priceAt(at("2026-12-05T04:59:59Z"))).toBe(450); // 11:59:59pm EST Dec 4
  });
  it("$550 from midnight Dec 5 ET", () => {
    expect(FIVE_V_FIVE.earlyBirdEndsIso).toBe("2026-12-05T05:00:00.000Z");
    expect(priceAt(at("2026-12-05T05:00:00Z"))).toBe(550);
    expect(priceAt(at("2026-12-18T23:00:00Z"))).toBe(550);
  });
  it("closes the morning of the event", () => {
    expect(phaseAt(at("2026-12-19T13:00:00Z"))).toBe("closed");
    expect(priceAt(at("2026-12-20T00:00:00Z"))).toBeNull();
    expect(registerTarget(at("2026-12-20T00:00:00Z"))).toBeNull();
  });
  it("falls back to the Instagram DM until a Stripe link is set", () => {
    expect(registerTarget(at("2026-11-19T15:00:00Z"))).toEqual({ href: FIVE_V_FIVE.instagramDm, kind: "dm" });
  });
  it("formats money", () => {
    expect(money(3000)).toBe("$3,000");
  });
});
