import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WEEK_ANNOUNCE_FROM_HOUR,
  WEEK_ANNOUNCE_UNTIL_HOUR,
  claimOutcome,
  claimWeekAnnouncement,
  maySend,
  mustRefuseRebuild,
  weekAnnounceOpen,
} from "@/lib/elite/announce";

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

// Coach Yinka, Nov 24 2026: "lets not send notis at 6 am", "dont text
// parents either", "4 pm is fine". A week opens early Monday; it is
// announced from 4:00 PM New York, and nobody is texted about it.
describe("when a new week is announced", () => {
  const root = path.resolve(__dirname, "..");
  const read = (f: string) => readFileSync(path.join(root, f), "utf8");
  const code = (f: string) =>
    read(f)
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");

  it("from 4:00 PM to 9:00 PM New York, and at no other hour", () => {
    expect(WEEK_ANNOUNCE_FROM_HOUR).toBe(16);
    expect(WEEK_ANNOUNCE_UNTIL_HOUR).toBe(21);
    for (let h = 0; h < 24; h++) expect(weekAnnounceOpen(h), String(h)).toBe(h >= 16 && h < 21);
    // the old early-morning hours, summer and winter
    expect(weekAnnounceOpen(5)).toBe(false);
    expect(weekAnnounceOpen(6)).toBe(false);
  });

  it("the week opens whatever the hour; the announcement waits for the window", () => {
    const unlock = code("lib/elite/unlock.ts");
    const opens = unlock.indexOf("update({ current_week: week, today_focus: plan.focus })");
    const waits = unlock.indexOf("if (!open) continue;");
    const takes = unlock.indexOf("update({ notified: true })");
    const claims = unlock.indexOf("claimWeekAnnouncement(");
    const sends = unlock.indexOf("notifyPlayer(playerId, notice)");
    expect(opens).toBeGreaterThan(-1);
    expect(waits).toBeGreaterThan(opens);
    expect(takes).toBeGreaterThan(waits);
    expect(claims).toBeGreaterThan(takes);
    expect(sends).toBeGreaterThan(claims);
    expect(unlock).toContain("const open = weekAnnounceOpen(nyHour());");
  });

  it("a week that goes live at once waits the same way: the publish step announces nothing itself", () => {
    const publish = code("lib/elite/coach-actions.ts");
    expect(publish).toContain("notified: false,");
    expect(publish).not.toMatch(/notified: goesLiveNow/);
    expect(publish).not.toContain("claimWeekAnnouncement(");
    expect(publish).not.toMatch(/event:\s*"new_week"/);
    expect(publish).toContain("unlockDueWeeks({ force: true })");
  });

  it("nobody is texted that a new week is live", () => {
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
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      // a text is sendPlayerSMS / sendPlayerOwnSMS with the new_week event
      expect(src, path.relative(root, f)).not.toMatch(/send\w*SMS\([^)]*?event:\s*"new_week"/s);
      expect(src, path.relative(root, f)).not.toMatch(/just went live\. This week:|training week is officially live/);
    }
  });

  it("a week that is open and waiting for 4:00 PM is as protected from a rebuild as an announced one", () => {
    const publish = code("lib/elite/coach-actions.ts");
    expect(publish).toMatch(/weekWasAnnounced\(supabase, playerId, week\)\) \|\| \(await weekIsLiveUnannounced\(supabase, playerId, week\)\)/);
  });

  it("an announcement that cannot be recorded sends nothing and is tried again", () => {
    const unlock = code("lib/elite/unlock.ts");
    const failed = unlock.slice(unlock.indexOf('if (claim === "failed") {'), unlock.indexOf("const first = player"));
    expect(failed).toContain("update({ notified: false })");
    expect(failed).toContain("run.unrecorded.push(");
    expect(failed).toContain("continue;");
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

  it("finds the one sender (the announcer)", () => {
    expect(senders.map((f) => path.relative(root, f)).sort()).toEqual(["lib/elite/unlock.ts"]);
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
