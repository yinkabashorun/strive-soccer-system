import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ADDRESS_CEILING_FACTOR, JOIN_TRIES_PER_ADDRESS, JOIN_WINDOW_MS, callerKey, rateLimit } from "@/lib/rate-limit";

const src = (p: string) => readFileSync(p, "utf8");

// A launch through teams means many players on ONE network address: the
// venue's Wi-Fi at a tournament, a school's, a phone carrier's shared
// addresses. Every limit a new player meets on the way in is held here.
describe("a whole event can join and use the app from one Wi-Fi", () => {
  it("sign-up lets a tournament through one address, in the app and on the website", () => {
    // 32 teams of up to 9 is 288 players; a team huddle joins inside minutes
    expect(JOIN_TRIES_PER_ADDRESS).toBeGreaterThanOrEqual(100);
    expect(JOIN_WINDOW_MS).toBe(10 * 60_000);
    expect(src("app/api/elite/auth/join/route.ts")).toContain("rateLimit(`join:${clientIp(req)}`, JOIN_TRIES_PER_ADDRESS, JOIN_WINDOW_MS)");
    expect(src("app/api/app/free/join/route.ts")).toContain('{ name: "free-join", limit: JOIN_TRIES_PER_ADDRESS, windowMs: JOIN_WINDOW_MS }');
  });

  it("a signed-in caller is counted as themselves, never as their address", () => {
    const api = src("lib/elite/app-api.ts");
    expect(api).toContain("rateLimit(`app:${opts.name}:${callerKey(token)}`, limit, windowMs)");
    // the address keeps a ceiling many callers fit under, so made-up tokens are still held
    expect(api).toContain("token ? limit * ADDRESS_CEILING_FACTOR : limit");
    expect(ADDRESS_CEILING_FACTOR).toBeGreaterThanOrEqual(20);
  });

  it("forty teammates on one address each get their own count", () => {
    const name = `t-${Math.random()}`;
    for (let player = 0; player < 40; player++) {
      const key = `app:${name}:${callerKey(`token-of-player-${player}`)}`;
      for (let call = 0; call < 5; call++) expect(rateLimit(key, 5, 60_000)).toBe(true);
      // and one player past their own limit is held
      expect(rateLimit(key, 5, 60_000)).toBe(false);
    }
  });

  it("the key is a fingerprint, never the token", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.payload.signature";
    const key = callerKey(token);
    expect(key).toMatch(/^t:[0-9a-z]+$/);
    expect(key).not.toContain("eyJ");
    expect(key.length).toBeLessThan(20);
    expect(callerKey(token)).toBe(key);
    expect(callerKey(token + "x")).not.toBe(key);
  });
});
