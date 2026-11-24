import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Strive Pro (074, Coach Yinka Nov 20 2026): $29 a month, paid by card,
// the weekly plan and the courses, none of the coach's own time. What is
// held here: the price is one number, what Pro sees is one rule, sign-up
// creates a Pro member that is NOT switched on, the checkout is only for
// the signed-in Pro member with the price written inline, and only a
// paid Pro checkout (verified by its signature) switches a Pro member on.

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

// ---- A small stand-in for the database ---------------------------------
type Row = Record<string, unknown>;
const state = {
  rows: {} as Record<string, Row[]>,
  upserts: [] as { table: string; row: Row; opts?: unknown }[],
  created: [] as Row[],
  deletedUsers: [] as string[],
  createError: null as string | null,
  playerInsertError: false,
  serviceClient: true,
  stripeOn: true,
  viewer: null as null | Row,
  sessionsCreated: [] as Row[],
  retrieved: null as null | Row,
  consents: [] as Row[],
  signIns: [] as Row[],
  freeAccount: false,
  rateOk: true,
};

class Query {
  private filters: [string, unknown, "eq" | "in"][] = [];
  private patch: Row | null = null;
  constructor(private table: string) {}
  select() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  not() {
    return this;
  }
  eq(col: string, v: unknown) {
    this.filters.push([col, v, "eq"]);
    return this;
  }
  in(col: string, v: unknown) {
    this.filters.push([col, v, "in"]);
    return this;
  }
  private matching(): Row[] {
    return (state.rows[this.table] ?? []).filter((r) =>
      this.filters.every(([c, v, k]) => (k === "eq" ? r[c] === v : (v as unknown[]).includes(r[c])))
    );
  }
  update(patch: Row) {
    this.patch = patch;
    return this;
  }
  insert(row: Row) {
    if (this.table === "elite_players" && state.playerInsertError) return Promise.resolve({ error: { message: "x" } });
    (state.rows[this.table] ??= []).push({ ...row });
    return Promise.resolve({ error: null });
  }
  upsert(row: Row, opts?: unknown) {
    state.upserts.push({ table: this.table, row, opts });
    return Promise.resolve({ error: null });
  }
  async maybeSingle() {
    return { data: this.matching()[0] ?? null, error: null };
  }
  then(resolve: (v: unknown) => void) {
    if (this.patch) {
      for (const r of this.matching()) Object.assign(r, this.patch);
      return resolve({ error: null });
    }
    return resolve({ data: this.matching(), error: null });
  }
}

function admin() {
  return {
    auth: {
      admin: {
        createUser: async (input: Row) => {
          if (state.createError) return { data: null, error: { message: state.createError } };
          state.created.push(input);
          return { data: { user: { id: "11111111-1111-1111-1111-111111111111" } }, error: null };
        },
        deleteUser: async (id: string) => {
          state.deletedUsers.push(id);
          return { error: null };
        },
      },
    },
    from: (table: string) => new Query(table),
  };
}

vi.mock("@/lib/elite/supabase/server", () => ({
  createServiceClient: () => (state.serviceClient ? admin() : null),
  createClient: () => null,
  isSupabaseConfigured: () => true,
}));
vi.mock("@/lib/stripe", () => ({
  isStripeConfigured: () => state.stripeOn,
  stripe: () => ({
    checkout: {
      sessions: {
        create: async (params: Row) => {
          state.sessionsCreated.push(params);
          return { url: "https://checkout.stripe.com/c/pay/cs_test_123" };
        },
        retrieve: async () => state.retrieved,
      },
    },
    webhooks: {
      constructEvent: (raw: string, sig: string, secret: string) => {
        if (sig !== "good-signature" || secret !== "whsec_test") throw new Error("No signatures found");
        return JSON.parse(raw);
      },
    },
  }),
}));
vi.mock("@/lib/elite/session", () => ({ getViewer: async () => state.viewer }));
vi.mock("@/lib/elite/session-start", () => ({
  establishSession: async (email: string, password: string) => {
    state.signIns.push({ email, password });
    return true;
  },
}));
vi.mock("@/lib/elite/tracker-server", () => ({ emailHasFreeAccount: async () => state.freeAccount }));
vi.mock("@/lib/elite/legal-server", () => ({
  recordConsent: async (row: Row) => {
    state.consents.push(row);
    return true;
  },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => state.rateOk, clientIp: () => "1.2.3.4" }));

