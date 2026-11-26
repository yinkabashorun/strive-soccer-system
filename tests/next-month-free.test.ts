import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  PAID_NOTE_DAYS,
  SQUAD_BODY,
  SQUAD_KEPT_UNTIL_END,
  SQUAD_NO_PRIZE_BODY,
  SQUAD_NO_PRIZE_TITLE,
  SQUAD_PAID_NOTE,
  SQUAD_PAID_READY_BODY,
  SQUAD_PAID_READY_TITLE,
  SQUAD_PAID_START,
  SQUAD_PAID_TITLE,
  SQUAD_READY_TITLE,
  SQUAD_START,
  SQUAD_TITLE,
  buildSquad,
  paidNote,
  squadPrize,
} from "@/lib/elite/squad-pass";
import { NEXT_MONTH_FREE_NOTE, PRO_CURRENCY, PRO_MONTHLY_CENTS } from "@/lib/elite/pro";
import { LIFETIME_LABEL, hasLifetime, paymentMayMove } from "@/lib/elite/lifetime";

const src = (p: string) => readFileSync(p, "utf8");
const code = (p: string) => src(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));

// Coach Yinka, Nov 26 2026: "a paying member should get their next month
// free." And, the same day, on the coaching families: "For now, give them
// lifetime access."
describe("what three teammates earn, by who the player is", () => {
  it("one rule: a month, the next month free, or nothing to give", () => {
    expect(squadPrize({ memberOn: false, earnedMonthRunning: false, paysByCard: false })).toBe("month");
    // on an earned month: three more carry it on
    expect(squadPrize({ memberOn: true, earnedMonthRunning: true, paysByCard: false })).toBe("month");
    expect(squadPrize({ memberOn: true, earnedMonthRunning: false, paysByCard: true })).toBe("next_month_free");
    // lifetime access, or a membership the coaches switched on: nothing to pay
    expect(squadPrize({ memberOn: true, earnedMonthRunning: false, paysByCard: false })).toBe("none");
  });

  it("the card never promises a player something they cannot use", () => {
    const earned = { trained: people(3), joined: [], passes: [{ started: false, running: false }], runningUntil: null };
    const free = buildSquad(earned);
    expect([free.title, free.start]).toEqual([SQUAD_READY_TITLE, SQUAD_START]);

    const paying = buildSquad({ ...earned, prize: "next_month_free" });
    expect([paying.title, paying.body, paying.start, paying.ready]).toEqual([SQUAD_PAID_READY_TITLE, SQUAD_PAID_READY_BODY, SQUAD_PAID_START, 1]);
    const payingBefore = buildSquad({ trained: [], joined: [], passes: [], runningUntil: null, prize: "next_month_free" });
    expect([payingBefore.title, payingBefore.body]).toEqual([SQUAD_PAID_TITLE, SQUAD_BODY]);
    expect(SQUAD_PAID_TITLE).toBe("Bring 3 teammates. Your next month is free.");

    // nothing to give: no button, no promise, the teammates are still shown
    const lifetime = buildSquad({ ...earned, prize: "none" });
    expect([lifetime.title, lifetime.body, lifetime.ready]).toEqual([SQUAD_NO_PRIZE_TITLE, SQUAD_NO_PRIZE_BODY, 0]);
    expect(lifetime.slots).toHaveLength(3);
    expect(SQUAD_TITLE).not.toBe(SQUAD_NO_PRIZE_TITLE);
    for (const line of [SQUAD_NO_PRIZE_TITLE, SQUAD_NO_PRIZE_BODY]) expect(line).not.toMatch(/month|free|Pro/i);
  });

  it("'your next month is free' stays on the card for one billing month, for a player who pays", () => {
    const now = new Date("2026-12-10T12:00:00Z");
    expect(paidNote(["2026-12-01T12:00:00Z"], now)).toBe(SQUAD_PAID_NOTE);
    expect(paidNote([null, undefined], now)).toBeNull();
    expect(paidNote(["2026-10-01T12:00:00Z"], now)).toBeNull();
    expect(PAID_NOTE_DAYS).toBe(31);
    const base = { trained: [], joined: [], passes: [], runningUntil: null, note: SQUAD_PAID_NOTE };
    expect(buildSquad({ ...base, prize: "next_month_free" }).note).toBe(SQUAD_PAID_NOTE);
    expect(buildSquad(base).note).toBeNull();
  });

  it("both cards use the server's button and show the line", () => {
    expect(src("mobile/src/SquadCard.tsx")).toContain("label={squad.start ?? SQUAD_START}");
    expect(src("mobile/src/SquadCard.tsx")).toContain("{squad.note}");
    expect(src("components/elite/SquadCard.tsx")).toContain("{squad.start ?? SQUAD_START}");
    expect(src("components/elite/SquadCard.tsx")).toContain("{squad.note}");
  });
});

