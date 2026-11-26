// The Monday moment (lib/elite/week-recap.ts): last week in a few lines at
// the top of the free app's Week tab, once a week, never a notification.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ordinal, recapDue, recapIsBest, recapPlace, weekRecap, type WeekRecapInput } from "@/lib/elite/week-recap";

const root = path.resolve(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

const base: WeekRecapInput = { week: "2026-11-23", lastWeek: 190, earlier: [], gymLastWeek: 0, friends: [] };

describe("the Monday moment", () => {
  it("a week with nothing that counts gets no card", () => {
    expect(weekRecap({ ...base, lastWeek: 0 })).toBeNull();
    // gym alone is not a training week
    expect(weekRecap({ ...base, lastWeek: 0, gymLastWeek: 90 })).toBeNull();
  });

  it("says the player's own number", () => {
    expect(weekRecap(base)?.trained).toBe("Last week you trained 3h 10m.");
    expect(weekRecap({ ...base, lastWeek: 45 })?.trained).toBe("Last week you trained 45m.");
  });

  it("gym is its own line, only when there was any, and never in the number or the best", () => {
    expect(weekRecap(base)?.gym).toBeNull();
    const r = weekRecap({ ...base, gymLastWeek: 90, earlier: [200, 200, 200] });
    expect(r?.gym).toBe("Gym: 1h 30m.");
    expect(r?.trained).toBe("Last week you trained 3h 10m.");
    expect(r?.best).toBeNull();
  });

  it("the place: ties share it, the lower half is left out", () => {
    expect(recapPlace(100, [200, 50])).toEqual({ place: 2, of: 3 });
    expect(recapPlace(100, [100, 100, 50])).toEqual({ place: 1, of: 4 });
    expect(recapPlace(100, [200, 100, 50])).toEqual({ place: 2, of: 4 });
    expect(recapPlace(100, [200, 150, 50])).toBeNull(); // 3rd of 4: lower half
    expect(recapPlace(10, [200, 150])).toBeNull(); // 3rd of 3
    expect(weekRecap({ ...base, friends: [210, 75, 60, 40, 30, 20] })?.place).toBe("2nd of 7 friends who trained.");
    expect(weekRecap({ ...base, friends: [500, 400, 300, 250, 220, 10] })?.place).toBeNull();
  });

  it("needs two friends who trained for a place", () => {
    expect(recapPlace(100, [])).toBeNull();
    expect(recapPlace(100, [50])).toBeNull();
    expect(recapPlace(100, [50, 0, 0])).toBeNull(); // friends who did not train do not count
    expect(recapPlace(100, [50, 20])).toEqual({ place: 1, of: 3 });
  });

  it("the best week needs three earlier weeks of training, and must beat all of them", () => {
    expect(recapIsBest(190, [100, 120])).toBe(false);
    expect(recapIsBest(190, [100, 120, 0, 0])).toBe(false);
    expect(recapIsBest(190, [100, 120, 150])).toBe(true);
    expect(recapIsBest(150, [100, 120, 150])).toBe(false); // equal is not a best
    expect(recapIsBest(190, [100, 120, 300])).toBe(false);
    expect(weekRecap({ ...base, earlier: [100, 120, 150] })?.best).toBe("Your best week yet.");
  });

  it("ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st"]);
  });

  it("the words never shame and never use a dash clause", () => {
    const lines: string[] = [];
    for (const lastWeek of [5, 45, 190, 600]) {
      for (const friends of [[], [10, 20], [600, 5, 4]]) {
        const r = weekRecap({ ...base, lastWeek, friends, earlier: [1, 2, 3], gymLastWeek: 30 });
        if (r) lines.push(...[r.trained, r.gym, r.place, r.best, r.dismiss].filter((l): l is string => Boolean(l)));
      }
    }
    expect(lines.length).toBeGreaterThan(10);
    for (const l of lines) {
      expect(l).not.toMatch(/[—–]| - /);
      expect(l.toLowerCase()).not.toMatch(/missed|only|behind|last place|streak/);
    }
  });

  it("shows once a week: put away for a week, back for the next", () => {
    const r = weekRecap(base)!;
    expect(recapDue(r, "")).toBe(true);
    expect(recapDue(r, "2026-11-23")).toBe(false);
    expect(recapDue({ ...r, week: "2026-11-30" }, "2026-11-23")).toBe(true);
    expect(recapDue(null, "")).toBe(false);
  });

  it("typed time never counts: the server adds only timed training", () => {
    const src = read("lib/elite/tracker-server.ts");
    const fn = src.slice(src.indexOf("export async function weekRecapFor"), src.indexOf("// The owner of a link's code"));
    // auraLogsOf leaves typed time out; friendsWeekFor is the board's reader
    expect(fn).toContain("auraLogsOf(");
    expect(fn).toContain("friendsWeekFor(");
    expect(fn).toContain('l.kind !== "training"');
    const aura = src.slice(src.indexOf("export async function auraLogsOf"));
    expect(aura.slice(0, 600)).toContain('.neq("proof", TYPED)');
  });

  it("no notification is sent, and the app shows it once a week", () => {
    for (const f of ["lib/elite/week-recap.ts", "mobile/src/MondayCard.tsx", "components/elite/MondayCard.tsx"]) {
      const src = read(f);
      expect(src, f).not.toMatch(/sendPush|notify\(|sendSms|elite_notifications/);
    }
    const server = read("lib/elite/tracker-server.ts");
    const fn = server.slice(server.indexOf("export async function weekRecapFor"), server.indexOf("// The owner of a link's code"));
    expect(fn).not.toMatch(/sendPush|notify|insert\(|upsert\(/);
    const card = read("mobile/src/MondayCard.tsx");
    expect(card).toContain("recapDue(recap, prefs.recapSeen)");
    expect(card).toContain('setPref("recapSeen", recap.week)');
    expect(read("mobile/app/(free)/my-week.tsx")).toContain("<MondayCard");
    expect(read("components/elite/MyWeek.tsx")).toContain("<MondayCard");
    // the earned mark is gold, the button is not
    expect(card).not.toMatch(/<Button[^>]*gold/);
  });
});
