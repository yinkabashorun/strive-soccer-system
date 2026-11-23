import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FIRST_WEEK_CLAIM_STALE_MS,
  claimFirstWeek,
  claimTakeable,
  insertOutcome,
  releaseFirstWeek,
} from "@/lib/elite/first-week-claim";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

// A player's first week is built by one caller at a time (079). Two
// interleaved builds (the building screen reloaded, the hourly builder in
// the same minute) would leave week 1 with every drill twice.

const NOW = Date.parse("2026-11-22T20:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("the claim rule", () => {
  it("a fresh, unfinished claim is held; a finished or stale one may be taken over", () => {
    expect(claimTakeable({ started_at: ago(30_000), finished_at: null }, NOW)).toBe(false);
    expect(claimTakeable({ started_at: ago(FIRST_WEEK_CLAIM_STALE_MS - 1000), finished_at: null }, NOW)).toBe(false);
    expect(claimTakeable({ started_at: ago(FIRST_WEEK_CLAIM_STALE_MS + 1000), finished_at: null }, NOW)).toBe(true);
    expect(claimTakeable({ started_at: ago(10_000), finished_at: ago(5_000) }, NOW)).toBe(true);
    expect(claimTakeable(null, NOW)).toBe(true);
    expect(claimTakeable({ started_at: "garbage", finished_at: null }, NOW)).toBe(true);
  });

  it("the stale limit outlasts the builder's own run limit", () => {
    expect(FIRST_WEEK_CLAIM_STALE_MS).toBeGreaterThanOrEqual(300_000);
  });

  it("an insert conflict is someone else's claim; any other error is an unreachable table", () => {
    expect(insertOutcome(null)).toBe("claimed");
    expect(insertOutcome({ code: "23505" })).toBe("conflict");
    expect(insertOutcome({ code: "42P01" })).toBe("unavailable");
  });
});

// A tiny stand-in for the one table, enough to run the claim against it:
// a primary key on player_id, and updates that only match the filters.
function fakeTable(initial?: { started_at: string; finished_at: string | null }, broken = false) {
  let row: { player_id: string; started_at: string; finished_at: string | null } | null = initial
    ? { player_id: "p1", ...initial }
    : null;
  const client = {
    from() {
      return {
        insert(v: { player_id: string; started_at: string }) {
          if (broken) return Promise.resolve({ error: { code: "42P01" } });
          if (row) return Promise.resolve({ error: { code: "23505" } });
          row = { ...v, finished_at: null };
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq() {
              return { maybeSingle: () => Promise.resolve({ data: row, error: null }) };
            },
          };
        },
        update(patch: Partial<NonNullable<typeof row>>) {
          const filters: [string, unknown][] = [];
          const b = {
            eq(col: string, val: unknown) {
              filters.push([col, val]);
              return b;
            },
            is(col: string, val: unknown) {
              filters.push([col, val]);
              return b;
            },
            select() {
              const hit = row && filters.every(([c, v]) => (row as Record<string, unknown>)[c] === v);
              if (hit) row = { ...row!, ...patch };
              return Promise.resolve({ data: hit ? [{ player_id: "p1" }] : [], error: null });
            },
            then(res: (v: { error: null }) => void) {
              const hit = row && filters.every(([c, v]) => (row as Record<string, unknown>)[c] === v);
              if (hit) row = { ...row!, ...patch };
              res({ error: null });
            },
          };
          return b;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, row: () => row };
}

describe("taking the claim", () => {
  it("the first caller claims; a second at the same time is held", async () => {
    const t = fakeTable();
    expect(await claimFirstWeek(t.client, "p1", NOW)).toBe("claimed");
    expect(await claimFirstWeek(t.client, "p1", NOW + 1000)).toBe("held");
  });

  it("after release, a later caller takes it over", async () => {
    const t = fakeTable();
    expect(await claimFirstWeek(t.client, "p1", NOW)).toBe("claimed");
    await releaseFirstWeek(t.client, "p1");
    expect(t.row()?.finished_at).not.toBeNull();
    expect(await claimFirstWeek(t.client, "p1", NOW + 60_000)).toBe("claimed");
    expect(t.row()?.finished_at).toBeNull();
  });

  it("a claim left by a crashed build is taken over once it is stale", async () => {
    const t = fakeTable({ started_at: ago(FIRST_WEEK_CLAIM_STALE_MS + 60_000), finished_at: null });
    expect(await claimFirstWeek(t.client, "p1", NOW)).toBe("claimed");
    expect(t.row()?.started_at).toBe(new Date(NOW).toISOString());
  });

  it("an unreachable table never blocks the builder", async () => {
    const t = fakeTable(undefined, true);
    expect(await claimFirstWeek(t.client, "p1", NOW)).toBe("unavailable");
  });
});

describe("both paths take the claim", () => {
  it("the hourly builder claims before building a first week, and releases after", () => {
    const plan = read("lib/elite/auto-plan.ts");
    expect(plan).toContain("if (maxBuilt === 0) {");
    expect(plan).toContain("const claim = await claimFirstWeek(admin, player.id);");
    expect(plan).toMatch(/if \(claim === "held"\) \{[\s\S]{0,200}skipped: FIRST_WEEK_HELD[\s\S]{0,40}continue;/);
    expect(plan).toMatch(/finally \{[\s\S]{0,140}if \(claimedFirst\) await releaseFirstWeek\(admin, player\.id\);/);
    // The claim sits before the plan is generated and published.
    expect(plan.indexOf("claimFirstWeek(admin, player.id)")).toBeLessThan(plan.indexOf("applyGeneratedPlanCore(player.id"));
  });

  it("the building screen builds through that same body, and waits honestly when held", () => {
    const plan = read("lib/elite/auto-plan.ts");
    expect(plan).toContain("runAutoWeeklyPlans(undefined, playerId)");
    const action = read("lib/elite/first-week-actions.ts");
    expect(action).toContain("buildFirstWeekFor(viewer.playerId)");
    expect(action).toContain("r.skipped === FIRST_WEEK_HELD");
    expect(action).toMatch(/while \(held && !state\.built/);
  });

  it("the migration is idempotent, has no DROP, and only lets coaches read", () => {
    const sql = read("supabase/migrations/079_first_week_claim.sql").replace(/--.*$/gm, "");
    expect(sql).toContain("create table if not exists public.elite_first_week_builds");
    expect(sql).toMatch(/player_id\s+uuid primary key references public\.elite_players\(id\) on delete cascade/);
    expect(sql).toContain("enable row level security");
    expect(sql).not.toMatch(/\bdrop\b/i);
    expect(sql).toMatch(/for select using \(public\.elite_is_coach\(\)\)/);
    expect(sql).not.toMatch(/for (all|insert|update|delete)/i);
  });
});
