import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FIRST_GROUP_AT,
  INVITE_BATCH,
  cleanSource,
  cleanWaitlist,
  cleanWaitlistCode,
  inFirstGroup,
  inviteOrder,
  maskedPhone,
  openText,
  PICKUP_HEAD_START_HOURS,
  WAITLIST_LANDING_LINE,
  WAITLIST_PERKS,
  cleanPickupLink,
  pickupOrder,
  pickupText,
  teammateCounts,
  teammatesLine,
  waitlistLink,
  waitlistPhone,
  waitlistProblem,
  welcomeText,
  type WaitlistRow,
} from "@/lib/elite/waitlist";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const row = (over: Partial<WaitlistRow>): WaitlistRow => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  first_name: "Sam",
  last_name: "Lee",
  phone: "+17035550100",
  team: null,
  code: "ABCDEFGH",
  referred_by: null,
  invited_at: null,
  created_at: "2026-11-22T12:00:00Z",
  ...over,
});

describe("the waitlist (075)", () => {
  it("takes a US number with its area code, as E.164, and nothing else", () => {
    expect(waitlistPhone("(703) 555-0100")).toBe("+17035550100");
    expect(waitlistPhone("1 703 555 0100")).toBe("+17035550100");
    expect(waitlistPhone("555-0100")).toBeNull();
    expect(waitlistPhone("0035550100")).toBeNull();
    expect(waitlistPhone(42)).toBeNull();
  });

  it("checks each screen with one rule, and the team is optional", () => {
    const ok = { firstName: "Sam", lastName: "Lee", phone: "7035550100" };
    expect(waitlistProblem(ok)).toBeNull();
    expect(waitlistProblem({ ...ok, firstName: " " })?.step).toBe("name");
    expect(waitlistProblem({ ...ok, phone: "123" })?.step).toBe("phone");
    expect(waitlistProblem({ ...ok, team: "https://spam.example" })?.step).toBe("team");
    expect(waitlistProblem({ ...ok, firstName: "www.spam.com" })?.step).toBe("name");
    expect(cleanWaitlist({ ...ok, team: "  VDA  ECNL " })).toEqual({
      firstName: "Sam",
      lastName: "Lee",
      phone: "+17035550100",
      team: "VDA ECNL",
    });
    expect(cleanWaitlist({ ...ok, team: "" })?.team).toBeNull();
  });

  it("links carry the player's own code on /join, and a bad code is no code", () => {
    expect(waitlistLink("https://thestriveapp.com/", "ABCDEFGH")).toBe("https://thestriveapp.com/join?w=ABCDEFGH");
    expect(cleanWaitlistCode("abcdefgh")).toBe("ABCDEFGH");
    expect(cleanWaitlistCode("ABC")).toBeNull();
    expect(cleanSource("5v5")).toBe("5v5");
    expect(cleanSource("<script>")).toBeNull();
  });

  it("the first group starts at three teammates, and the line says where you are", () => {
    expect(FIRST_GROUP_AT).toBe(3);
    expect(inFirstGroup(2)).toBe(false);
    expect(inFirstGroup(3)).toBe(true);
    expect(teammatesLine(1)).toBe("1 of 3 teammates joined with your link.");
    expect(teammatesLine(3)).toContain("You're in the first group.");
    expect(teammatesLine(5)).toContain("5 teammates");
    expect(maskedPhone("+17035550100")).toBe("the number ending in 0100");
  });

  it("the two texts are plain, short, carry the link, and the first offers STOP", () => {
    const w = welcomeText("Sam", "https://thestriveapp.com/join?w=ABCDEFGH");
    const o = openText("Sam", "https://thestriveapp.com/join");
    for (const t of [w, o]) {
      expect(t.length).toBeLessThan(320);
      expect(t).not.toMatch(/—|AI\b|automated/);
      expect(t).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    }
    expect(w).toContain("join?w=ABCDEFGH");
    expect(w).toContain("Reply STOP");
    expect(o).toContain("/join");
  });

  it("counts teammates by code, and texts the first group first, never anyone twice", () => {
    const rows = [
      row({ id: "a", code: "AAAAAAAA", created_at: "2026-11-22T10:00:00Z" }),
      row({ id: "b", code: "BBBBBBBB", created_at: "2026-11-22T09:00:00Z" }),
      row({ id: "c", code: "CCCCCCCC", referred_by: "AAAAAAAA" }),
      row({ id: "d", code: "DDDDDDDD", referred_by: "AAAAAAAA" }),
      row({ id: "e", code: "EEEEEEEE", referred_by: "AAAAAAAA", invited_at: "2026-11-22T13:00:00Z" }),
    ];
    expect(teammateCounts(rows).get("AAAAAAAA")).toBe(3);
    expect(inviteOrder(rows, "first_group").map((r) => r.id)).toEqual(["a"]);
    const everyone = inviteOrder(rows, "everyone").map((r) => r.id);
    expect(everyone[0]).toBe("a"); // the first group leads
    expect(everyone).not.toContain("e"); // already texted
    expect(everyone).toContain("b");
    expect(INVITE_BATCH).toBeLessThanOrEqual(50);
  });

  it("the table is written by the server only, and coaches read it", () => {
    const sql = read("supabase/migrations/075_waitlist.sql");
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/for select\s+using \(public\.elite_is_coach\(\)\)/);
    expect(sql).not.toMatch(/for insert|for update|for all/);
    expect(sql).toMatch(/phone text not null unique/);
  });

  it("nothing is stored under 13, sign-up open means no waitlist, and the age is checked on the server", () => {
    const route = read("app/api/elite/waitlist/route.ts");
    expect(route).toMatch(/oldEnough\(birth, today\)/);
    expect(route).toMatch(/isFreeSignupOpen\(\)/);
    expect(route.indexOf("oldEnough")).toBeLessThan(route.indexOf("joinWaitlist({"));
    expect(route).toMatch(/rateLimit\(/);
  });

  it("the coach's texts only go out while free sign-up is open", () => {
    const actions = read("lib/elite/waitlist-actions.ts");
    expect(actions).toMatch(/if \(!\(await isFreeSignupOpen\(\)\)\) return fail\(OPEN_FIRST_MESSAGE\)/);
    expect(actions).toMatch(/viewer\.role === "player"/);
  });

  it("the Privacy Policy names the waitlist", () => {
    expect(read("app/privacy/page.tsx")).toContain("The waitlist:");
  });

  it("the three perks are his: pickup 48 hours early, the 5v5 team graphic, the first Strive Stars", () => {
    expect(PICKUP_HEAD_START_HOURS).toBe(48);
    expect(WAITLIST_PERKS.map((p) => p.title)).toEqual([
      "Pickup sign-up first",
      "Your 5v5 team, in the rollout",
      "The first Strive Stars",
    ]);
    for (const p of WAITLIST_PERKS) expect(p.line).not.toMatch(/—|AI\b|automated|guarantee/);
    expect(WAITLIST_LANDING_LINE).toContain("48 hours");
    expect(read("components/elite/WaitlistStatus.tsx")).toContain("WAITLIST_PERKS");
    expect(read("components/elite/JoinLanding.tsx")).toContain("WAITLIST_LANDING_LINE");
    expect(read("components/events/FiveVFiveLanding.tsx")).toContain("E.waitlist");
  });

  it("a pickup link is https only, goes to each person once, and a new link goes to everyone", () => {
    expect(cleanPickupLink("https://link.example.com/pickup")).toBe("https://link.example.com/pickup");
    expect(cleanPickupLink("http://link.example.com")).toBeNull();
    expect(cleanPickupLink("javascript:alert(1)")).toBeNull();
    expect(cleanPickupLink("https://a b.com")).toBeNull();
    const t = pickupText("Sam", "https://x.example.com/p");
    expect(t).toContain("48 hours");
    expect(t).toContain("https://x.example.com/p");
    expect(t).toContain("Reply STOP");
    expect(t.length).toBeLessThan(320);
    const rows = [
      { id: "a", created_at: "2026-11-22T10:00:00Z", pickup_link: "https://x.example.com/p" },
      { id: "b", created_at: "2026-11-22T09:00:00Z", pickup_link: null },
      { id: "c", created_at: "2026-11-22T11:00:00Z", pickup_link: "https://x.example.com/old" },
    ];
    expect(pickupOrder(rows, "https://x.example.com/p").map((r) => r.id)).toEqual(["b", "c"]);
    expect(pickupOrder(rows, "https://x.example.com/next").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("the pickup text needs a coach, a clean link, and never waits on sign-up opening", () => {
    const actions = read("lib/elite/waitlist-actions.ts");
    const fn = actions.slice(actions.indexOf("export async function textWaitlistPickup"));
    expect(fn).toMatch(/cleanPickupLink\(rawLink\)/);
    expect(fn.slice(0, fn.indexOf("// Take one person"))).not.toMatch(/isFreeSignupOpen/);
    const sql = read("supabase/migrations/076_waitlist_pickup.sql");
    expect(sql).toMatch(/pickup_link text/);
    expect(sql).not.toMatch(/create policy|for insert|for update/);
  });
});