import { POST as signup } from "@/app/api/elite/pro/signup/route";
import { POST as checkout } from "@/app/api/elite/pro/checkout/route";
import { POST as webhook } from "@/app/api/elite/stripe/webhook/route";
import {
  PRO_MONTHLY_CENTS,
  PRO_PRICE_LINE,
  PRO_AGREEMENT_POINTS,
  PRO_ENDED_GATE,
  PRO_UNPAID_GATE,
  PAYMENTS_OFF_MESSAGE,
  PRO_FREE_ACCOUNT_MESSAGE,
  priceLabel,
  proAccessFor,
  proActivation,
  proAgeStatement,
  proCheckoutParams,
} from "@/lib/elite/pro";
import { FEATURES, featureOn, tabOn, tierChip, tierOf } from "@/lib/elite/tiers";
import { gateFor, membershipGate, proMembershipGate } from "@/lib/elite/gates";
import { FREE_AGE_STATEMENT } from "@/lib/elite/tracker";
import { GUARDIAN_STATEMENT } from "@/lib/elite/legal";
import { appScreenRedirect } from "@/lib/elite/app-review";

const PROFILE = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  Object.assign(state, {
    rows: {},
    upserts: [],
    created: [],
    deletedUsers: [],
    createError: null,
    playerInsertError: false,
    serviceClient: true,
    stripeOn: true,
    viewer: null,
    sessionsCreated: [],
    retrieved: null,
    consents: [],
    signIns: [],
    freeAccount: false,
    rateOk: true,
  });
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

// ---- The price -----------------------------------------------------------
describe("the price is one number", () => {
  it("is $29 a month, his number", () => {
    expect(PRO_MONTHLY_CENTS).toBe(2900);
    expect(priceLabel()).toBe("$29");
    expect(PRO_PRICE_LINE).toBe("$29 a month");
    expect(priceLabel(3450)).toBe("$34.50");
  });

  it("no Pro screen writes the price by hand", () => {
    for (const f of ["app/(public)/pro/page.tsx", "app/(public)/pro/join/page.tsx", "components/elite/ProJoinForm.tsx"]) {
      expect(read(f), f).not.toMatch(/\$\d/);
    }
  });
});

