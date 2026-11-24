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
  courses: [] as Record<string, unknown>[],
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

// The Courses library as getCourses returns it: a drill course, a lesson
// course, a link course with pages of its own, one with none, and one
// that is switched off.
function library(): Record<string, unknown>[] {
  const step = (over: Record<string, unknown>) => ({
    id: "s",
    course_id: "c",
    level_no: 1,
    level_name: null,
    tag: null,
    drill_id: null,
    drill: null,
    title: null,
    body: null,
    video_url: null,
    download_url: null,
    cue: null,
    pass_mark: null,
    sort: 10,
    ...over,
  });
  const drill = (id: string, title: string, file: string | null, active = true) => ({ id, title, video_url: file, active });
  return [
    {
      id: "c1",
      slug: "keep-it-up",
      name: "Keep It Up",
      subtitle: "The juggling ladder.",
      intro: "Pass the catch version first.\nThen move up.",
      kind: "drill",
      external_url: null,
      cover_url: null,
      active: true,
      sort: 10,
      steps: [
        step({ id: "k1", level_name: "One touch", tag: "beginner", drill_id: "d1", drill: drill("d1", "Juggling: one touch, catch", "/drills/juggling-one-touch-catch.mp4"), cue: "Lock the ankle.", pass_mark: "10 in a row" }),
        step({ id: "k2", level_no: 2, level_name: "Two touches each foot", tag: "advanced", drill_id: "d2", drill: drill("d2", "Juggling: two touches each foot, keep it up", "https://files.example.com/clip.mp4") }),
        // not filmed, and switched off in the bank: never sent
        step({ id: "k3", level_no: 2, drill_id: "d3", drill: drill("d3", "Juggling: unfilmed", null) }),
        step({ id: "k4", level_no: 2, drill_id: "d4", drill: drill("d4", "Juggling: off", "/drills/juggling-head-it-up.mp4", false) }),
      ],
    },
    {
      id: "c2",
      slug: "college-recruiting",
      name: "College Recruiting",
      subtitle: "The college route, part by part.",
      intro: null,
      kind: "lesson",
      external_url: null,
      cover_url: "/courses/college-recruiting.jpg",
      active: true,
      sort: 20,
      steps: [
        step({ id: "l1", level_name: "The CV", title: "The one-page CV", body: "One page.\n\nTEMPLATE\n[Full name]\n[Graduation year]\n\nRULES OF THUMB\n\nFacts only.", download_url: "/downloads/cv.pdf" }),
      ],
    },
    {
      id: "c3",
      slug: "dribbling-transformation",
      name: "Dribbling Transformation",
      subtitle: "Most dangerous dribbler on the team.",
      intro: "The password is on this page.",
      kind: "link",
      external_url: "https://course.example.com/",
      cover_url: null,
      active: true,
      sort: 15,
      steps: [step({ id: "t1", level_name: "Start here", title: "Welcome", body: "Train five days a week." })],
    },
    { id: "c4", slug: "outside-only", name: "Outside Only", subtitle: null, intro: "pw", kind: "link", external_url: "https://course.example.com/x", cover_url: null, active: true, sort: 30, steps: [] },
    {
      id: "c5",
      slug: "not-yet",
      name: "Not Yet",
      subtitle: null,
      intro: null,
      kind: "lesson",
      external_url: null,
      cover_url: null,
      active: false,
      sort: 40,
      steps: [step({ id: "n1", title: "Soon", body: "Soon." })],
    },
  ];
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
  // as the real getters: active courses for the shelf, any course by its slug
  getCourses: async () => (s.calls.push({ fn: "getCourses", args: [] }), s.courses.filter((c) => c.active)),
  getCourse: async (slug: string) => (s.calls.push({ fn: "getCourse", args: [slug] }), s.courses.find((c) => c.slug === slug) ?? null),
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
vi.mock("@/lib/elite/profile-actions", () => ({
  checkUsername: async (n: string) => (s.calls.push({ fn: "checkUsername", args: [n] }), { ok: true, name: n }),
  saveUsername: async (n: string) => (s.calls.push({ fn: "saveUsername", args: [n] }), { ok: true, name: n }),
  myUsernameIdeas: async () => ["marcus.b"],
}));
vi.mock("@/app/api/elite/profile/photo/route", () => ({
  GET: async () => (s.calls.push({ fn: "readPhoto", args: [] }), new Response("jpeg", { status: 200 })),
  POST: async () => (s.calls.push({ fn: "storePhoto", args: [] }), new Response(JSON.stringify({ ok: true }), { status: 200 })),
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
  username: () => import("@/app/api/app/profile/username/route"),
  photo: () => import("@/app/api/app/profile/photo/route"),
  courses: () => import("@/app/api/app/courses/route"),
  course: () => import("@/app/api/app/courses/[slug]/route"),
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
  { route: "username", method: "GET", access: "player" },
  { route: "username", method: "POST", access: "player" },
  { route: "photo", method: "GET", access: "player" },
  { route: "photo", method: "POST", access: "player" },
  { route: "courses", method: "GET", access: "account" },
  { route: "course", method: "GET", access: "member" },
];

async function handler(route: keyof typeof ROUTES, method: string) {
  const mod = (await ROUTES[route]()) as unknown as Record<string, (r: Request, ctx?: unknown) => Promise<Response>>;
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
  s.courses = library();
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

  it("username: a check or a save, through the website's own actions", async () => {
    const h = await handler("username", "POST");
    expect((await h(req("POST", { body: {} }))).status).toBe(400);
    await h(req("POST", { body: { username: "Marcus.B", check: true } }));
    await h(req("POST", { body: { username: "marcus.b" } }));
    expect(s.calls.map((c) => c.fn)).toEqual(["checkUsername", "saveUsername"]);
    const ideas = await (await (await handler("username", "GET"))(req("GET"))).json();
    expect(ideas).toEqual({ ideas: ["marcus.b"] });
  });

  it("photo: the website's own route serves and stores it", async () => {
    expect((await (await handler("photo", "GET"))(req("GET"))).status).toBe(200);
    expect((await (await handler("photo", "POST"))(req("POST", { body: {} }))).status).toBe(200);
    expect(s.calls.map((c) => c.fn)).toEqual(["readPhoto", "storePhoto"]);
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

describe("the Courses library", () => {
  const course = async (slug: string) => (await handler("course", "GET"))(req("GET"), { params: { slug } });

  it("a member gets the shelf the website shows, open, in its order", async () => {
    const body = await (await (await handler("courses", "GET"))(req("GET"))).json();
    expect(body.locked).toBe(false);
    // a link course is its own pages inside the app; one with none is left out; an off course is not there
    expect(body.courses.map((c: { slug: string }) => c.slug)).toEqual(["keep-it-up", "dribbling-transformation", "college-recruiting"]);
    expect(body.courses.every((c: { locked: boolean }) => c.locked === false)).toBe(true);
    // the cover: the coach's picture, else the still of the first filmed drill, as a whole address
    expect(body.courses[0].cover).toBe("https://thestriveapp.com/drills/posters/juggling-one-touch-catch.jpg");
    expect(body.courses[2].cover).toBe("https://thestriveapp.com/courses/college-recruiting.jpg");
    expect(body.courses[1].cover).toBeNull();
  });

  it("an account that is not a member gets the shelf locked: name, line and picture, never a step", async () => {
    const locked = async () => {
      const res = await (await handler("courses", "GET"))(req("GET"));
      expect(res.status).toBe(200);
      return res.json();
    };
    const check = (body: { locked: boolean; courses: Record<string, unknown>[] }) => {
      expect(body.locked).toBe(true);
      expect(body.courses.length).toBe(3);
      for (const c of body.courses) {
        expect(Object.keys(c).sort()).toEqual(["cover", "locked", "name", "slug", "subtitle"]);
        expect(c.locked).toBe(true);
      }
      expect(JSON.stringify(body)).not.toMatch(/Lock the ankle|Facts only|password|Train five days|video|steps|levels/);
    };
    // a free account: no player record, a free training log
    s.viewer = viewer({ playerId: null });
    s.tracker = { id: "t1" };
    check(await locked());
    // and anyone else the gate keeps out of the member app
    s.viewer = viewer();
    s.player = player({ tier: "elite", subscription_status: "paused" });
    check(await locked());
    s.viewer = viewer({ role: "coach", playerId: null });
    check(await locked());
  });

  it("a single course is refused to an account that is not a member, before it is read", async () => {
    s.viewer = viewer({ playerId: null });
    s.tracker = { id: "t1" };
    const res = await course("keep-it-up");
    expect(res.status).toBe(403);
    expect((await res.json()).state.kind).toBe("free");
    expect(s.calls).toEqual([]);
  });

  it("a member gets a course as the website shows it", async () => {
    const res = await course("keep-it-up");
    expect(res.status).toBe(200);
    const { course: c } = await res.json();
    expect(c).toMatchObject({ slug: "keep-it-up", name: "Keep It Up", kind: "drill", intro: ["Pass the catch version first.", "Then move up."] });
    expect(c.levels.map((l: { label: string; name: string }) => [l.label, l.name])).toEqual([
      ["Level 1", "One touch"],
      ["Level 2", "Two touches each foot"],
    ]);
    // the drill's own name, its clip and still as whole addresses, the cue, the pass mark
    expect(c.levels[0].steps).toEqual([
      {
        id: "k1",
        kind: "drill",
        title: "One touch, catch",
        tag: "beginner",
        cue: "Lock the ankle.",
        passMark: "10 in a row",
        blocks: [],
        video: "https://thestriveapp.com/drills/juggling-one-touch-catch.mp4",
        poster: "https://thestriveapp.com/drills/posters/juggling-one-touch-catch.jpg",
        download: null,
      },
    ]);
    // an unfilmed drill and one switched off in the bank are never sent; a clip hosted elsewhere has no still
    expect(c.levels[1].steps.map((x: { id: string }) => x.id)).toEqual(["k2"]);
    expect(c.levels[1].steps[0]).toMatchObject({ video: "https://files.example.com/clip.mp4", poster: null, tag: "advanced" });
  });

  it("a lesson course comes as pages, its words unchanged", async () => {
    const { course: c } = await (await course("college-recruiting")).json();
    expect(c.kind).toBe("lesson");
    expect(c.levels[0]).toMatchObject({ label: "Part 1", name: "The CV" });
    const page = c.levels[0].steps[0];
    expect(page).toMatchObject({ kind: "lesson", title: "The one-page CV", video: null, download: "https://thestriveapp.com/downloads/cv.pdf" });
    expect(page.blocks).toEqual([
      { heading: null, text: "One page." },
      { heading: "TEMPLATE", text: "[Full name]\n[Graduation year]" },
      { heading: "RULES OF THUMB", text: "" },
      { heading: null, text: "Facts only." },
    ]);
  });

  it("a link course is its own pages, without its address or its password", async () => {
    const res = await course("dribbling-transformation");
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toMatch(/example\.com|password/);
    const c = JSON.parse(text).course;
    expect(c).toMatchObject({ kind: "lesson", intro: [] });
    expect(c.levels[0].steps[0].title).toBe("Welcome");
  });

  it("answers 404 for a course that is not on the shelf", async () => {
    for (const slug of ["nope", "not-yet", "outside-only", "../week", "Keep-It-Up", ""]) {
      const res = await course(slug);
      expect(res.status, slug).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    }
    // a slug that is not one never reaches the database
    expect(s.calls.map((c) => c.args[0])).toEqual(["nope", "not-yet", "outside-only"]);
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
