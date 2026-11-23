import { beforeEach, describe, expect, it, vi } from "vitest";

// The native iPhone app's JSON API (app/api/app/*). What is held here:
//   - nobody gets in without a well-formed bearer token that Supabase
//     verifies (the body is never trusted for who is calling)
//   - the demo tour is never an app session
//   - every route enforces the same member gate as the website, at the
//     access level the route declares
//   - bodies are checked before any shared action runs
//   - callers are rate limited
// The database and the shared actions are stood in for.

const TOKEN = "aaa.bbb.ccc";
type Viewer = {
  profile: { id: string; role: string; full_name: string; email: string; avatar_color: string };
  role: string;
  playerId: string | null;
  demo: boolean;
};
const s = {
  viewer: null as Viewer | null,
  player: null as Record<string, unknown> | null,
  consentDue: false,
  tracker: null as unknown,
  seenTokens: [] as (string | null)[],
  calls: [] as { fn: string; args: unknown[] }[],
  homeworkRow: { id: "", completed: true } as { id: string; completed: boolean } | null,
};

function player(over: Record<string, unknown> = {}) {
  return {
    id: "p1",
    full_name: "Marcus Bryant",
    tier: "pro",
    subscription_status: "active",
    onboarded_at: "2026-11-01T00:00:00Z",
    week1_monday: "2026-11-02",
    current_week: 1,
    has_wall: true,
    goals: ["Make the A team"],
    joined_at: "2026-11-01T00:00:00Z",
    position: "Winger",
    parent_phone: "",
    ...over,
  };
}
function viewer(over: Partial<Viewer> = {}): Viewer {
  return {
    profile: { id: "u1", role: "player", full_name: "Marcus Bryant", email: "m@example.com", avatar_color: "#000" },
    role: "player",
    playerId: "p1",
    demo: false,
    ...over,
  };
}
function call(fn: string) {
  return async (...args: unknown[]) => {
    s.calls.push({ fn, args });
    if (fn === "completeOnboarding") return { ok: true };
    if (fn === "buildMyFirstWeek") return { status: "waiting" };
    if (fn === "submitCheckin") return { ok: true };
    if (fn === "addExtraSession" || fn === "addPickedExtraSession") return { ok: true, session: 5 };
    if (fn === "getExtraPicker") return { ok: true, groups: [], warmUpMinutes: 5, finisherMinutes: 0, example: false };
    if (fn === "deleteOwnAccount") return { error: null };
    if (fn === "changeMyPassword") return { error: null, done: true };
    if (fn === "recordConsent") return true;
    if (fn === "loadWeek") return { week: 1 };
    if (fn === "loadYou") return { allTimeMinutes: 0 };
    if (fn === "loadBootstrap") return { state: args[1] };
    return { ok: true };
  };
}

vi.mock("@/lib/elite/session", async () => {
  const { bearerToken } = await import("@/lib/elite/supabase/bearer");
  return {
    getViewer: async () => {
      s.seenTokens.push(bearerToken());
      return s.viewer;
    },
  };
});
vi.mock("@/lib/elite/data", () => ({
  getPlayer: async () => s.player,
  getHomework: async () => [
    { id: "h1", week: 1, completed: true, duration_min: 20, title: "x", exercise: "", reps: "", video_url: null, notes: null, completed_at: null, sort: 0, player_id: "p1" },
  ],
}));
vi.mock("@/lib/elite/legal-server", () => ({
  consentDue: async () => s.consentDue,
  recordConsent: call("recordConsent"),
}));
vi.mock("@/lib/elite/tracker-server", () => ({ getTracker: async () => s.tracker }));
vi.mock("@/lib/elite/player-actions", () => ({
  toggleHomework: call("toggleHomework"),
  submitCheckin: call("submitCheckin"),
  completeOnboarding: call("completeOnboarding"),
}));
vi.mock("@/lib/elite/extra-actions", () => ({
  addExtraSession: call("addExtraSession"),
  addPickedExtraSession: call("addPickedExtraSession"),
  getExtraPicker: call("getExtraPicker"),
}));
vi.mock("@/lib/elite/bank-conform", () => ({
  EXTRA_SHELVES: {
    ball_mastery: { label: "Ball Mastery", blurb: "" },
    wall_work: { label: "Wall Work", blurb: "" },
    one_v_one: { label: "1v1 Skills", blurb: "" },
  },
}));
vi.mock("@/lib/elite/first-week-actions", () => ({ buildMyFirstWeek: call("buildMyFirstWeek") }));
vi.mock("@/lib/elite/account-delete", () => ({ deleteOwnAccount: call("deleteOwnAccount") }));
vi.mock("@/lib/elite/account-actions", () => ({ changeMyPassword: call("changeMyPassword") }));
vi.mock("@/lib/elite/app-data", () => ({
  loadWeek: call("loadWeek"),
  loadYou: call("loadYou"),
  loadBootstrap: call("loadBootstrap"),
}));
vi.mock("@/app/api/elite/push/native/route", () => ({
  POST: async () => {
    s.calls.push({ fn: "savePushToken", args: [] });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  },
  DELETE: async () => {
    s.calls.push({ fn: "removePushToken", args: [] });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  },
}));
vi.mock("@/lib/elite/supabase/server", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: s.homeworkRow }) }) }) }),
    }),
  }),
}));

