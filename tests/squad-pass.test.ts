import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PASS_DAYS,
  PASS_MAX,
  SQUAD_BODY,
  SQUAD_READY_BODY,
  SQUAD_READY_TITLE,
  SQUAD_TITLE,
  TEAMMATES_PER_PASS,
  buildSquad,
  passEndsAt,
  passesEarned,
  runningLine,
  squadSlots,
  waitingLine,
} from "@/lib/elite/squad-pass";
import { PRO_PRODUCT_NAME } from "@/lib/elite/pro";
import { squadPassPush } from "@/lib/elite/push-texts";

// BRING YOUR SQUAD (Nov 24 2026, Coach Yinka: "take deep thought on the
// best referral loops we can implement and do exactly that"): three
// teammates who join with a player's link and post their first training
// earn that player a month of Strive Pro.
const root = path.resolve(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");
const people = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: `p${from + i}`, name: `Player ${from + i}` }));

describe("three teammates who train earn a month", () => {
  it("every three is a month, up to the most an account can earn", () => {
    expect([TEAMMATES_PER_PASS, PASS_DAYS, PASS_MAX]).toEqual([3, 30, 6]);
    expect([0, 1, 2, 3, 5, 6, 17, 18, 40].map(passesEarned)).toEqual([0, 0, 0, 1, 1, 2, 5, 6, 6]);
    expect(passesEarned(-4)).toBe(0);
  });

  it("the three places show who trained, then who joined, then what is open", () => {
    expect(squadSlots([], [], 0).map((s) => s.state)).toEqual(["open", "open", "open"]);
    expect(squadSlots(people(1), people(1, 5), 1)).toEqual([
      { state: "trained", name: "Player 0" },
      { state: "joined", name: "Player 5" },
      { state: "open", name: null },
    ]);
    // a fourth teammate starts the next three: the first three were used
    expect(squadSlots(people(4), [], 4).map((s) => [s.state, s.name])).toEqual([
      ["trained", "Player 3"],
      ["open", null],
      ["open", null],
    ]);
    expect(squadSlots(people(2), people(5, 5), 2)).toHaveLength(3);
  });

  it("a month started while one is running carries on from its end", () => {
    const now = new Date("2026-12-01T12:00:00Z");
    expect(passEndsAt(now, null).toISOString()).toBe("2026-12-31T12:00:00.000Z");
    expect(passEndsAt(now, new Date("2026-12-10T12:00:00Z")).toISOString()).toBe("2027-01-09T12:00:00.000Z");
    // one that is already over does not count
    expect(passEndsAt(now, new Date("2026-11-20T12:00:00Z")).toISOString()).toBe("2026-12-31T12:00:00.000Z");
  });

  it("the card says where things stand", () => {
    const start = buildSquad({ trained: [], joined: [], passes: [], runningUntil: null });
    expect(start).toMatchObject({ ready: 0, title: SQUAD_TITLE, body: SQUAD_BODY, waiting: null, canEarnMore: true });
    const earned = buildSquad({ trained: people(3), joined: [], passes: [{ started: false, running: false }], runningUntil: null });
    expect(earned).toMatchObject({ ready: 1, title: SQUAD_READY_TITLE, body: SQUAD_READY_BODY });
    const running = buildSquad({ trained: people(3), joined: people(1, 9), passes: [{ started: true, running: true }], runningUntil: "Thu, Dec 24" });
    expect(running).toMatchObject({ ready: 0, runningUntil: "Thu, Dec 24", title: SQUAD_TITLE });
    expect(buildSquad({ trained: people(18), joined: [], passes: [], runningUntil: null }).canEarnMore).toBe(false);
  });

  it("says it in plain words, with the membership's own name and no price", () => {
    expect(SQUAD_TITLE).toBe("Bring 3 teammates. Get a month of Strive Pro.");
    expect(waitingLine([])).toBeNull();
    expect(waitingLine(people(1))).toBe("Player 0 joined. They count once they post their first training.");
    expect(waitingLine(people(3))).toBe("Player 0 and 2 more joined. Each counts once they post their first training.");
    expect(runningLine("Thu, Dec 24")).toBe("Your earned month of Strive Pro runs until Thu, Dec 24.");
    const push = squadPassPush();
    for (const line of [SQUAD_TITLE, SQUAD_BODY, SQUAD_READY_TITLE, SQUAD_READY_BODY, push.title, push.body]) {
      expect(line).not.toMatch(/—|\$|free trial|referral|unlock|AI\b|automated/i);
      expect(line).toContain(line.trim());
    }
    // the name is the one the paid membership is sold under
    expect(SQUAD_TITLE).toContain(PRO_PRODUCT_NAME);
  });
});

describe("on the server", () => {
  const server = read("lib/elite/squad-pass-server.ts");
  const sql = read("supabase/migrations/086_squad_pass.sql");

  it("a teammate counts on a training PHOTO post, once, for whoever brought them", () => {
    const post = read("app/api/elite/tracker/post/route.ts");
    expect(post).toContain("await countTeammate(viewer.profile.id)");
    // the one-tap log with no photo does not count anyone
    expect(read("lib/elite/tracker-actions.ts")).not.toContain("countTeammate");
    expect(sql).toMatch(/teammate\s+uuid primary key/);
    expect(server).toContain('.insert({ teammate: posterId, profile_id: broughtBy })');
    expect(server).toContain("if (error) return; // already counted");
  });

  it("a month is earned once (the database's key), and its owner is told once", () => {
    expect(sql).toContain("unique (profile_id, number)");
    expect(server).toContain("if (fresh > 0) await sendPushToProfile(profileId, squadPassPush())");
  });

  it("only the server writes a count or a month", () => {
    expect((sql.match(/enable row level security/g) ?? []).length).toBe(2);
    expect(sql).not.toMatch(/for (insert|update|delete|all)/i);
    expect(server).not.toMatch(/createClient\(\)/);
  });

  it("starting takes no card, starts one month for two taps, and never touches a paying member", () => {
    expect(server).not.toMatch(/stripe|checkout/i);
    expect(server).toContain('.is("started_at", null)');
    expect(server).toContain('row.subscription_status === "active"');
    expect(server).toContain('.update({ subscription_status: "trialing" }).eq("id", row.id).neq("subscription_status", "active")');
  });

  it("when the month is up the account is a free account again, unless they pay or another month runs", () => {
    expect(read("app/api/elite/cron/weekly-plans/route.ts")).toContain("await endDuePasses()");
    expect(server).toContain('.update({ subscription_status: "none" }).eq("id", player.id).eq("subscription_status", "trialing")');
    expect(server).toContain('.in("status", ["active", "trialing", "past_due"])');
    // a Strive Pro row that is not on, on an account with a free log, is a free account
    expect(read("lib/elite/member-gate.ts")).toContain("if (gate?.startPro) return i.isFree ? free");
  });

  it("the card is the only place it is asked, on both Friends screens", () => {
    expect(read("components/elite/FriendsFeed.tsx").match(/<SquadCard\b/g)?.length).toBe(1);
    expect(read("mobile/app/(free)/friends.tsx").match(/<SquadCard\b/g)?.length).toBe(1);
  });
});