describe("the next month free is a credit, made once", () => {
  const server = code("lib/elite/squad-pass-server.ts");
  const stripe = code("lib/elite/pro-server.ts");

  it("is the month's own price, off the next charge, with the month's id as the key", () => {
    expect(PRO_MONTHLY_CENTS).toBe(2900);
    expect(stripe).toContain("{ amount: -PRO_MONTHLY_CENTS, currency: PRO_CURRENCY, description: NEXT_MONTH_FREE_NOTE }");
    expect(stripe).toContain("{ idempotencyKey: `strive-earned-month-${key}` }");
    expect(PRO_CURRENCY).toBe("usd");
    expect(NEXT_MONTH_FREE_NOTE).not.toMatch(/[—–]/);
  });

  it("never credits a membership that is not running or is set to stop: the month is kept", () => {
    expect(stripe).toContain('if (ids.length === 0) return { result: "none" };');
    expect(stripe).toContain('if (sub.cancel_at_period_end || sub.cancel_at) return { result: "ending" };');
    expect(server).toContain('if (credit.result === "ending") return { ok: false, error: SQUAD_KEPT_UNTIL_END, status: 409 };');
    expect(SQUAD_KEPT_UNTIL_END).toContain("kept");
  });

  it("claims the month BEFORE asking Stripe, and gives it back if Stripe says no", () => {
    const fn = server.slice(server.indexOf("async function creditPass"), server.indexOf("export async function hadEarnedMonth"));
    const claim = fn.indexOf('.update({ started_at: now, ends_at: now, ended_at: now, credited_at: now })');
    const ask = fn.indexOf("await creditNextMonth(profileId, pass.id)");
    expect(claim).toBeGreaterThan(-1);
    expect(ask).toBeGreaterThan(claim);
    // only a month nobody has used can be claimed: two taps use one
    expect(fn).toContain('.is("started_at", null)');
    expect(fn).toContain("if (!claimed?.length) return { ok: true };");
    expect(fn).toContain(".update({ started_at: null, ends_at: null, ended_at: null, credited_at: null })");
    expect(fn.indexOf("await giveBack();")).toBeGreaterThan(ask);
    // before 091 the claim is refused and nothing reaches Stripe
    expect(fn.indexOf('if (error) return { ok: false, error: SQUAD_ALREADY_MEMBER, status: 409 };')).toBeLessThan(ask);
  });

  it("a month used this way is closed, so the hourly job never touches it, and the database holds that", () => {
    const sql = src("supabase/migrations/091_earned_month_as_a_free_month.sql");
    expect(sql).toContain("add column if not exists credited_at timestamptz");
    expect(sql).toContain("add column if not exists stripe_credit_id text");
    expect(sql).toContain("check (credited_at is null or (started_at is not null and ended_at is not null))");
    expect(sql).not.toMatch(/^\s*drop\s/im);
  });

  it("the card still reads its months before 091 is applied", () => {
    expect(server).toMatch(/if \(!full\.error\) return[\s\S]*?select\(PASS_COLUMNS\)/);
  });
});

describe("lifetime access", () => {
  it("a payment can switch a lifetime member on, and never off", () => {
    const life = { lifetime_access: true };
    expect(hasLifetime(life)).toBe(true);
    expect(hasLifetime({ lifetime_access: false })).toBe(false);
    expect(hasLifetime(null)).toBe(false);
    for (const off of ["canceled", "past_due", "none", "paused", "unpaid"]) expect(paymentMayMove(life, off), off).toBe(false);
    expect(paymentMayMove(life, "active")).toBe(true);
    // everyone else follows their payments as before
    for (const any of ["canceled", "active", "past_due"]) expect(paymentMayMove({ lifetime_access: false }, any)).toBe(true);
    expect(LIFETIME_LABEL).toBe("Lifetime access");
  });

  it("the Stripe sync asks before it moves anyone", () => {
    const stripe = code("lib/elite/pro-server.ts");
    const fn = stripe.slice(stripe.indexOf("export async function syncProAccess"), stripe.indexOf("export async function memberTier"));
    expect(fn.indexOf("if (!paymentMayMove(")).toBeGreaterThan(-1);
    expect(fn.indexOf("if (!paymentMayMove(")).toBeLessThan(fn.indexOf('.update({ subscription_status: access })'));
    // and still works before 092 is applied
    expect(fn).toContain("withLifetime.error");
  });

  it("only a coach gives it: the database refuses a player's own change", () => {
    const sql = src("supabase/migrations/092_lifetime_access.sql");
    expect(sql).toContain("add column if not exists lifetime_access boolean not null default false");
    expect(sql).toContain("or NEW.lifetime_access is distinct from OLD.lifetime_access)");
    // the guard keeps every column it already held
    for (const col of ["subscription_status", "tier", "coach_id", "profile_id", "offer_opt_in", "opt_in_drill_ids"]) {
      expect(sql).toContain(`NEW.${col} is distinct from OLD.${col}`);
    }
    expect(sql).not.toMatch(/^\s*drop\s/im);
    expect(src("components/elite/TierControl.tsx")).toContain("updatePlayerFields(playerId, { lifetime_access: next })");
  });
});
