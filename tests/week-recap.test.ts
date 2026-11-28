// The Monday moment (lib/elite/week-recap.ts): last week in a few lines at
// the top of the free app's Week tab, once a week, never a notification.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ordinal,
  recapDue,
  recapIsBest,
  recapPlace,
  weekCard,
  weekCardDue,
  weekCardFriendsLine,
  weekCardLines,
  weekCardMoment,
  weekRecap,
  type WeekCardInput,
  type WeekRecapInput,
} from "@/lib/elite/week-recap";

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
      expect(l).not.toMatch(/[\u2014\u2013]| - /);
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

// ---- The week's card (the voice guide, moment 8) ---------------------------

const ny = (iso: string) => new Date(iso);
describe("the week's card: when it shows", () => {
  it("Sunday from noon New York, all of Monday, never otherwise", () => {
    // Sun Nov 29 2026, EST (UTC-5)
    expect(weekCardMoment(ny("2026-11-29T16:59:00Z"))).toBeNull(); // 11:59 AM
    expect(weekCardMoment(ny("2026-11-29T17:00:00Z"))).toBe("sunday"); // 12:00 PM
    expect(weekCardMoment(ny("2026-11-30T04:59:00Z"))).toBe("sunday"); // 11:59 PM Sunday
    expect(weekCardMoment(ny("2026-11-30T05:00:00Z"))).toBe("monday"); // 12:00 AM Monday
    expect(weekCardMoment(ny("2026-12-01T04:59:00Z"))).toBe("monday"); // 11:59 PM Monday
    expect(weekCardMoment(ny("2026-12-01T05:00:00Z"))).toBeNull(); // Tuesday
    for (const d of ["2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05"]) expect(weekCardMoment(ny(`${d}T17:00:00Z`)), d).toBeNull();
    expect(weekCardMoment(ny("2026-11-28T23:00:00Z"))).toBeNull(); // Saturday evening
  });
  it("holds across a clock change: noon New York, whatever the offset", () => {
    // Sun Nov 1 2026, clocks fall back at 2 AM: noon is 17:00Z (EST)
    expect(weekCardMoment(ny("2026-11-01T16:59:00Z"))).toBeNull();
    expect(weekCardMoment(ny("2026-11-01T17:00:00Z"))).toBe("sunday");
    // Sun Mar 8 2026, clocks spring forward: noon is 16:00Z (EDT)
    expect(weekCardMoment(ny("2026-03-08T15:59:00Z"))).toBeNull();
    expect(weekCardMoment(ny("2026-03-08T16:00:00Z"))).toBe("sunday");
  });
  it("one Got it covers Sunday's card and Monday's: both are keyed to the week they are about", () => {
    const input: WeekCardInput = { moment: "sunday", week: "2026-11-23", mine: 120, earlier: [], gym: 0, friends: [] };
    const sun = weekCard(input)!;
    const mon = weekCard({ ...input, moment: "monday" })!;
    expect([sun.week, mon.week]).toEqual(["2026-11-23", "2026-11-23"]);
    expect(weekCardDue(sun, null)).toBe(true);
    expect(weekCardDue(sun, "2026-11-23")).toBe(false);
    expect(weekCardDue(mon, "2026-11-23")).toBe(false); // dismissed Sunday, stays dismissed Monday
    expect(weekCardDue(weekCard({ ...input, week: "2026-11-30" }), "2026-11-23")).toBe(true); // next week's is new
    expect(weekCardDue(null, null)).toBe(false);
  });
});