let ip = 0;
function req(method: string, opts: { auth?: string | null; body?: unknown } = {}) {
  const headers: Record<string, string> = { "x-forwarded-for": `10.0.${Math.floor(ip / 250)}.${ip++ % 250}` };
  if (opts.auth !== null) headers.authorization = opts.auth ?? `Bearer ${TOKEN}`;
  return new Request("https://thestriveapp.com/api/app/x", {
    method,
    headers,
    body: opts.body === undefined || method === "GET" ? undefined : JSON.stringify(opts.body),
  });
}

const ROUTES = {
  me: () => import("@/app/api/app/me/route"),
  week: () => import("@/app/api/app/week/route"),
  you: () => import("@/app/api/app/you/route"),
  drill: () => import("@/app/api/app/drill/route"),
  extra: () => import("@/app/api/app/extra/route"),
  checkin: () => import("@/app/api/app/checkin/route"),
  onboarding: () => import("@/app/api/app/onboarding/route"),
  firstWeek: () => import("@/app/api/app/first-week/route"),
  consent: () => import("@/app/api/app/consent/route"),
  pushToken: () => import("@/app/api/app/push-token/route"),
  accountDelete: () => import("@/app/api/app/account/delete/route"),
  accountPassword: () => import("@/app/api/app/account/password/route"),
};

// Every handler, its method and the access level it must declare.
const TABLE: { route: keyof typeof ROUTES; method: "GET" | "POST" | "DELETE"; access: "account" | "player" | "member" }[] = [
  { route: "me", method: "GET", access: "account" },
  { route: "week", method: "GET", access: "member" },
  { route: "you", method: "GET", access: "member" },
  { route: "drill", method: "POST", access: "member" },
  { route: "extra", method: "GET", access: "member" },
  { route: "extra", method: "POST", access: "member" },
  { route: "checkin", method: "POST", access: "member" },
  { route: "onboarding", method: "POST", access: "player" },
  { route: "firstWeek", method: "POST", access: "player" },
  { route: "consent", method: "POST", access: "account" },
  { route: "pushToken", method: "POST", access: "player" },
  { route: "pushToken", method: "DELETE", access: "player" },
  { route: "accountDelete", method: "POST", access: "account" },
  { route: "accountPassword", method: "POST", access: "account" },
];

async function handler(route: keyof typeof ROUTES, method: string) {
  const mod = (await ROUTES[route]()) as unknown as Record<string, (r: Request) => Promise<Response>>;
  return mod[method];
}

beforeEach(() => {
  s.viewer = viewer();
  s.player = player();
  s.consentDue = false;
  s.tracker = null;
  s.seenTokens = [];
  s.calls = [];
  s.homeworkRow = { id: "11111111-1111-4111-8111-111111111111", completed: true };
});

describe("the bearer token", () => {
  it("parses only a Bearer JWT", async () => {
    const { parseBearer } = await import("@/lib/elite/supabase/bearer");
    expect(parseBearer(`Bearer ${TOKEN}`)).toBe(TOKEN);
    expect(parseBearer(`bearer ${TOKEN}`)).toBe(TOKEN);
    expect(parseBearer(TOKEN)).toBeNull();
    expect(parseBearer("Bearer not-a-jwt")).toBeNull();
    expect(parseBearer("Basic dXNlcjpwYXNz")).toBeNull();
    expect(parseBearer(`Bearer ${"a".repeat(3000)}.${"b".repeat(1100)}.c`)).toBeNull();
    expect(parseBearer(null)).toBeNull();
  });

  it("is seen by getViewer only inside the request", async () => {
    const { runWithBearer, bearerToken } = await import("@/lib/elite/supabase/bearer");
    expect(bearerToken()).toBeNull();
    await runWithBearer(TOKEN, async () => {
      await Promise.resolve();
      expect(bearerToken()).toBe(TOKEN);
    });
    expect(bearerToken()).toBeNull();
  });
});

