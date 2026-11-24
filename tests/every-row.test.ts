import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { everyRow, ROW_PAGE } from "@/lib/elite/supabase/every-row";

// The database hands back at most 1,000 rows for one request and says
// nothing about the rest. In November 2026 elite_homework reached 1,432
// rows: the hourly audit read 1,000 of them and reported "no plan for live
// week 10" for players whose week was built, and the coach dashboard, the
// 6pm digest and the daily reminder were worked out from the same partial
// read. Held here: the paging, and that no read across players on a table
// that grows every week is made without it.

// A table that behaves like the real one: never more than `cap` rows back.
function table(total: number, cap = 1000) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const asked: [number, number][] = [];
  const page = async (from: number, to: number) => {
    asked.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null };
  };
  return { page, asked };
}

describe("everyRow", () => {
  it("reads past the first thousand", async () => {
    const t = table(1432);
    const rows = await everyRow<{ id: number }>(t.page);
    expect(rows).toHaveLength(1432);
    expect(new Set(rows.map((r) => r.id)).size).toBe(1432);
    expect(t.asked).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("the unpaged read it replaces loses the newest rows", async () => {
    const t = table(1432);
    const once = (await t.page(0, 99999)).data;
    expect(once).toHaveLength(1000); // what the audit saw
  });

  it("asks once more when the last page was exactly full", async () => {
    const t = table(2000);
    expect(await everyRow(t.page)).toHaveLength(2000);
    expect(t.asked).toHaveLength(3);
  });

  it("handles none, one, and a page size of its own", async () => {
    expect(await everyRow(table(0).page)).toEqual([]);
    expect(await everyRow(table(1).page)).toHaveLength(1);
    const t = table(25);
    expect(await everyRow(t.page, 10)).toHaveLength(25);
    expect(t.asked).toEqual([
      [0, 9],
      [10, 19],
      [20, 29],
    ]);
    expect(ROW_PAGE).toBe(1000);
  });

  it("a failed page ends the read with what came before it", async () => {
    let n = 0;
    const rows = await everyRow<number>(async () => {
      n++;
      if (n === 2) return { data: null, error: { message: "timeout" } };
      return { data: Array.from({ length: 1000 }, (_, i) => i), error: null };
    });
    expect(rows).toHaveLength(1000);
    expect(n).toBe(2);
  });
});

// Tables that gain rows for every player every week. A read on one of them
// is fine when it is for one player, one row, one Film Room, a count, or
// carries its own limit; anything wider goes through everyRow, in an order
// that never ties.
const GROWING = [
  "elite_homework",
  "elite_messages",
  "elite_notifications",
  "elite_checkins",
  "elite_weekly_plans",
  "elite_progress",
  "elite_progress_history",
  "elite_sessions",
  "elite_parent_reports",
  "elite_progress_videos",
  "elite_film_room_clips",
  "elite_week_announcements",
  "elite_consents",
];
const NARROW = /\.eq\("(player_id|id|session_id|profile_id|film_room_id)"|\.in\("film_room_id"|head: true|\.single\(|\.maybeSingle\(|\.limit\(/;

const root = path.resolve(__dirname, "..");
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) return n === "node_modules" ? [] : sources(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("reads across players", () => {
  const files = [...sources(path.join(root, "lib")), ...sources(path.join(root, "app"))];
  type Read = { where: string; table: string; chain: string };
  const reads: Read[] = [];
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(/from\("(elite_[a-z_]+)"\)/g)) {
      if (!GROWING.includes(m[1])) continue;
      let chain = s.slice(m.index, m.index! + 700);
      const ends = [chain.indexOf(";"), chain.indexOf('.from("', 10)].filter((x) => x > 0);
      if (ends.length) chain = chain.slice(0, Math.min(...ends));
      if (!chain.includes(".select(")) continue; // a write
      reads.push({ where: `${path.relative(root, f)}:${s.slice(0, m.index).split("\n").length}`, table: m[1], chain });
    }
  }

  it("finds the reads it is meant to judge", () => {
    expect(reads.length).toBeGreaterThan(40);
    expect(reads.some((r) => r.table === "elite_homework" && r.chain.includes(".range(from, to)"))).toBe(true);
  });

  it("are never one unpaged request on a table that grows every week", () => {
    const wide = reads.filter((r) => !NARROW.test(r.chain) && !r.chain.includes(".range("));
    expect(wide.map((r) => `${r.where} ${r.table}`)).toEqual([]);
  });

  it("page in an order that never ties", () => {
    for (const r of reads.filter((x) => x.chain.includes(".range("))) {
      expect(r.chain, r.where).toMatch(/\.order\("(id|created_at)"/);
    }
  });

  it("the audit, the dashboard, the digest and the reminder all read every row", () => {
    for (const f of ["lib/elite/health.ts", "lib/elite/data.ts", "lib/elite/reminders-server.ts", "app/api/elite/cron/digest/route.ts"]) {
      expect(readFileSync(path.join(root, f), "utf8"), f).toContain("everyRow");
    }
  });
});
