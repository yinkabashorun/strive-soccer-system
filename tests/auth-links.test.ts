import { describe, expect, it } from "vitest";
import { authCodeLanding, confirmTarget, safeNext } from "@/lib/elite/auth-links";

// Oct 19 2026: a reset link landed on the wrong door and died. These pin
// the two guards that keep an auth email link usable.
describe("safeNext", () => {
  it("keeps same-site paths and rejects anything that could leave the app", () => {
    expect(safeNext("/reset", "/dashboard")).toBe("/reset");
    expect(safeNext("https://evil.example/x", "/dashboard")).toBe("/dashboard");
    expect(safeNext("//evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeNext(null, "/dashboard")).toBe("/dashboard");
  });
});

describe("authCodeLanding (a PKCE code arriving at the root)", () => {
  it("hands the code to the callback bound for the reset page", () => {
    expect(authCodeLanding({ code: "abc" })).toBe("/auth/callback?code=abc&next=%2Freset");
  });
  it("honours an explicit same-site next", () => {
    expect(authCodeLanding({ code: "abc", next: "/dashboard" })).toBe(
      "/auth/callback?code=abc&next=%2Fdashboard"
    );
  });
  it("does nothing without a code", () => {
    expect(authCodeLanding({ code: null })).toBeNull();
    expect(authCodeLanding({ code: "  " })).toBeNull();
  });
});

describe("confirmTarget (the token_hash flow)", () => {
  it("accepts a recovery link and lands on the reset page by default", () => {
    expect(confirmTarget({ token_hash: "h1", type: "recovery" })).toEqual({
      tokenHash: "h1",
      type: "recovery",
      next: "/reset",
    });
  });
  it("other types land on the dashboard unless told otherwise", () => {
    expect(confirmTarget({ token_hash: "h1", type: "magiclink" })?.next).toBe("/dashboard");
    expect(confirmTarget({ token_hash: "h1", type: "signup", next: "/onboarding" })?.next).toBe(
      "/onboarding"
    );
  });
  it("rejects unknown types, missing hashes and off-site destinations", () => {
    expect(confirmTarget({ token_hash: "h1", type: "sms" })).toBeNull();
    expect(confirmTarget({ token_hash: "", type: "recovery" })).toBeNull();
    expect(confirmTarget({ token_hash: "h1", type: "recovery", next: "https://x" })?.next).toBe(
      "/reset"
    );
  });
});
