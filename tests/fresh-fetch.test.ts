import { afterEach, describe, expect, it, vi } from "vitest";
import { freshFetch } from "@/lib/elite/supabase/fresh-fetch";

// The plan builder once read a cached "latest built week" and rebuilt a
// live week every hour, texting the family each time. Every database
// request has to say no-store, whatever the caller passed.
describe("database reads never come from the fetch cache", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sets cache: no-store on every request", async () => {
    const seen: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_input: unknown, init?: RequestInit) => {
      seen.push(init ?? {});
      return new Response("[]");
    });
    await freshFetch("https://db.example/rest/v1/elite_homework?select=week");
    await freshFetch("https://db.example/rest/v1/elite_homework", { method: "GET", headers: { a: "b" } });
    expect(seen.map((i) => i.cache)).toEqual(["no-store", "no-store"]);
    expect(seen[1].headers).toEqual({ a: "b" });
  });

  it("overrides a caller that asked for the cache", async () => {
    let cache: RequestCache | undefined;
    vi.stubGlobal("fetch", async (_input: unknown, init?: RequestInit) => {
      cache = init?.cache;
      return new Response("[]");
    });
    await freshFetch("https://db.example/x", { cache: "force-cache" });
    expect(cache).toBe("no-store");
  });
});
