import { describe, expect, it } from "vitest";
import { sendAllowed, smsSendKey } from "@/lib/elite/sms";
import { CANONICAL_APP_URL, resolveAppUrl } from "@/lib/elite/app-url";

const TEXT =
  "Hey Anthony, Yinka's week 8 just went live. This week: Back to the pillars. Let's have Yinka open the app and get started on Session 1: https://thestriveapp.com/dashboard";

describe("the same text never reaches the same phone twice in a day", () => {
  it("the same number, words and day make the same key (the database refuses the second)", () => {
    expect(smsSendKey("+15710000001", TEXT, "2026-11-12")).toEqual(smsSendKey("+15710000001", TEXT, "2026-11-12"));
  });
  it("a different number, different words or a different day is a different text", () => {
    const base = smsSendKey("+15710000001", TEXT, "2026-11-12");
    expect(smsSendKey("+15710000002", TEXT, "2026-11-12")).not.toEqual(base);
    expect(smsSendKey("+15710000001", TEXT.replace("week 8", "week 9"), "2026-11-12")).not.toEqual(base);
    expect(smsSendKey("+15710000001", TEXT, "2026-11-13")).not.toEqual(base);
  });
  it("stores hashes, never the number or the words", () => {
    const key = smsSendKey("+15710000001", TEXT, "2026-11-12");
    expect(key.phone_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(key.body_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(key)).not.toContain("5710000001");
    expect(JSON.stringify(key)).not.toContain("Anthony");
  });
  it("a duplicate is not sent; a ledger that is down does not silence a family", () => {
    expect(sendAllowed(null)).toBe(true);
    expect(sendAllowed({ code: "23505" })).toBe(false);
    expect(sendAllowed({ code: "PGRST000" })).toBe(true);
  });
});

describe("links in texts go to the real domain", () => {
  it("never the old Vercel address", () => {
    expect(resolveAppUrl("https://strive-soccer-system.vercel.app")).toBe(CANONICAL_APP_URL);
    expect(resolveAppUrl("https://strive-soccer-system-git-main.vercel.app/")).toBe(CANONICAL_APP_URL);
  });
  it("never http, localhost, or something that is not an address", () => {
    expect(resolveAppUrl("http://localhost:3000")).toBe(CANONICAL_APP_URL);
    expect(resolveAppUrl("thestriveapp.com")).toBe(CANONICAL_APP_URL);
    expect(resolveAppUrl("")).toBe(CANONICAL_APP_URL);
    expect(resolveAppUrl(undefined)).toBe(CANONICAL_APP_URL);
  });
  it("keeps the real domain, without a trailing slash or path", () => {
    expect(resolveAppUrl("https://thestriveapp.com/")).toBe("https://thestriveapp.com");
    expect(resolveAppUrl("https://www.thestriveapp.com/dashboard")).toBe("https://www.thestriveapp.com");
  });
});
