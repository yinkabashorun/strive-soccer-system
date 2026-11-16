import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claimOutcome, claimWeekAnnouncement, maySend, mustRefuseRebuild } from "@/lib/elite/announce";

// Nov 12 2026: one profile's "week 8 just went live" text went out every
// hour for four days (and another's 117 times the week before). These
// are the rules that make a second announcement of the same week
// impossible, whatever asks for it.

// A stand-in for the table's primary key (player_id, week).
function ledger(opts: { down?: boolean } = {}) {
  const rows = new Set<string>();
  const client = {
    from: () => ({
      insert: async (row: { player_id: string; week: number }) => {
        if (opts.down) return { error: { code: "PGRST000", message: "unreachable" } };
        const key = `${row.player_id}:${row.week}`;
        if (rows.has(key)) return { error: { code: "23505", message: "duplicate key" } };
        rows.add(key);
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  return { client, rows };
}

describe("a week is announced once", () => {
  it("the first claim sends, every later claim for that week does not", async () => {
    const { client } = ledger();
    const sent: string[] = [];
    // the same week published 94 times, as the hourly builder did
    for (let hour = 0; hour < 94; hour++) {
      if (maySend(await claimWeekAnnouncement(client, "yinka", 8))) sent.push("week 8");
    }
    expect(sent).toEqual(["week 8"]);
  });

  it("another week, or another player, is its own announcement", async () => {
    const { client } = ledger();
    expect(await claimWeekAnnouncement(client, "yinka", 8)).toBe("claimed");
    expect(await claimWeekAnnouncement(client, "yinka", 9)).toBe("claimed");
    expect(await claimWeekAnnouncement(client, "abdul", 8)).toBe("claimed");
    expect(await claimWeekAnnouncement(client, "abdul", 8)).toBe("already");
  });

  it("two runs racing for the same week: exactly one sends", async () => {
    const { client } = ledger();
    const claims = await Promise.all([
      claimWeekAnnouncement(client, "bryan", 4),
      claimWeekAnnouncement(client, "bryan", 4),
      claimWeekAnnouncement(client, "bryan", 4),
    ]);
    expect(claims.filter(maySend)).toHaveLength(1);
  });

  it("a ledger that cannot be written sends nothing", async () => {
    const { client } = ledger({ down: true });
    const claim = await claimWeekAnnouncement(client, "tim", 1);
    expect(claim).toBe("failed");
    expect(maySend(claim)).toBe(false);
  });

  it("reads the database's answer: unique violation = already announced", () => {
    expect(claimOutcome(null)).toBe("claimed");
    expect(claimOutcome({ code: "23505" })).toBe("already");
    expect(claimOutcome({ code: "42P01" })).toBe("failed");
    expect(claimOutcome({})).toBe("failed");
  });
});

describe("a live week is never rebuilt", () => {
  it("refuses a week the family was told about that still has its drills", () => {
    expect(mustRefuseRebuild({ announced: true, drillsInWeek: 20 })).toBe(true);
  });
  it("builds a week nobody was told about", () => {
    expect(mustRefuseRebuild({ announced: false, drillsInWeek: 0 })).toBe(false);
    expect(mustRefuseRebuild({ announced: false, drillsInWeek: 20 })).toBe(false);
  });
  it("lets a week whose drills are genuinely gone be built again (silently)", () => {
    expect(mustRefuseRebuild({ announced: true, drillsInWeek: 0 })).toBe(false);
  });
});

// No third path. Any file that sends the new-week announcement has to
// take the claim first; a new sender added later without it fails here.
describe("every new-week sender takes the claim", () => {
  const root = path.resolve(__dirname, "..");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name)) files.push(p);
    }
  };
  walk(path.join(root, "lib"));
  walk(path.join(root, "app"));
  const senders = files.filter((f) => /event:\s*"new_week"/.test(readFileSync(f, "utf8")));

  it("finds the two senders (publish now, Monday unlock)", () => {
    expect(senders.map((f) => path.relative(root, f)).sort()).toEqual([
      "lib/elite/coach-actions.ts",
      "lib/elite/unlock.ts",
    ]);
  });
  it("each one claims before it sends", () => {
    for (const f of senders) {
      const src = readFileSync(f, "utf8");
      const claimAt = src.indexOf("claimWeekAnnouncement(");
      const firstSend = src.search(/event:\s*"new_week"/);
      expect(claimAt, path.relative(root, f)).toBeGreaterThan(-1);
      expect(claimAt, path.relative(root, f)).toBeLessThan(firstSend);
    }
  });
});