describe("every route", () => {
  for (const row of TABLE) {
    const label = `${row.method} ${row.route}`;

    it(`${label}: refuses a request with no token or a malformed one`, async () => {
      const h = await handler(row.route, row.method);
      expect((await h(req(row.method, { auth: null }))).status).toBe(401);
      expect((await h(req(row.method, { auth: "Bearer nope" }))).status).toBe(401);
      expect(s.calls).toEqual([]);
    });

    it(`${label}: refuses a token Supabase does not verify, and the demo tour`, async () => {
      const h = await handler(row.route, row.method);
      s.viewer = null;
      expect((await h(req(row.method))).status).toBe(401);
      s.viewer = viewer({ demo: true });
      expect((await h(req(row.method))).status).toBe(401);
      expect(s.calls).toEqual([]);
    });

    it(`${label}: resolves the viewer from the header, never anything else`, async () => {
      const h = await handler(row.route, row.method);
      await h(req(row.method, { body: {} }));
      expect(s.seenTokens).toEqual([TOKEN]);
    });

    it(`${label}: keeps a coach out unless the route is for any account`, async () => {
      const h = await handler(row.route, row.method);
      s.viewer = viewer({ role: "coach", playerId: null });
      const res = await h(req(row.method, { body: {} }));
      if (row.access === "account") expect(res.status).not.toBe(403);
      else {
        expect(res.status).toBe(403);
        expect((await res.json()).state.kind).toBe("coach");
      }
    });

    it(`${label}: while the agreement is due, only account routes answer`, async () => {
      const h = await handler(row.route, row.method);
      s.consentDue = true;
      const res = await h(req(row.method, { body: {} }));
      if (row.access === "account") expect(res.status).not.toBe(403);
      else {
        expect(res.status).toBe(403);
        expect((await res.json()).state.kind).toBe("consent");
      }
    });

    it(`${label}: a membership not switched on reaches only account and player routes`, async () => {
      const h = await handler(row.route, row.method);
      s.player = player({ tier: "elite", subscription_status: "none" });
      const res = await h(req(row.method, { body: {} }));
      if (row.access === "member") {
        expect(res.status).toBe(403);
        expect((await res.json()).state.kind).toBe("membership");
      } else expect(res.status).not.toBe(403);
    });
  }
});

describe("the gate, one rule with the website", () => {
  it("runs in the web member shell's order", async () => {
    const { memberState } = await import("@/lib/elite/member-gate");
    const base = { role: "player" as const, playerId: "p1", isFree: false, consentDue: false, player: player() };
    expect(memberState({ ...base, role: "coach" }).kind).toBe("coach");
    expect(memberState({ ...base, playerId: null, isFree: true }).kind).toBe("free");
    expect(memberState({ ...base, playerId: null }).kind).toBe("no_profile");
    // the agreement comes before everything else for a member
    expect(memberState({ ...base, consentDue: true, player: player({ onboarded_at: null, subscription_status: "none" }) }).kind).toBe("consent");
    // Pro pays before the quiz
    expect(memberState({ ...base, player: player({ onboarded_at: null, subscription_status: "none" }) }).kind).toBe("pro_checkout");
    // an Elite family takes the quiz before the coach switches them on
    expect(memberState({ ...base, player: player({ tier: "elite", onboarded_at: null, subscription_status: "none" }) }).kind).toBe("onboarding");
    expect(memberState({ ...base, player: player({ tier: "elite", subscription_status: "paused" }) }).kind).toBe("membership");
    // before 012 (no column) nobody is trapped in the quiz
    expect(memberState({ ...base, player: player({ onboarded_at: undefined }) }).kind).toBe("ok");
    expect(memberState(base).kind).toBe("ok");
  });

  it("is the rule the web member shell uses", async () => {
    const { readFileSync } = await import("node:fs");
    const layout = readFileSync("app/(player)/layout.tsx", "utf8");
    expect(layout).toContain("memberState(");
    expect(layout).not.toContain("gateFor(");
  });
});