describe("the week's card: the words", () => {
  const sun: WeekCardInput = { moment: "sunday", week: "2026-11-23", mine: 190, earlier: [], gym: 0, friends: [] };
  it("nothing that counts, no card", () => {
    expect(weekCard({ ...sun, mine: 0, gym: 90 })).toBeNull();
  });
  it("Sunday: the week so far; Monday: the week closed", () => {
    expect(weekCardLines(weekCard(sun)!)).toEqual(["3h 10m this week.", "Finish it strong."]);
    expect(weekCardLines(weekCard({ ...sun, moment: "monday" })!)).toEqual(["3h 10m last week.", "Run it back."]);
  });
  it("Best week yet only when it beats every earlier week (three to beat)", () => {
    expect(weekCard({ ...sun, earlier: [100, 120, 150] })?.headline).toBe("Best week yet: 3h 10m.");
    expect(weekCard({ ...sun, moment: "monday", earlier: [100, 120, 150] })?.headline).toBe("Best week yet: 3h 10m.");
    expect(weekCard({ ...sun, earlier: [100, 120, 300] })?.headline).toBe("3h 10m this week.");
    expect(weekCard({ ...sun, earlier: [100, 120] })?.best).toBe(false);
  });
  it("names friends only when it is true, two at most; never the old place line", () => {
    const f = (name: string, minutes: number) => ({ name, minutes });
    expect(weekCardFriendsLine("sunday", 100, [f("Nico A.", 60)])).toBe("You're outworking Nico.");
    expect(weekCardFriendsLine("sunday", 100, [f("Nico A.", 60), f("Diego R.", 80), f("Kai T.", 10)])).toBe("You're outworking Diego and Nico.");
    expect(weekCardFriendsLine("monday", 100, [f("Nico A.", 60), f("Diego R.", 80)])).toBe("You outworked Diego and Nico.");
    expect(weekCardFriendsLine("sunday", 100, [f("Kai T.", 150), f("Nico A.", 60)])).toBe("Only Kai has done more. You've still got today.");
    expect(weekCardFriendsLine("monday", 100, [f("Kai T.", 150), f("Nico A.", 60)])).toBe("Only Kai did more. This week that changes.");
    // two or more in front: nothing said; friends who did not train are never named
    expect(weekCardFriendsLine("sunday", 100, [f("Kai T.", 150), f("Diego R.", 120)])).toBeNull();
    expect(weekCardFriendsLine("sunday", 100, [f("Kai T.", 0)])).toBeNull();
    expect(weekCardFriendsLine("sunday", 100, [f("Kai T.", 100)])).toBeNull(); // level is neither
    const card = weekCard({ ...sun, gym: 90, friends: [f("Nico A.", 60)] })!;
    expect(weekCardLines(card)).toEqual(["3h 10m this week.", "Gym: 1h 30m.", "You're outworking Nico.", "Finish it strong."]);
    expect(JSON.stringify(card)).not.toMatch(/friends who trained|\d(st|nd|rd|th) of/);
  });
  it("one number a line, no exclamation, no they/them/their", () => {
    const f = (name: string, minutes: number) => ({ name, minutes });
    for (const moment of ["sunday", "monday"] as const) {
      for (const friends of [[], [f("Nico A.", 60)], [f("Kai T.", 400)], [f("Nico A.", 60), f("Diego R.", 80)]]) {
        for (const earlier of [[], [10, 20, 30]]) {
          for (const line of weekCardLines(weekCard({ ...sun, moment, friends, earlier, gym: 45 })!)) {
            expect((line.match(/\d+h( \d+m)?|\d+m\b/g) ?? []).length, line).toBeLessThanOrEqual(1);
            expect(line, line).not.toMatch(/!|\b(they|them|their)\b/i);
          }
        }
      }
    }
  });
  it("builds 10 and 11 keep the Monday moment as it was; the week's card rides in its own field", () => {
    const server = read("lib/elite/free-app-server.ts");
    expect(server).toContain("weekRecapFor(viewer, tracker, today).catch(() => null)");
    expect(server).toContain("weekCardFor(viewer, tracker).catch(() => null)");
    expect(server).toContain("weekCard: card,");
    expect(read("lib/elite/app-contract.ts")).toMatch(/weekCard\?: WeekCard \| null;/);
    const phone = read("mobile/src/MondayCard.tsx");
    expect(phone).toContain("if (card !== undefined)");
    expect(phone).toContain("weekCardDue(card, prefs.recapSeen)");
    expect(read("mobile/app/(free)/my-week.tsx")).toContain("<MondayCard card={w.weekCard} recap={w.recap}");
    const fn = read("lib/elite/tracker-server.ts");
    const card = fn.slice(fn.indexOf("export async function weekCardFor"), fn.indexOf("// The owner of a link's code"));
    expect(card).not.toMatch(/sendPush|notify|insert\(|upsert\(/);
  });
});
