import { beforeEach, describe, expect, it, vi } from "vitest";

// The free sign-up route (migration 069), with the database stood in for.
// What is held here: it is closed unless a coach opened it, nothing is
// created without the two boxes and the fields, a bad teammate code never
// stops a sign-up, and a player record is never made.

type Row = Record<string, unknown>;
const state = {
  open: false,
  serviceClient: true,
  created: [] as Row[],
  deletedUsers: [] as string[],
  inserts: [] as { table: string; row: Row }[],
  upserts: [] as { table: string; row: Row }[],
  referralOwner: null as string | null, // profile id that owns the looked-up code
  lookedUp: [] as string[],
  trackerInsertFails: 0,
  createError: null as string | null,
  signInError: false,
  consents: [] as Row[],
  rateOk: true,
};

function admin() {
  return {
    auth: {
      admin: {
        createUser: async (input: Row) => {
          if (state.createError) return { data: null, error: { message: state.createError } };
          state.created.push(input);
          return { data: { user: { id: "user-1" } }, error: null };
        },
        deleteUser: async (id: string) => {
          state.deletedUsers.push(id);
          return { error: null };
        },
      },
    },
    from(table: string) {
      return {
        upsert: async (row: Row) => {
          state.upserts.push({ table, row });
          return { error: null };
        },
        insert: async (row: Row) => {
          if (table === "elite_trackers" && state.trackerInsertFails > 0) {
            state.trackerInsertFails--;
            return { error: { message: "duplicate key" } };
          }
          state.inserts.push({ table, row });
          return { error: null };
        },
        select: () => ({
          eq: (_col: string, value: string) => ({
            maybeSingle: async () => {
              state.lookedUp.push(value);
              return { data: state.referralOwner ? { profile_id: state.referralOwner } : null };
            },
          }),
        }),
      };
    },
  };
}

vi.mock("@/lib/elite/supabase/server", () => ({
  createServiceClient: () => (state.serviceClient ? admin() : null),
  createClient: () => ({
    auth: {
      signInWithPassword: async () => ({ error: state.signInError ? { message: "no" } : null }),
    },
  }),
}));
vi.mock("@/lib/elite/tracker-server", () => ({ isFreeSignupOpen: async () => state.open }));
vi.mock("@/lib/elite/legal-server", () => ({
  recordConsent: async (row: Row) => {
    state.consents.push(row);
    return true;
  },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => state.rateOk, clientIp: () => "1.2.3.4" }));

import { POST } from "@/app/api/elite/auth/join/route";

const good = {
  firstName: "Anthony",
  lastName: "Example",
  email: "A@Example.com",
  phone: "(703) 555-0100",
  password: "longenough",
  agreed: { guardian: true, terms: true },
};

const post = (body: unknown) =>
  POST(
    new Request("https://thestriveapp.com/api/elite/auth/join", {
      method: "POST",
      headers: { "Content-Type": "application/json", "user-agent": "test" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );

beforeEach(() => {
  Object.assign(state, {
    open: true,
    serviceClient: true,
    created: [],
    deletedUsers: [],
    inserts: [],
    upserts: [],
    referralOwner: null,
    lookedUp: [],
    trackerInsertFails: 0,
    createError: null,
    signInError: false,
    consents: [],
    rateOk: true,
  });
});

describe("free sign-up", () => {
  it("is closed until a coach opens it, and creates nothing while closed", async () => {
    state.open = false;
    const res = await post(good);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBe("closed");
    expect(body.error).toContain("not open yet");
    expect(state.created).toHaveLength(0);
    expect(state.inserts).toHaveLength(0);
  });

  it("refuses without both boxes ticked for real", async () => {
    for (const agreed of [undefined, {}, { guardian: true }, { guardian: true, terms: "true" }]) {
      const res = await post({ ...good, agreed });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("Tick both boxes");
    }
    expect(state.created).toHaveLength(0);
  });

  it("refuses a short password, a missing name, a bad email or no phone", async () => {
    for (const bad of [
      { password: "short" },
      { lastName: "" },
      { email: "nope" },
      { phone: "" },
    ]) {
      const res = await post({ ...good, ...bad });
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    expect(state.created).toHaveLength(0);
  });

  it("refuses junk and too many tries", async () => {
    expect((await post("{not json")).status).toBe(400);
    state.rateOk = false;
    expect((await post(good)).status).toBe(429);
    expect(state.created).toHaveLength(0);
  });

  it("makes the login, the profile and the free account, signs in, and never a player record", async () => {
    const res = await post(good);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, signedIn: true, next: "/log" });

    expect(state.created).toHaveLength(1);
    expect(state.created[0]).toMatchObject({
      email: "a@example.com",
      email_confirm: true,
      user_metadata: { full_name: "Anthony Example", role: "player" },
    });
    expect(state.upserts).toEqual([
      {
        table: "elite_profiles",
        row: { id: "user-1", role: "player", full_name: "Anthony Example", email: "a@example.com" },
      },
    ]);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0].table).toBe("elite_trackers");
    expect(state.inserts[0].row).toMatchObject({
      profile_id: "user-1",
      phone: "+17035550100",
      referred_by: null,
    });
    expect(state.inserts[0].row.referral_code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(state.inserts.some((i) => i.table === "elite_players")).toBe(false);
    expect(state.consents).toEqual([{ profileId: "user-1", source: "signup", userAgent: "test" }]);
  });

  it("records who sent them when the link carried a real teammate's code", async () => {
    state.referralOwner = "sender-9";
    const res = await post({ ...good, ref: "abcdefgh" });
    expect(res.status).toBe(200);
    expect(state.lookedUp).toEqual(["ABCDEFGH"]);
    expect(state.inserts[0].row.referred_by).toBe("sender-9");
  });

  it("a bad or unknown code is ignored and never stops a sign-up", async () => {
    // not a code at all: never even looked up
    let res = await post({ ...good, ref: "'; drop table x; --" });
    expect(res.status).toBe(200);
    expect(state.lookedUp).toEqual([]);
    expect(state.inserts[0].row.referred_by).toBeNull();

    // shaped like a code, belongs to nobody
    state.inserts = [];
    res = await post({ ...good, ref: "ZZZZZZZZ" });
    expect(res.status).toBe(200);
    expect(state.lookedUp).toEqual(["ZZZZZZZZ"]);
    expect(state.inserts[0].row.referred_by).toBeNull();
  });

  it("draws a new link code when the first one is taken", async () => {
    state.trackerInsertFails = 2;
    const res = await post(good);
    expect(res.status).toBe(200);
    expect(state.inserts).toHaveLength(1);
    expect(state.deletedUsers).toEqual([]);
  });

  it("takes the login back out if the free account cannot be made", async () => {
    state.trackerInsertFails = 99;
    const res = await post(good);
    expect(res.status).toBe(500);
    expect(state.deletedUsers).toEqual(["user-1"]);
    expect(state.consents).toHaveLength(0);
  });

  it("says so when the email already has an account", async () => {
    state.createError = "A user with this email address has already been registered";
    const res = await post(good);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("already exists");
    expect(state.inserts).toHaveLength(0);
  });

  it("still succeeds when the sign-in does not take: the form sends them to sign in", async () => {
    state.signInError = true;
    const res = await post(good);
    expect(await res.json()).toEqual({ ok: true, signedIn: false, next: "/log" });
  });
});