// ---- What each offer sees -----------------------------------------------
describe("what Pro sees is one rule", () => {
  it("Pro has none of the coach's own time", () => {
    for (const f of FEATURES) expect(featureOn("pro", f), f).toBe(false);
    expect(tabOn("pro", "/film")).toBe(false);
    expect(tabOn("pro", "/messages")).toBe(false);
    for (const t of ["/dashboard", "/homework", "/courses"]) expect(tabOn("pro", t), t).toBe(true);
  });

  it("Elite and Complete keep exactly what they had", () => {
    for (const f of ["filmRoom", "coachChat", "monthlyCheckin", "sendClip", "progressVideo", "program"] as const) {
      expect(featureOn("elite", f), f).toBe(true);
    }
    for (const f of ["filmTimeline", "coachingCalls", "parentReport"] as const) expect(featureOn("elite", f), f).toBe(false);
    for (const f of FEATURES) expect(featureOn("complete", f), f).toBe(true);
    // no tier (demo data, pre-029 rows) behaves as before tiers existed
    expect(tierOf(null)).toBe("complete");
    expect(tierOf("nonsense")).toBe("complete");
    expect(tierChip("pro")).toBe("Pro");
    expect(tierChip("complete")).toBe("Complete");
    expect(tierChip("elite")).toBeNull();
  });

  it("no screen compares a tier string itself", () => {
    for (const f of [
      "app/(player)/layout.tsx",
      "app/(player)/dashboard/page.tsx",
      "app/(player)/film/page.tsx",
      "app/(player)/messages/page.tsx",
      "app/(player)/homework/page.tsx",
      "app/(coach)/coach/page.tsx",
      "lib/elite/parent-recap.ts",
    ]) {
      expect(read(f), f).not.toMatch(/tier\s*[!=]==\s*"/);
    }
  });

  it("the shell, the pages and the server actions all ask the rule", () => {
    expect(read("app/(player)/layout.tsx")).toContain("memberTabs(player?.tier, social)");
    expect(read("lib/elite/experience.ts")).toContain("tabOn(tier, COACH_TAB.href)");
    expect(read("app/(player)/film/page.tsx")).toContain('featureOn(player.tier, "filmRoom")) redirect("/dashboard")');
    expect(read("app/(player)/messages/page.tsx")).toContain('featureOn(player?.tier, "coachChat")) redirect("/dashboard")');
    const dash = read("app/(player)/dashboard/page.tsx");
    for (const f of ["coachChat", "sendClip", "progressVideo", "monthlyCheckin", "coachingCalls"]) {
      expect(dash, f).toContain(`featureOn(player.tier, "${f}")`);
    }
    const actions = read("lib/elite/player-actions.ts");
    for (const f of ["coachChat", "sendClip", "progressVideo", "filmRoom"]) {
      expect(actions, f).toContain(`memberHasFeature(viewer.playerId, "${f}")`);
    }
    const room = read("lib/elite/film-room-actions.ts");
    expect(room).toContain('memberHasFeature(viewer.playerId, "filmRoom")');
    expect(room).toContain('memberHasFeature(viewer.playerId, "monthlyCheckin")');
    // announcements reach only members whose offer includes them
    expect(room).toContain('"film_room", "filmRoom"');
    expect(room).toContain('"checkin_open", "monthlyCheckin"');
    expect(read("lib/elite/program-actions.ts")).toContain('featureOn((player as { tier?: string | null }).tier, "program")');
    expect(read("lib/elite/parent-recap.ts")).toContain('"parentReport"');
  });

  it("the database allows the tier, and only the server or a coach may set it", () => {
    const sql = read("supabase/migrations/074_strive_pro.sql");
    expect(sql).toContain("check (tier in ('elite', 'complete', 'pro'))");
    expect(sql).toContain("drop constraint if exists elite_players_tier_check");
    expect(sql).toContain("unique index if not exists elite_subs_checkout_session_idx");
    // the 029 guard still covers tier (unchanged, so not redefined here)
    expect(read("supabase/migrations/029_complete_pathway.sql")).toContain("NEW.tier is distinct from OLD.tier");
  });
});

// ---- The screens before the app -------------------------------------------
describe("an unpaid or ended Pro membership sees the checkout", () => {
  it("offers Start Strive Pro, never the coach's email", () => {
    expect(proMembershipGate("none")).toMatchObject({ ...PRO_UNPAID_GATE, startPro: true, emailCoach: false });
    expect(proMembershipGate("canceled")).toMatchObject({ ...PRO_ENDED_GATE, startPro: true });
    expect(proMembershipGate("active")).toBeNull();
    expect(gateFor("none", "pro")?.startPro).toBe(true);
    // Elite is untouched
    expect(gateFor("none", "elite")).toEqual(membershipGate("none"));
    expect(gateFor("none", null)?.startPro).toBeUndefined();
  });

  it("the shell shows it before the quiz: pay first, then the quiz", () => {
    const layout = read("app/(player)/layout.tsx");
    expect(layout.indexOf("if (gate?.startPro)")).toBeLessThan(layout.indexOf('redirect("/onboarding")'));
    expect(read("app/onboarding/page.tsx")).toContain("confirmProReturn(viewer.profile.id, sessionId)");
  });
});

// ---- Who agrees ------------------------------------------------------------
describe("the agreement at sign-up", () => {
  it("13 or older ticks the free app's box; under 13 a parent ticks the members' box", () => {
    expect(proAgeStatement({ month: 1, year: 2012 }, "2026-11-20")).toBe(FREE_AGE_STATEMENT); // 14
    expect(proAgeStatement({ month: 1, year: 2008 }, "2026-11-20")).toBe(FREE_AGE_STATEMENT); // 18
    expect(proAgeStatement({ month: 6, year: 2015 }, "2026-11-20")).toBe(GUARDIAN_STATEMENT); // 11
  });

  it("says the price, the card, and how to cancel, in house words", () => {
    const all = [...PRO_AGREEMENT_POINTS, PRO_UNPAID_GATE.body, PRO_ENDED_GATE.body, PAYMENTS_OFF_MESSAGE, PRO_FREE_ACCOUNT_MESSAGE].join(" ");
    expect(all).toContain("$29 a month");
    expect(all).toContain("Cancel anytime from Account");
    expect(all).not.toMatch(/—/);
    const page = read("app/(public)/pro/page.tsx") + read("components/elite/ProJoinForm.tsx");
    expect(page).not.toMatch(/—|\bAI\b|automated|algorithm|guarantee|spots left|only \d/i);
  });
});

// ---- Sign-up ---------------------------------------------------------------
const good = {
  firstName: "Anthony",
  lastName: "Example",
  email: "A@Example.com",
  phone: "(703) 555-0100",
  password: "longenough",
  birth: { month: 3, year: 2011 },
  agreed: { guardian: true, terms: true },
};
const postSignup = (body: unknown) =>
  signup(
    new Request("https://thestriveapp.com/api/elite/pro/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", "user-agent": "test" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );

describe("Pro sign-up", () => {
  it("creates nothing while payments are off", async () => {
    state.stripeOn = false;
    const res = await postSignup(good);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe(PAYMENTS_OFF_MESSAGE);
    expect(state.created).toHaveLength(0);
  });

  it("refuses without the birth month and year, both boxes or the fields", async () => {
    expect((await postSignup({ ...good, birth: undefined })).status).toBe(400);
    for (const agreed of [undefined, {}, { guardian: true }, { guardian: "true", terms: true }]) {
      expect((await postSignup({ ...good, agreed })).status).toBe(400);
    }
    for (const bad of [{ password: "short" }, { lastName: "" }, { email: "nope" }, { phone: "123" }]) {
      expect((await postSignup({ ...good, ...bad })).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await postSignup("{junk")).status).toBe(400);
    state.rateOk = false;
    expect((await postSignup(good)).status).toBe(429);
    expect(state.created).toHaveLength(0);
  });

  it("makes the login, the profile and a Pro member that is NOT switched on, then signs in", async () => {
    state.rows.elite_profiles = [{ id: "coach-1", role: "admin" }];
    const res = await postSignup(good);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, signedIn: true });
    expect(state.created[0]).toMatchObject({
      email: "a@example.com",
      email_confirm: true,
      app_metadata: { role: "player" },
    });
    const player = state.rows.elite_players[0];
    expect(player).toMatchObject({
      profile_id: PROFILE,
      coach_id: "coach-1",
      full_name: "Anthony Example",
      tier: "pro",
      subscription_status: "none",
      parent_email: "a@example.com",
    });
    expect(player.subscription_status).not.toBe("active");
    expect(state.consents).toEqual([{ profileId: PROFILE, source: "signup", userAgent: "test" }]);
    expect(state.signIns).toEqual([{ email: "a@example.com", password: "longenough" }]);
  });

  it("says plainly when the email already has a free account", async () => {
    state.createError = "A user with this email address has already been registered";
    state.freeAccount = true;
    const res = await postSignup(good);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: PRO_FREE_ACCOUNT_MESSAGE, reason: "free_account" });
    state.freeAccount = false;
    expect(await (await postSignup(good)).json()).toMatchObject({ reason: "exists" });
  });

  it("takes the login back out if the member row cannot be made", async () => {
    state.playerInsertError = true;
    expect((await postSignup(good)).status).toBe(500);
    expect(state.deletedUsers).toEqual([PROFILE]);
  });
});