describe("bodies are checked first", () => {
  it("drill: needs a uuid and a boolean, and says when the row did not change", async () => {
    const h = await handler("drill", "POST");
    expect((await h(req("POST", { body: { id: "x", completed: true } }))).status).toBe(400);
    expect((await h(req("POST", { body: { id: s.homeworkRow!.id } }))).status).toBe(400);
    expect(s.calls).toEqual([]);
    const ok = await h(req("POST", { body: { id: s.homeworkRow!.id, completed: true } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, completed: true, totalMinutes: 20 });
    s.homeworkRow = null; // not the member's row, or RLS refused it
    expect((await h(req("POST", { body: { id: "11111111-1111-4111-8111-111111111111", completed: true } }))).status).toBe(409);
  });

  it("extra: a shelf it knows, or a list of picks", async () => {
    const h = await handler("extra", "POST");
    expect((await h(req("POST", { body: { shelf: "anything" } }))).status).toBe(400);
    expect((await h(req("POST", { body: {} }))).status).toBe(400);
    expect((await h(req("POST", { body: { shelf: "ball_mastery" } }))).status).toBe(200);
    expect((await h(req("POST", { body: { drillIds: ["a"] } }))).status).toBe(200);
    expect(s.calls.map((c) => c.fn)).toEqual(["addExtraSession", "addPickedExtraSession"]);
  });

  it("extra: Wall Work is offered only to a player with a wall", async () => {
    const h = await handler("extra", "GET");
    s.player = player({ has_wall: false });
    const body = await (await h(req("GET"))).json();
    expect(body.shelves.map((x: { key: string }) => x.key)).toEqual(["ball_mastery", "one_v_one"]);
  });

  it("checkin: something about the week, ratings 1 to 5 only", async () => {
    const h = await handler("checkin", "POST");
    expect((await h(req("POST", { body: { rating: 9 } }))).status).toBe(400);
    expect((await h(req("POST", { body: { rating: 4, went_well: "x".repeat(5000) } }))).status).toBe(200);
    const input = s.calls[0].args[0] as { rating: number; went_well: string };
    expect(input.rating).toBe(4);
    expect(input.went_well.length).toBe(1000);
  });

  it("onboarding: only while the quiz is due, and every question answered", async () => {
    const h = await handler("onboarding", "POST");
    expect((await h(req("POST", { body: { answers: {} } }))).status).toBe(409); // already onboarded
    s.player = player({ tier: "elite", subscription_status: "none", onboarded_at: null });
    const res = await h(req("POST", { body: { answers: { gender: "boy" } } }));
    expect(res.status).toBe(400);
    expect((await res.json()).step).toBe(1);
    expect(s.calls).toEqual([]);
  });

  it("consent: both boxes and a name, recorded as in_app", async () => {
    const h = await handler("consent", "POST");
    s.consentDue = true;
    expect((await h(req("POST", { body: { guardian: true, terms: false, guardianName: "Tatsiana K" } }))).status).toBe(400);
    expect((await h(req("POST", { body: { guardian: true, terms: true, guardianName: "" } }))).status).toBe(400);
    const ok = await h(req("POST", { body: { guardian: true, terms: true, guardianName: "  Tatsiana   K " } }));
    expect(ok.status).toBe(200);
    expect(s.calls[0].args[0]).toMatchObject({ profileId: "u1", source: "in_app", guardianName: "Tatsiana K" });
  });

  it("password and delete pass the shared action's own answer through", async () => {
    const del = await handler("accountDelete", "POST");
    expect((await del(req("POST", { body: { password: "secret123" } }))).status).toBe(200);
    expect(s.calls[0]).toEqual({ fn: "deleteOwnAccount", args: ["secret123"] });
    const pw = await handler("accountPassword", "POST");
    await pw(req("POST", { body: { current: "a", next: "bbbbbbbb" } }));
    const form = s.calls[1].args[1] as FormData;
    expect(form.get("current")).toBe("a");
    expect(form.get("next")).toBe("bbbbbbbb");
  });
});

describe("throttling and failures", () => {
  it("rate limits a caller", async () => {
    const h = await handler("accountDelete", "POST");
    const r = () =>
      h(new Request("https://x/api", { method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "x-forwarded-for": "9.9.9.9" }, body: "{}" }));
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await r()).status);
    expect(codes.slice(0, 5).every((c) => c !== 429)).toBe(true);
    expect(codes.slice(5)).toEqual([429, 429]);
  });

  it("never hands the phone a web redirect", async () => {
    const { appRoute } = await import("@/lib/elite/app-api");
    const h = appRoute({ name: "t-redirect", access: "account" }, async () => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    });
    expect((await h(req("POST"))).status).toBe(409);
    const boom = appRoute({ name: "t-boom", access: "account" }, async () => {
      throw new Error("db down");
    });
    const res = await boom(req("POST"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server" });
  });

  it("answers are never cached", async () => {
    const h = await handler("me", "GET");
    const res = await h(req("GET"));
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
