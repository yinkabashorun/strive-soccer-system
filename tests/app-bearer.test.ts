import { beforeEach, describe, expect, it, vi } from "vitest";

// Inside an app request (lib/elite/supabase/bearer.ts) the one cookie
// client and the one viewer resolver read the phone's token: the client
// carries it as the Authorization header (so RLS applies to the member as
// it does on the website), the viewer is verified with auth.getUser(token)
// and a token that does not verify is signed out, never the demo tour.

const seen = {
  clients: [] as { url: string; key: string; opts: Record<string, any> }[],
  getUserArgs: [] as unknown[],
  cookieReads: 0,
  user: null as null | { id: string; email: string },
};

vi.mock("next/headers", () => ({
  cookies: () => {
    seen.cookieReads++;
    return { getAll: () => [], get: () => ({ value: "player" }), set: () => undefined };
  },
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, key: string, opts: Record<string, any>) => {
    seen.clients.push({ url, key, opts });
    return {
      auth: {
        getUser: async (jwt?: string) => {
          seen.getUserArgs.push(jwt);
          return { data: { user: seen.user } };
        },
      },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: "player", full_name: "M B", id: "p1" } }) }) }),
      }),
    };
  },
}));

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  seen.clients = [];
  seen.getUserArgs = [];
  seen.cookieReads = 0;
  seen.user = null;
});

describe("the app's bearer request", () => {
  it("createClient carries the token and never reads cookies", async () => {
    const { runWithBearer } = await import("@/lib/elite/supabase/bearer");
    const { createClient } = await import("@/lib/elite/supabase/server");
    await runWithBearer("a.b.c", async () => {
      createClient();
    });
    expect(seen.cookieReads).toBe(0);
    expect(seen.clients).toHaveLength(1);
    expect(seen.clients[0].opts.global.headers.Authorization).toBe("Bearer a.b.c");
    expect(seen.clients[0].opts.auth.persistSession).toBe(false);
    // every database read still skips Next's cache
    expect(typeof seen.clients[0].opts.global.fetch).toBe("function");
  });

  it("outside an app request the website's cookie client is untouched", async () => {
    const { createClient } = await import("@/lib/elite/supabase/server");
    createClient();
    expect(seen.cookieReads).toBe(1);
    expect(seen.clients).toHaveLength(0);
  });

  it("getViewer verifies the token itself and resolves the member", async () => {
    const { runWithBearer } = await import("@/lib/elite/supabase/bearer");
    const { getViewer } = await import("@/lib/elite/session");
    seen.user = { id: "u1", email: "m@example.com" };
    const v = await runWithBearer("a.b.c", () => getViewer());
    expect(seen.getUserArgs).toContain("a.b.c");
    expect(v?.profile.id).toBe("u1");
    expect(v?.demo).toBe(false);
  });

  it("a token that does not verify is signed out, even with a demo cookie", async () => {
    const { runWithBearer } = await import("@/lib/elite/supabase/bearer");
    const { getViewer } = await import("@/lib/elite/session");
    seen.user = null;
    const v = await runWithBearer("a.b.c", () => getViewer());
    expect(v).toBeNull();
  });
});