// ---- Checkout --------------------------------------------------------------
const proViewer = { profile: { id: PROFILE, email: "a@example.com" }, role: "player", playerId: "p-1", demo: false };

describe("the Pro checkout", () => {
  it("builds a $29 monthly subscription inline, tagged pro, for the profile given", () => {
    const p = proCheckoutParams({ profileId: PROFILE, email: "a@example.com", appUrl: "https://thestriveapp.com/" });
    expect(p.mode).toBe("subscription");
    expect(p.client_reference_id).toBe(PROFILE);
    expect(p.metadata).toEqual({ plan: "pro", profile_id: PROFILE });
    expect(p.line_items).toEqual([
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 2900,
          recurring: { interval: "month" },
          product_data: { name: "Strive Pro" },
        },
      },
    ]);
    expect(p.success_url).toBe("https://thestriveapp.com/onboarding?session_id={CHECKOUT_SESSION_ID}");
    expect(p.cancel_url).toBe("https://thestriveapp.com/pro");
    expect(p.customer_email).toBe("a@example.com");
    expect(proCheckoutParams({ profileId: PROFILE, email: "x", appUrl: "https://x", customerId: "cus_1" }).customer).toBe("cus_1");
  });

  it("is off while payments are off, and only for a signed-in member", async () => {
    state.stripeOn = false;
    expect((await checkout()).status).toBe(503);
    state.stripeOn = true;
    expect((await checkout()).status).toBe(401);
    state.viewer = { ...proViewer, demo: true };
    expect((await checkout()).status).toBe(401);
    expect(state.sessionsCreated).toHaveLength(0);
  });

  it("refuses a member who is not on Pro, and one who is already on", async () => {
    state.viewer = proViewer;
    state.rows.elite_players = [{ id: "p-1", tier: "elite", subscription_status: "none" }];
    expect((await checkout()).status).toBe(403);
    state.rows.elite_players = [{ id: "p-1", tier: "pro", subscription_status: "active" }];
    expect((await checkout()).status).toBe(409);
    expect(state.sessionsCreated).toHaveLength(0);
  });

  it("opens the checkout for the signed-in Pro member, from the session alone", async () => {
    state.viewer = proViewer;
    state.rows.elite_players = [{ id: "p-1", tier: "pro", subscription_status: "none" }];
    const res = await checkout();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_123" });
    expect(state.sessionsCreated).toHaveLength(1);
    const p = state.sessionsCreated[0] as { client_reference_id: string; line_items: { price_data: { unit_amount: number } }[] };
    expect(p.client_reference_id).toBe(PROFILE);
    expect(p.line_items[0].price_data.unit_amount).toBe(PRO_MONTHLY_CENTS);
    // the route takes no request at all, so nothing in a body can steer it
    expect(checkout.length).toBe(0);
  });
});

