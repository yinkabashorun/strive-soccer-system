import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { MINUTES_MAX, MINUTES_MIN, realMinutes } from "@/lib/elite/time-trained";

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
    expect(toggle).toContain("tickDrill(v.id, v.completed)");
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
    expect(rows).toContain("tickOnWeb(id, next)");
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
