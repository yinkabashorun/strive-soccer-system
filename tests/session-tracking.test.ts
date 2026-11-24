import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  ACTUAL_CAP_FACTOR,
  MINUTES_MAX,
  MINUTES_MIN,
  cappedSeconds,
  creditedMinutes,
  minutesOfSeconds,
  realMinutes,
  timeByArea,
  timeTrained,
  weekMinutes,
} from "@/lib/elite/time-trained";
import { newClock, resetDrill, secondsOn, showDrill } from "@/lib/elite/drill-clock";
import { doneMinutes, sessionProgress } from "@/lib/elite/session-flow";
import { weeklyMinutes } from "@/lib/elite/experience";
import { queueTick, parseTicks } from "@/lib/elite/tick-outbox";
import type { Homework } from "@/lib/elite/types";

// Coach Yinka, Nov 24 2026: "the tracking of sessions needs to be
// absolutely and utterly on point. No placeholders."
//
// What that is held to, end to end:
//   1. the minutes a player is credited for a drill are the plan's or the
//      coach's own, never a figure put in because one was missing
//   2. a tick is written once: sent twice, it changes nothing the second
//      time (the time a drill was done does not move)
//   3. the phone keeps a tick until the server answers and never shows a
//      total it added up on the side
const root = path.resolve(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");
function files(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n.startsWith(".")) continue;
    const f = path.join(dir, n);
    if (statSync(f).isDirectory()) files(f, out);
    else if (/\.(ts|tsx)$/.test(n)) out.push(f);
  }
  return out;
}