// ---- The webhook -------------------------------------------------------------
const event = (type: string, object: Row) => JSON.stringify({ type, data: { object } });
const hook = (raw: string, sig = "good-signature") =>
  webhook(new Request("https://thestriveapp.com/api/elite/stripe/webhook", { method: "POST", headers: { "stripe-signature": sig }, body: raw }));
const paid = {
  id: "cs_test_123",
  mode: "subscription",
  payment_status: "paid",
  client_reference_id: PROFILE,
  metadata: { plan: "pro", profile_id: PROFILE },
  customer: "cus_1",
  subscription: "sub_1",
};

describe("the Stripe webhook and Pro", () => {
  it("reads who paid from our own tag, never the typed email, and agrees with itself", () => {
    expect(proActivation(paid)).toEqual({ profileId: PROFILE });
    expect(proActivation({ ...paid, payment_status: "unpaid" })).toBeNull();
    expect(proActivation({ ...paid, metadata: { plan: "monthly", profile_id: PROFILE } })).toBeNull();
    expect(proActivation({ ...paid, metadata: { plan: "pro", profile_id: OTHER } })).toBeNull();
    expect(proActivation({ ...paid, mode: "payment" })).toBeNull();
    expect(proActivation({ ...paid, client_reference_id: "not-a-uuid", metadata: { plan: "pro" } })).toBeNull();
  });

  it("moves access only for a running or ended subscription", () => {
    expect(proAccessFor("active", false)).toBe("active");
    expect(proAccessFor("trialing", false)).toBe("trialing");
    expect(proAccessFor("canceled", false)).toBe("canceled");
    expect(proAccessFor("active", true)).toBe("canceled");
    expect(proAccessFor("incomplete", false)).toBeNull();
    expect(proAccessFor("past_due", false)).toBeNull();
  });

  it("refuses an event without a good signature", async () => {
    state.rows.elite_players = [{ id: "p-1", profile_id: PROFILE, tier: "pro", subscription_status: "none" }];
    expect((await hook(event("checkout.session.completed", paid), "forged")).status).toBe(400);
    expect(state.rows.elite_players[0].subscription_status).toBe("none");
  });

  it("switches a paid Pro member on, once per checkout", async () => {
    state.rows.elite_players = [{ id: "p-1", profile_id: PROFILE, tier: "pro", subscription_status: "none" }];
    expect((await hook(event("checkout.session.completed", paid))).status).toBe(200);
    expect(state.rows.elite_players[0].subscription_status).toBe("active");
    expect(state.upserts[0]).toMatchObject({
      table: "elite_subscriptions",
      row: { profile_id: PROFILE, stripe_subscription_id: "sub_1", stripe_checkout_session_id: "cs_test_123", status: "active", plan: "pro" },
      opts: { onConflict: "stripe_checkout_session_id" },
    });
  });

  it("never switches on an Elite family, an unpaid checkout or a profile with no member row", async () => {
    state.rows.elite_players = [{ id: "p-1", profile_id: PROFILE, tier: "elite", subscription_status: "none" }];
    await hook(event("checkout.session.completed", paid));
    expect(state.rows.elite_players[0].subscription_status).toBe("none");
    state.rows.elite_players = [{ id: "p-1", profile_id: PROFILE, tier: "pro", subscription_status: "none" }];
    await hook(event("checkout.session.completed", { ...paid, payment_status: "unpaid" }));
    await hook(event("checkout.session.completed", { ...paid, client_reference_id: OTHER, metadata: { plan: "pro", profile_id: OTHER } }));
    expect(state.rows.elite_players[0].subscription_status).toBe("none");
    expect(state.upserts).toHaveLength(0);
  });

  it("switches a Pro member off when the subscription ends, and leaves Elite alone", async () => {
    state.rows.elite_subscriptions = [
      { stripe_subscription_id: "sub_1", profile_id: PROFILE },
      { stripe_subscription_id: "sub_2", profile_id: OTHER },
    ];
    state.rows.elite_players = [
      { id: "p-1", profile_id: PROFILE, tier: "pro", subscription_status: "active" },
      { id: "p-2", profile_id: OTHER, tier: "elite", subscription_status: "active" },
    ];
    await hook(event("customer.subscription.updated", { id: "sub_1", status: "incomplete", items: { data: [] } }));
    expect(state.rows.elite_players[0].subscription_status).toBe("active");
    await hook(event("customer.subscription.deleted", { id: "sub_1", status: "canceled", items: { data: [] } }));
    await hook(event("customer.subscription.deleted", { id: "sub_2", status: "canceled", items: { data: [] } }));
    expect(state.rows.elite_players[0].subscription_status).toBe("canceled");
    expect(state.rows.elite_players[1].subscription_status).toBe("active");
  });
});

// ---- The App Store app ---------------------------------------------------------
describe("Pro inside the App Store app", () => {
  const APP = "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 StriveEliteApp/1";
  it("draws the Pro page and its sign-up, and the sign-in screen offers it", () => {
    expect(appScreenRedirect("/pro", APP)).toBeNull();
    expect(appScreenRedirect("/pro/join", APP)).toBeNull();
    const form = read("components/elite/LoginForm.tsx");
    expect(form).toContain("Join Strive Pro");
    // offered outside the {!native && (...)} block, so in the app too
    expect(form.slice(0, form.indexOf("{!native && ("))).not.toContain("Join Strive Pro");
    expect(form.indexOf("Join Strive Pro")).toBeGreaterThan(form.indexOf("{!native && ("));
  });
});
