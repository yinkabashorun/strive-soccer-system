import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CAPTAIN_ONLY_MEMBER,
  CAPTAIN_SAME,
  HAND_OVER_ASK_BODY,
  HAND_OVER_CONFIRM,
  HAND_OVER_DETAIL,
  HAND_OVER_ROW,
  HAND_OVER_SHEET_BODY,
  handOverAsk,
  mayBeCaptain,
  nextCaptain,
} from "@/lib/elite/tracker";

const src = (p: string) => readFileSync(p, "utf8");
const code = (p: string) => src(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const between = (s: string, from: string, to: string) => s.slice(s.indexOf(from), s.indexOf(to, s.indexOf(from) + from.length));

// Coach Yinka, Nov 26 2026: "for 3 build c": a club's captaincy can be
// handed to a player, by its captain and by a coach.
describe("who may be made a club's captain", () => {
  const live = { archived_at: null };
  it("only a player who is in that club right now", () => {
    expect(mayBeCaptain(live, ["a", "b"], "b")).toBe(true);
    expect(mayBeCaptain(live, ["a", "b"], "c")).toBe(false);
    expect(mayBeCaptain(live, [], "a")).toBe(false);
    for (const bad of [null, undefined, "", 7, {}]) expect(mayBeCaptain(live, ["a"], bad)).toBe(false);
  });
  it("a club that has ended is handed to nobody", () => {
    expect(mayBeCaptain({ archived_at: "2026-11-26T00:00:00Z" }, ["a", "b"], "b")).toBe(false);
  });
});

describe("the captain hands the club over", () => {
  const actions = code("lib/elite/tracker-actions.ts");
  const fn = between(actions, "export async function makeCaptain", "export async function newClubLink");

  it("only the captain, only to a member, never to themselves", () => {
    expect(fn).toContain("const c = await captainOf(clubId);");
    expect(fn).toContain("if (memberId === c.o.profileId) return fail(CAPTAIN_SAME);");
    expect(fn).toContain("if (!mayBeCaptain(c.club, members, memberId)) return fail(CAPTAIN_ONLY_MEMBER);");
  });
  it("the write is held to 'still captained by me', so two taps hand it over once", () => {
    expect(fn).toMatch(/\.update\(\{ captain_id: memberId \}\)\s*\.eq\("id", clubId\)\s*\.eq\("captain_id", c\.o\.profileId\)/);
  });
  it("nobody is taken off the club by it", () => {
    expect(fn).not.toMatch(/\.delete\(\)|elite_tracker_club_bans|elite_tracker_club_members"\)\s*\.(insert|update|upsert)/);
  });
  it("the app asks its own route, which checks the member's id before anything runs", () => {
    const route = src("app/api/app/free/clubs/[id]/route.ts");
    expect(route).toMatch(/case "captain":\s*if \(typeof body\.member !== "string" \|\| !UUID\.test\(body\.member\)\) return bad\(CAPTAIN_ONLY_MEMBER\);\s*return answer\(await makeCaptain\(id, body\.member\)\);/);
    expect(src("mobile/src/api/clubs.ts")).toContain('post(appClubPath(id), { do: "captain", member })');
  });
  it("the captain's screen asks once, with the player's and the club's name, before it happens", () => {
    const screen = src("mobile/app/club/[id]/manage.tsx");
    expect(screen).toContain("Alert.alert(handOverAsk(m.name, c.name), HAND_OVER_ASK_BODY, [");
    expect(screen).toContain('act("captain", () => makeCaptain(c.id, m.id), () => router.back())');
    expect(screen).toContain("<SettingRow label={HAND_OVER_ROW} detail={HAND_OVER_DETAIL} onPress={handOver} />");
    expect(handOverAsk("Diego R.", "Renegados FC")).toBe("Make Diego R. the captain of Renegados FC?");
  });
});

describe("a coach gives any club a captain", () => {
  const actions = code("lib/elite/tracker-actions.ts");
  const fn = between(actions, "export async function setClubCaptain", "export async function archiveClub");

  it("coaches only, one of the club's own members, and not the captain it already has", () => {
    expect(fn).toContain('if (c.kind === "no") return fail("Only a coach can do this.");');
    expect(fn).toContain("if (club.captain_id === memberId) return fail(CAPTAIN_SAME);");
    expect(fn).toContain("if (!mayBeCaptain(club, members, memberId)) return fail(CAPTAIN_ONLY_MEMBER);");
  });
  it("the coach's club card has the control, and shows a coach-made club's captain once it has one", () => {
    const card = src("components/elite/ClubsAdmin.tsx");
    expect(card).toContain("setClubCaptain(c.id, picked[c.id])");
    expect(card).toContain("c.captain ? `captain ${c.captain}`");
    expect(src("lib/elite/tracker-coach.ts")).toContain("roster: (membersBy.get(c.id) ?? []).map((id) => ({ id, name: nameOrNone(id) })),");
  });
});

describe("a club is never left with players and no captain", () => {
  it("a deleted account hands its clubs over first, both ways an account is deleted", () => {
    const own = code("lib/elite/account-delete.ts");
    expect(own.indexOf("await handOverClubsOf(admin, user.id)")).toBeGreaterThan(-1);
    expect(own.indexOf("await handOverClubsOf(admin, user.id)")).toBeLessThan(own.indexOf("admin.auth.admin.deleteUser(user.id)"));
    const coach = code("lib/elite/coach-actions.ts");
    expect(coach.indexOf("await handOverClubsOf(admin, player.profile_id)")).toBeLessThan(coach.indexOf("admin.auth.admin.deleteUser(player.profile_id)"));
    expect(coach.indexOf("await handOverClubsOf(admin, player.profile_id)")).toBeGreaterThan(-1);
  });
  it("by the same rule as a captain who leaves: the member who has been in longest, or the club ends", () => {
    const server = code("lib/elite/tracker-server.ts");
    const fn = between(server, "export async function handOverClubsOf", "export async function newClub");
    expect(fn).toContain("nextCaptain(await membersOf(admin, club.id), profileId)");
    expect(fn).toContain("next ? { captain_id: next } : { captain_id: null, archived_at: new Date().toISOString() }");
    expect(fn).toContain('.eq("captain_id", profileId)');
    const members = [
      { profile_id: "cap", joined_at: "2026-11-01T00:00:00Z" },
      { profile_id: "second", joined_at: "2026-11-02T00:00:00Z" },
      { profile_id: "third", joined_at: "2026-11-03T00:00:00Z" },
    ];
    expect(nextCaptain(members, "cap")).toBe("second");
    expect(nextCaptain([members[0]], "cap")).toBeNull();
  });
});

describe("the words", () => {
  it("say the whole thing, plainly", () => {
    for (const line of [CAPTAIN_ONLY_MEMBER, CAPTAIN_SAME, HAND_OVER_ROW, HAND_OVER_DETAIL, HAND_OVER_SHEET_BODY, HAND_OVER_ASK_BODY, HAND_OVER_CONFIRM]) {
      expect(line).not.toMatch(/[—–]/);
      expect(line).not.toMatch(/\b(AI|automated|algorithm)\b/i);
    }
    expect(HAND_OVER_SHEET_BODY).toContain("You stay in the club as a player.");
  });
});
