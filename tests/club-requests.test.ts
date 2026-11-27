import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLUB_REQUESTS_FULL_MESSAGE, clubAskLine, clubAskQuestion, clubRequestSentLine } from "@/lib/elite/tracker";

// Clubs by request (073, Coach Yinka Nov 20 2026: "clubs, yes"). A club's
// link asks to join; the captain lets a player in, or the coaches for a club
// a coach made. Only then is the player on the club and friends with it.

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const server = read("lib/elite/tracker-server.ts");
const fn = (name: string) => {
  const at = server.indexOf(`export async function ${name}(`);
  return server.slice(at, server.indexOf("\nexport ", at + 10));
};

describe("the table", () => {
  it("is written only by our server, one request a club and player", () => {
    const sql = read("supabase/migrations/073_club_join_requests.sql");
    expect(sql).toContain("primary key (club_id, profile_id)");
    expect(sql).toContain("enable row level security");
    expect(sql).not.toMatch(/create policy/i);
  });
});

describe("asking", () => {
  const ask = fn("requestClub");
  it("never puts a player on a club", () => {
    expect(ask).not.toContain("joinClub(");
    expect(ask).not.toContain("elite_tracker_club_members\").insert");
  });
  it("gives the same refusals a join would, a removal included, and caps waiting requests", () => {
    expect(ask).toContain("clubJoinDecision(");
    expect(ask).toContain('if (ban) return "removed";');
    expect(ask).toContain("CLUB_REQUESTS_PENDING_MAX");
  });
  it("is the only door from a link, signed in or at sign-up", () => {
    expect(server).not.toContain("export async function joinClubByCode(");
    expect(read("lib/elite/tracker-actions.ts")).toContain("requestClubByCode(o.profileId, code)");
    expect(read("app/api/elite/auth/join/route.ts")).toContain("requestClubByCode(userId, club)");
  });
});

describe("letting in", () => {
  const answer = fn("answerClubRequest");
  it("only the captain answers for a player's club, the coaches for any", () => {
    expect(answer).toContain('if (!input.approverIsCoach && club.captain_id !== input.approverId) return "not_yours";');
    expect(answer.indexOf('"not_yours"')).toBeLessThan(answer.indexOf("joinClub("));
  });
  it("acts only on a request that exists, and letting in goes through the usual join", () => {
    expect(answer.indexOf('if (!request) return "none"')).toBeLessThan(answer.indexOf("joinClub("));
    expect(answer.indexOf('if (!input.accept) return "ok"')).toBeLessThan(answer.indexOf("joinClub("));
  });
  it("a player's action is never a coach's, and the coach action checks the coach", () => {
    const actions = read("lib/elite/tracker-actions.ts");
    expect(actions).toMatch(/approverId: o\.profileId,\s*approverIsCoach: false,/);
    const coachAct = actions.slice(actions.indexOf("export async function answerClubRequestsAsCoach("));
    expect(coachAct.indexOf("await coach()")).toBeLessThan(coachAct.indexOf("approverIsCoach: true"));
  });
  it("a request shows a name and initials, never a photo", () => {
    expect(fn("clubRequestsFor")).not.toMatch(/avatar|photo/i);
  });
});

describe("the words", () => {
  it("say who lets them in", () => {
    expect(clubAskQuestion("Bull Run")).toBe("Ask to join Bull Run?");
    expect(clubAskLine(false)).toContain("The club's captain lets you in");
    expect(clubAskLine(true)).toContain("The coaches let you in");
    expect(clubRequestSentLine("Bull Run", false)).toBe("Request sent. You're in Bull Run once the captain lets you in.");
    for (const l of [clubAskLine(true), clubAskLine(false), CLUB_REQUESTS_FULL_MESSAGE]) expect(l).not.toMatch(/—/);
  });
});