describe("a drill's minutes are never made up", () => {
  it("real minutes are a whole number from 1 to 120, and nothing else counts", () => {
    expect([MINUTES_MIN, MINUTES_MAX]).toEqual([1, 120]);
    for (const ok of [1, 4, 14, 120]) expect(realMinutes(ok)).toBe(ok);
    for (const no of [0, -3, 121, 7.5, NaN, Infinity, "10", null, undefined]) expect(realMinutes(no), String(no)).toBeNull();
  });

  it("no code that writes a drill into a week puts a number in for missing minutes", () => {
    // lib/elite/demo.ts is the signed-out example tour: made-up by design,
    // never written to the database.
    const writers = [...files(path.join(root, "lib")), ...files(path.join(root, "app"))].filter((f) => !f.endsWith("lib/elite/demo.ts"));
    const bad = writers.filter((f) => /duration_min:\s*[^,\n]*(\?\?|\|\|)\s*\d/.test(readFileSync(f, "utf8"))).map((f) => path.relative(root, f));
    expect(bad).toEqual([]);
  });

  it("the publish gate stops a drill with no minutes before a row is written", () => {
    const publish = read("lib/elite/coach-actions.ts");
    expect(publish).toContain("realMinutes(d.minutes) ?? match?.minutes ?? null");
    expect(publish).toMatch(/if \(minutes === null\) \{\s*throw new Error\(`Refusing to publish/);
    expect(publish).toContain("duration_min: minutes,");
    const extra = read("lib/elite/extra-actions.ts");
    expect(extra).toContain("drills.some((d) => realMinutes(d.minutes) === null)");
  });

  it("the plan builder hands on no minutes rather than inventing ten", () => {
    const ai = read("lib/elite/ai-coach.ts");
    const clamp = ai.slice(ai.indexOf("function clampMin"), ai.indexOf("}", ai.indexOf("function clampMin")) + 1);
    expect(clamp).toContain("return undefined");
    expect(clamp).not.toMatch(/return 1[05];/);
  });

  it("the database refuses it too: no default, and a check (migration 084)", () => {
    const sql = read("supabase/migrations/084_homework_minutes_required.sql");
    expect(sql).toContain("alter column duration_min drop default");
    expect(sql).toContain("check (duration_min between 1 and 120)");
    expect(sql).not.toMatch(/^\s*(update|delete|insert)\b/im);
  });
});

describe("a tick is written once", () => {
  const action = read("lib/elite/player-actions.ts");
  const toggle = action.slice(action.indexOf("export async function toggleHomework"), action.indexOf("// Player submits their monthly film LINK"));
  it("only a row that is changing is touched, so a repeat does not move the time it was done", () => {
    expect(toggle).toContain('.neq("completed", completed)');
    expect(toggle).toContain("completed_at: completed ? new Date().toISOString() : null");
  });
  it("a row that did not change is only called saved when it already read that way", () => {
    // under RLS an update of someone else's row changes nothing and raises
    // nothing: that must never be answered as saved
    expect(toggle).toContain('.select("id");');
    expect(toggle).toContain("if (!row || Boolean(row.completed) !== completed) return { ok: false as const, again: false };");
  });
  it("a write the database turned down is reported, not swallowed", () => {
    expect(toggle).toContain("if (error) return { ok: false as const");
    const route = read("app/api/app/drill/route.ts");
    expect(route).toContain("wrote.again ? 503 : 409");
    // and the answer is what the database holds, read back
    expect(route.indexOf("toggleHomework(id, completed)")).toBeLessThan(route.lastIndexOf('.select("id, completed")'));
  });
});

describe("the phone never loses a tick or shows one that is not there", () => {
  const queries = read("mobile/src/api/queries.ts");
  const outbox = read("mobile/src/outbox.ts");
  const session = read("mobile/app/session/[n].tsx");

  it("a tick goes through the outbox, never a send-once mutation that is taken back", () => {
    const toggle = queries.slice(queries.indexOf("export function useToggleDrill"), queries.indexOf("export function useAddExtra"));
    expect(toggle).toContain("tickDrill(v.id, v.completed, v.seconds)");
    expect(toggle).not.toContain("useMutation");
    expect(queries).not.toContain("APP_API.drill");
    // one place sends a tick
    const senders = files(path.join(root, "mobile")).filter((f) => readFileSync(f, "utf8").includes("APP_API.drill")).map((f) => path.relative(root, f));
    expect(senders).toEqual(["mobile/src/outbox.ts"]);
  });

  it("the list is written to the phone on every change and sent again when the app comes back", () => {
    expect(outbox.match(/save\(\);/g)?.length).toBeGreaterThanOrEqual(3);
    expect(outbox).toContain('if (s === "active") void sendOutbox();');
    expect(outbox).toContain("retryDelayMs(next.tries)");
    expect(read("mobile/app/_layout.tsx")).toContain("void loadOutbox()");
  });

  it("every screen reads the week with the unsent ticks laid over it", () => {
    const useWeek = queries.slice(queries.indexOf("export function useWeek"), queries.indexOf("export function useYou"));
    expect(useWeek).toContain("overlay(q.data, ticks)");
    // nothing else reads the week from the cache behind its back
    const direct = files(path.join(root, "mobile/app")).filter((f) => /getQueryData<AppWeek>/.test(readFileSync(f, "utf8")));
    expect(direct).toEqual([]);
  });

  it("the finish screen's all-time figure is the week's own, never a sum kept on the side", () => {
    expect(session).toContain("const total = week.totalMinutes;");
    expect(session).not.toMatch(/before\.current|finish\.total/);
    expect(session).toContain("REFUSED_LINE : UNSENT_LINE");
  });

  it("signing out tries once more, then leaves no tick on the phone", () => {
    const account = read("mobile/src/account.ts");
    expect(account.match(/await clearCache\(\);\n\s*await clearOutbox\(\);/g)?.length).toBe(2);
    expect(account.indexOf("await sendOutbox()")).toBeLessThan(account.indexOf("await signOutHere()"));
  });
});

describe("the website keeps a tick the same way", () => {
  const rows = read("components/elite/SessionRows.tsx");
  const store = read("components/elite/web-ticks.ts");
  it("a tick goes into the browser's list, never a send-once call", () => {
    expect(rows).toContain("tickOnWeb(id, next, seconds)");
    expect(rows).not.toContain("toggleHomework");
    // one place on the website sends a tick
    const senders = [...files(path.join(root, "components")), ...files(path.join(root, "app"))]
      .filter((f) => /toggleHomework\(/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(root, f))
      .sort();
    expect(senders).toEqual(["app/api/app/drill/route.ts", "components/elite/web-ticks.ts"]);
  });
  it("it is stored, sent again when the browser is back online, and follows the shared rules", () => {
    expect(store).toContain("window.localStorage.setItem(WEB_TICKS_KEY");
    expect(store).toContain('window.addEventListener("online"');
    expect(store).toContain('res.ok ? "saved" : res.again ? "retry" : "refused"');
    expect(store).toContain('outcome = "retry"; // no answer at all');
    expect(store).toContain('from "@/lib/elite/tick-outbox"');
    expect(read("mobile/src/outbox-core.ts")).toContain('export * from "@shared/tick-outbox";');
  });
  it("the finish screen says so when a tick is still on its way or was refused", () => {
    expect(read("components/elite/SessionPlayer.tsx")).toContain("notSaved ? REFUSED_LINE : UNSENT_LINE_WEB");
  });
});

// Coach Yinka, Nov 24 2026: "Minutes trained should be ACTUAL minutes
// trained." The session player times each drill; that time is what counts.
describe("minutes trained are the actual minutes", () => {
  const row = (over: Partial<Homework>): Homework =>
    ({ id: "r", player_id: "p", week: 1, session: 1, title: "t", completed: true, completed_at: "2026-11-24T10:00:00Z", duration_min: 6, pillar: "Weak Foot", sort: 0, ...over }) as Homework;

  it("a drill counts the whole minutes it really took", () => {
    expect(creditedMinutes(row({ actual_seconds: 250 }))).toBe(4); // 4m10s
    expect(creditedMinutes(row({ actual_seconds: 330 }))).toBe(6); // 5m30s rounds up
    expect(creditedMinutes(row({ actual_seconds: 20 }))).toBe(0); // ticked off in seconds: nothing
    expect(creditedMinutes(row({ actual_seconds: 0 }))).toBe(0);
    expect(creditedMinutes(row({ completed: false, actual_seconds: 250 }))).toBe(0);
    expect(minutesOfSeconds(89)).toBe(1);
  });

  it("a drill finished before the app measured time keeps the plan's minutes, so no total goes down", () => {
    expect(creditedMinutes(row({ actual_seconds: null }))).toBe(6);
    expect(creditedMinutes(row({}))).toBe(6);
  });

  it("one drill never counts more than twice its plan, and nonsense is no time at all", () => {
    expect(ACTUAL_CAP_FACTOR).toBe(2);
    expect(cappedSeconds(8 * 3600, 6)).toBe(720); // a phone left open overnight
    expect(cappedSeconds(301.4, 6)).toBe(301);
    for (const no of [-1, NaN, Infinity, "300", null, undefined]) expect(cappedSeconds(no, 6), String(no)).toBeNull();
  });

  it("every total adds up the same actual minutes", () => {
    const rows = [
      row({ id: "a", actual_seconds: 250 }), // 4
      row({ id: "b", actual_seconds: null, duration_min: 5, pillar: "Passing" }), // 5, from before
      row({ id: "c", actual_seconds: 20 }), // 0
      row({ id: "d", completed: false, completed_at: null }),
      row({ id: "e", week: 2, actual_seconds: 600, duration_min: 10 }), // 10
    ];
    const t = timeTrained(rows);
    expect(t.minutes).toBe(19);
    expect(weekMinutes(rows, 1)).toBe(9);
    expect(weeklyMinutes(rows, 2, 2)).toEqual([{ week: 1, minutes: 9 }, { week: 2, minutes: 10 }]);
    const areas = timeByArea(rows, 2);
    expect(areas.reduce((s, a) => s + a.minutes, 0)).toBe(t.minutes);
    expect(t.byPillar.reduce((s, a) => s + a.minutes, 0)).toBe(t.minutes);
  });

  it("the screen counts a drill just ticked at the time just measured, by the server's own rule", () => {
    const h = row({ id: "x", completed: false, completed_at: null });
    expect(doneMinutes(h, {}, {})).toBe(0);
    expect(doneMinutes(h, { x: true }, { x: 250 })).toBe(4);
    expect(doneMinutes(h, { x: true }, { x: 99999 })).toBe(12); // capped like the server
    // done on the server already: what the server holds
    expect(doneMinutes(row({ id: "y", actual_seconds: 400 }), {}, {})).toBe(7);
    // unticked on this screen
    expect(doneMinutes(row({ id: "y", actual_seconds: 400 }), { y: false }, {})).toBe(0);
    const p = sessionProgress([h, row({ id: "y", actual_seconds: 400 })], { x: true }, { x: 250 });
    expect([p.minutesTotal, p.minutesDone]).toEqual([12, 11]); // the plan, then the truth
  });

  it("the clock times the drill that is on screen, and only that", () => {
    let c = newClock();
    c = showDrill(c, "a", 1_000);
    expect(secondsOn(c, "a", 61_000)).toBe(60);
    c = showDrill(c, "b", 61_000); // flipped to another drill
    expect(secondsOn(c, "a", 200_000)).toBe(60);
    expect(secondsOn(c, "b", 91_000)).toBe(30);
    c = showDrill(c, "a", 91_000); // and back: the time adds up
    expect(secondsOn(c, "a", 121_000)).toBe(90);
    c = showDrill(c, null, 121_000); // the finish screen: nobody's time
    expect(secondsOn(c, "a", 999_000)).toBe(90);
    c = resetDrill(c, "a", 999_000); // unticked: starts from nothing
    expect(secondsOn(c, "a", 999_000)).toBe(0);
  });

  it("the measured time rides on the tick, and only on a tick that marks a drill done", () => {
    expect(queueTick([], "a", true, 1, 250.6)[0].seconds).toBe(251);
    expect(queueTick([], "a", false, 1, 250)[0].seconds).toBeUndefined();
    expect(queueTick([], "a", true, 1)[0].seconds).toBeUndefined();
    expect(parseTicks(JSON.stringify([{ id: "a", completed: true, at: 1, seconds: 250 }]))[0].seconds).toBe(250);
  });

  it("both session players send it, and the save keeps it on the row", () => {
    expect(read("mobile/app/session/[n].tsx")).toContain("toggle.mutate({ id: drill.id, completed: true, seconds })");
    expect(read("components/elite/SessionPlayer.tsx")).toContain("onToggle(drill.id, true, seconds)");
    expect(read("mobile/src/outbox.ts")).toContain("seconds: next.seconds");
    expect(read("components/elite/web-ticks.ts")).toContain("toggleHomework(next.id, next.completed, next.seconds)");
    expect(read("lib/elite/player-actions.ts")).toContain("actual_seconds: completed ? cappedSeconds(seconds, MINUTES_MAX) : null");
    expect(read("app/api/app/drill/route.ts")).toContain("toggleHomework(id, completed, seconds)");
  });

  it("no total anywhere adds up the plan's minutes for what was done", () => {
    // the plan's minutes are read in two places only: the plan itself
    // (drillMinutes) and the one rule (creditedMinutes, for a drill with no
    // measured time). lib/elite/demo.ts is the example tour.
    const all = [...files(path.join(root, "lib")), ...files(path.join(root, "app")), ...files(path.join(root, "components"))];
    const readers = all
      .filter((f) => !f.endsWith("lib/elite/demo.ts") && /duration_min\s*\?\?/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(root, f))
      .sort();
    expect(readers).toEqual(["lib/elite/session-flow.ts", "lib/elite/time-trained.ts"]);
  });

  it("the database keeps the same rules, and the coach's summary adds up the same way (085)", () => {
    const sql = read("supabase/migrations/085_actual_minutes.sql");
    expect(sql).toContain("add column if not exists actual_seconds integer");
    expect(sql).toContain(`greatest(new.duration_min, 1) * 60 * ${ACTUAL_CAP_FACTOR}`);
    expect(sql).toMatch(/if not new\.completed then\s*new\.actual_seconds := null;/);
    expect(sql).toContain("case when actual_seconds is null then duration_min");
    expect(sql).toContain("round(actual_seconds / 60.0)::int");
    expect(sql).not.toMatch(/^\s*(update|delete)\s/im);
  });
});
