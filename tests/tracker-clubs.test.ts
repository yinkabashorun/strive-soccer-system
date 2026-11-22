import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLUB_CAP,
  CLUB_CAP_MESSAGE,
  CLUB_REFUSED,
  CLUBS_PER_PLAYER,
  cleanClubCode,
  cleanClubName,
  clubAskPath,
  clubAskQuestion,
  clubJoinDecision,
  clubLink,
  clubPairs,
  isCaptain,
  mayRemoveMember,
  mayStartClub,
  mayViewProfile,
  nextCaptain,
  type Profile,
} from "@/lib/elite/tracker";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
const fn = (src: string, from: string, to: string) => src.slice(src.indexOf(from), src.indexOf(to, src.indexOf(from) + 1));

// Clubs (migration 069): any free player starts one and is its captain; a
// coach makes the 5v5 ones. Joining a club makes you friends with everyone
// on it. A player's clubs show on their profile.

describe("joining a club", () => {
  it("makes the new player friends with every member, one stored pair each, both ways", () => {
    const pairs = clubPairs("m", ["a", "z", "a", "m"], []);
    expect(pairs).toEqual([
      { a: "a", b: "m" },
      { a: "m", b: "z" },
    ]);
    // the pair is one row the feed and the board already read both ways
    const server = code("lib/elite/tracker-server.ts");
    const join_ = fn(server, "export async function joinClub(", "// ---- Club requests (073)");
    expect(join_).toContain('.from("elite_tracker_friends").upsert(pairs, { onConflict: "a,b", ignoreDuplicates: true })');
  });

  it("never pairs a blocked two, whichever of them blocked", () => {
    const blocks = [{ blocker: "a", blocked: "m" }, { blocker: "m", blocked: "z" }];
    expect(clubPairs("m", ["a", "b", "z"], blocks)).toEqual([{ a: "b", b: "m" }]);
    const server = code("lib/elite/tracker-server.ts");
    const join_ = fn(server, "export async function joinClub(", "// ---- Club requests (073)");
    expect(join_).toContain('.eq("blocker", profileId).in("blocked", some)');
    expect(join_).toContain('.eq("blocked", profileId).in("blocker", some)');
    expect(join_.indexOf("clubPairs(profileId, others, blocks)")).toBeLessThan(join_.indexOf('.from("elite_tracker_friends")'));
  });

  it("three clubs a player, twenty players a club, never an ended club, never twice", () => {
    expect(CLUBS_PER_PLAYER).toBe(3);
    expect(CLUB_CAP).toBe(20);
    const base = { clubId: "c", archived: false, memberCount: 5, myClubIds: ["x", "y"] };
    expect(clubJoinDecision(base)).toBe("ok");
    expect(clubJoinDecision({ ...base, myClubIds: ["x", "y", "w"] })).toBe("too_many");
    expect(clubJoinDecision({ ...base, memberCount: 20 })).toBe("full");
    expect(clubJoinDecision({ ...base, memberCount: 19 })).toBe("ok");
    expect(clubJoinDecision({ ...base, archived: true })).toBe("archived");
    expect(clubJoinDecision({ ...base, myClubIds: ["c"] })).toBe("already");
    expect(CLUB_CAP_MESSAGE).toBe("You're in 3 clubs. Leave one to join another.");
    expect(CLUB_REFUSED.too_many).toBe(CLUB_CAP_MESSAGE);
  });

  it("the cap holds on Start a club too, and the screen says so plainly", () => {
    expect(mayStartClub(0)).toBe(true);
    expect(mayStartClub(2)).toBe(true);
    expect(mayStartClub(3)).toBe(false);
    const acts = code("lib/elite/tracker-actions.ts");
    const start = fn(acts, "export async function startClub(", "export async function leaveClub(");
    expect(start).toContain("if (!mayStartClub((await clubIdsOf(o.admin, o.profileId)).length)) return fail(CLUB_CAP_MESSAGE);");
    // the founder is the captain and the first member
    expect(start).toContain('newClub({ name, kind: "player", captainId: o.profileId, createdBy: o.profileId })');
    expect(start).toContain("await joinClub(o.profileId, club)");
    const section = code("components/elite/ClubsSection.tsx");
    expect(section).toContain("{CLUB_CAP_MESSAGE}");
    expect(section).toMatch(/\{canStart \? \(/);
    // a link at the cap asks nothing; it says why
    expect(code("components/elite/ClubAsk.tsx")).toContain("{asking.problem}");
  });

  it("a race past the member cap is stepped back", () => {
    const server = code("lib/elite/tracker-server.ts");
    expect(server).toContain("if (after.length > CLUB_CAP && !after.slice(0, CLUB_CAP).some((m) => m.profile_id === profileId)) {");
  });
});

describe("links", () => {
  it("one link for a new player and for one already signed in", () => {
    expect(clubLink("https://thestriveapp.com/", "ABCDEFGH")).toBe("https://thestriveapp.com/join?club=ABCDEFGH");
    expect(clubAskPath("ABCDEFGH")).toBe("/log?club=ABCDEFGH");
    expect(clubAskQuestion("Bull Run 2010s")).toBe("Ask to join Bull Run 2010s?");
    expect(cleanClubCode("abcdefgh")).toBe("ABCDEFGH");
    expect(cleanClubCode("'; drop")).toBeNull();
    // new: the club is asked for at sign-up, after the age and the agreement (073)
    const route = code("app/api/elite/auth/join/route.ts");
    expect(route).toContain("if (club) await requestClubByCode(userId, club)");
    expect(route).not.toContain("joinClubByCode");
    expect(route.indexOf("oldEnough(birth, today)")).toBeLessThan(route.indexOf("requestClubByCode("));
    expect(route.indexOf("agreementComplete(")).toBeLessThan(route.indexOf("requestClubByCode("));
    expect(code("components/elite/JoinForm.tsx")).toMatch(/ref: referral,\s*club,/);
    // signed in: one sheet on the Friends tab
    expect(code("app/(join)/join/page.tsx")).toContain("if (club && (await trackerFor(viewer))) redirect(clubAskPath(club));");
    expect(code("app/(free)/log/page.tsx")).toContain("clubAskFor(viewer, cleanClubCode(searchParams?.club))");
    expect(code("components/elite/ClubAsk.tsx")).toContain("await confirmClub(code)");
  });

  it("clubs are found by link only: no list, no search, no ranking between clubs", () => {
    for (const f of ["components/elite/ClubsSection.tsx", "components/elite/ClubAsk.tsx", "lib/elite/tracker-server.ts"]) {
      expect(code(f), f).not.toMatch(/search|ilike|allClubs|clubBoard/i);
    }
    // every club read a player can reach is by its code, its id, or the player's own memberships
    const server = code("lib/elite/tracker-server.ts");
    for (const m of server.matchAll(/\.from\("elite_tracker_clubs"\)\.select\(CLUB_COLUMNS\)([\s\S]{0,40})/g)) {
      expect(m[1]).toMatch(/^\.eq\("(join_code|id)", /);
    }
    for (const m of server.matchAll(/\.from\("elite_tracker_club_members"\)\s*\.select\([^)]*\)([\s\S]{0,30})/g)) {
      expect(m[1]).toMatch(/^\s*\.eq\("(profile_id|club_id)", /);
    }
  });
});

describe("names", () => {
  it("plain text, 40 characters, no links", () => {
    expect(cleanClubName("  Bull   Run 2010s ")).toBe("Bull Run 2010s");
    expect(cleanClubName("")).toBeNull();
    expect(cleanClubName("x".repeat(41))).toBeNull();
    for (const bad of ["www.free.com", "go to http://x", "join.gg/abc", "dm @someone", "site.net"]) {
      expect(cleanClubName(bad), bad).toBeNull();
    }
    expect(cleanClubName("Strive Elite 5v5: Team 7")).toBe("Strive Elite 5v5: Team 7");
    expect(read("supabase/migrations/069_free_training_log.sql")).toContain("check (char_length(name) between 1 and 40)");
  });
});

describe("the captain", () => {
  const club = { captain_id: "cap", archived_at: null };

  it("renames, takes a member off and ends the club; nobody else does", () => {
    expect(isCaptain(club, "cap")).toBe(true);
    expect(isCaptain(club, "m")).toBe(false);
    expect(isCaptain({ captain_id: null, archived_at: null }, "cap")).toBe(false); // a coach's club
    expect(isCaptain({ captain_id: "cap", archived_at: "2026-11-20" }, "cap")).toBe(false); // ended
    expect(mayRemoveMember(club, "cap", "m")).toBe(true);
    expect(mayRemoveMember(club, "cap", "cap")).toBe(false);
    expect(mayRemoveMember(club, "m", "x")).toBe(false);
    const acts = code("lib/elite/tracker-actions.ts");
    const cap = fn(acts, "async function captainOf(", "export async function renameMyClub(");
    expect(cap).toContain('if (!isCaptain(club, o.profileId)) return fail("Only the club\'s captain can do that.");');
    for (const name of ["renameMyClub", "removeClubMember", "endMyClub"]) {
      const body = fn(acts, `export async function ${name}(`, "export async function");
      expect(body, name).toContain("await captainOf(clubId)");
    }
  });

  it("a captain who leaves hands the club to the longest-standing member; nobody left, the club ends", () => {
    const members = [
      { profile_id: "cap", joined_at: "2026-11-01T00:00:00Z" },
      { profile_id: "b", joined_at: "2026-11-03T00:00:00Z" },
      { profile_id: "a", joined_at: "2026-11-02T00:00:00Z" },
    ];
    expect(nextCaptain(members, "cap")).toBe("a");
    expect(nextCaptain([members[0]], "cap")).toBeNull();
    const acts = code("lib/elite/tracker-actions.ts");
    const leave = fn(acts, "export async function leaveClub(", "async function captainOf(");
    expect(leave).toContain("next ? { captain_id: next } : { captain_id: null, archived_at: new Date().toISOString() }");
  });
});

describe("leaving keeps friendships", () => {
  it("leaving, being taken off and ending a club never touch a friendship", () => {
    const acts = code("lib/elite/tracker-actions.ts");
    for (const name of ["leaveClub", "removeClubMember", "endMyClub", "archiveClub"]) {
      const body = fn(acts, `export async function ${name}(`, "export async function");
      expect(body, name).not.toContain("elite_tracker_friends");
    }
    expect(code("components/elite/ClubScreen.tsx")).toContain("Leaving keeps the friends you made. To cut one off, block them.");
  });
});

describe("reporting a club's name", () => {
  it("a member who is not the captain reports it; the coaches hear once a club; it lands in the coach queue", () => {
    const acts = code("lib/elite/tracker-actions.ts");
    const rep = fn(acts, "export async function reportClub(", "export async function setPlayingFor(");
    expect(rep).toContain("if (!members.some((m) => m.profile_id === o.profileId) || club.captain_id === o.profileId) return fail(NOT_A_CLUB);");
    expect(rep).toContain('onConflict: "club_id,reporter_id", ignoreDuplicates: true');
    expect(rep).toContain("if (!count) await textCoaches(clubReportText(club.name,");
    expect(read("supabase/migrations/069_free_training_log.sql")).toContain("unique (club_id, reporter_id)");
    // the coach renames, archives or says no action, and each closes the reports
    for (const [name, action] of [
      ["renameClub", "renamed"],
      ["archiveClub", "archived"],
      ["dismissClubReports", "none"],
    ]) {
      const body = fn(acts, `export async function ${name}(`, "export async function");
      expect(body, name).toContain(`closeClubReports(c, clubId, "${action}")`);
      expect(body, name).toContain('if (c.kind === "no") return fail("Only a coach can do this.");');
    }
    const admin = code("components/elite/ClubsAdmin.tsx");
    expect(admin).toContain("Reported club names");
    expect(code("app/(coach)/coach/free/page.tsx")).toContain("<ClubsAdmin clubs={data.clubs} reports={data.clubReports} appUrl={APP_URL} />");
    expect(code("components/elite/ClubScreen.tsx")).toContain("Report this club");
  });
});

describe("rosters: only members and coaches", () => {
  it("in the database", () => {
    const sql = read("supabase/migrations/069_free_training_log.sql");
    expect(sql).toContain("for select using (public.elite_is_club_member(id));");
    expect(sql).toContain("for select using (public.elite_is_club_member(club_id));");
    expect(sql).toContain("where club_id = p_club and profile_id = auth.uid()");
    expect((sql.match(/on public\.elite_tracker_club(s|_members)\s+for select using \(public\.elite_is_coach\(\)\);/g) ?? []).length).toBe(2);
  });

  it("on the screen: a player only ever reads their own clubs' rosters", () => {
    const server = code("lib/elite/tracker-server.ts");
    const mine = fn(server, "export async function myClubsFor(", "export async function profileFor(");
    expect(mine).toContain("const ids = await clubIdsOf(admin, me.id);");
    expect(mine).toContain("for (const id of ids) {");
  });
});

describe("the profile", () => {
  const base = { viewerId: "me", staff: false, targetId: "f", friendIds: new Set(["f"]), blocks: [] };

  it("a friend yes, a non-friend no, a coach yes, yourself yes, a block no", () => {
    expect(mayViewProfile(base)).toBe(true);
    expect(mayViewProfile({ ...base, friendIds: new Set() })).toBe(false);
    expect(mayViewProfile({ ...base, friendIds: new Set(), staff: true })).toBe(true);
    expect(mayViewProfile({ ...base, targetId: "me", friendIds: new Set() })).toBe(true);
    expect(mayViewProfile({ ...base, blocks: [{ blocker: "f", blocked: "me" }] })).toBe(false);
    expect(mayViewProfile({ ...base, blocks: [{ blocker: "me", blocked: "f" }] })).toBe(false);
  });

  it("the server asks before it reads anything, and a non-friend gets nothing back", () => {
    const server = code("lib/elite/tracker-server.ts");
    const prof = fn(server, "export async function profileFor(", "\n}\n");
    const ask = prof.indexOf(
      "if (!mayViewProfile({ viewerId: meId, staff, targetId, friendIds: you ? new Set() : friendIds, blocks })) return null;"
    );
    expect(ask).toBeGreaterThan(-1);
    expect(ask).toBeLessThan(prof.indexOf("namesOf(admin, [targetId])"));
    expect(ask).toBeLessThan(prof.indexOf("avatarsOf(admin, [targetId])"));
    // the profile screen reads it through the same function, and a non-friend lands on "not there"
    const page = code("app/(free)/log/u/[id]/page.tsx");
    expect(page).toContain("profileFor(viewer, id, today)");
    expect(page).toContain("if (!profile) notFound();");
  });

  it("is small: photo, name, clubs, this week and all time, aura level, the level they play at, their line, the star, posts they may see. No bio, counts, age or grade", () => {
    const keys: (keyof Profile)[] = [
      "id",
      "name",
      "initials",
      "photo",
      "clubs",
      "weekMinutes",
      "allMinutes",
      "you",
      "friend",
      "posts",
      "week",
      "propsPost",
      "aura",
      "levelName",
      "playingFor",
      "starred",
    ];
    const sample: Profile = {
      id: "f",
      name: "Gary G.",
      initials: "GG",
      photo: null,
      clubs: [],
      weekMinutes: 0,
      allMinutes: 0,
      you: false,
      friend: true,
      posts: [],
      week: [],
      propsPost: null,
      aura: { level: 1, progress: 0, toNext: 100 },
      levelName: null,
      playingFor: null,
      starred: false,
    };
    expect(Object.keys(sample).sort()).toEqual([...keys].sort());
    const screen = code("components/elite/ProfileScreen.tsx");
    expect(screen).not.toMatch(/grade|birth|age\b|follower|bio|points/i);
    // it opens from a face, a post's name, a name on the board, and your own avatar
    expect(code("components/elite/FriendsFeed.tsx")).toContain("onClick={() => profile(f.id)}");
    expect(code("components/elite/FriendsFeed.tsx")).toContain("onClick={() => profile(card.ownerId)}");
    expect(code("components/elite/FriendsFeed.tsx")).toContain("onOpen={() => profile(me.id)}");
    expect(code("components/elite/FriendsBoard.tsx")).toContain("onClick={() => profile(r.id)}");
    expect(code("components/elite/MyWeek.tsx")).toContain("onClick={() => profile(me.id)}");
  });
});

describe("the word", () => {
  it('"team" in the free app only ever means a real soccer team', () => {
    const files = [
      "components/elite/ClubsSection.tsx",
      "components/elite/ClubAsk.tsx",
      "components/elite/ProfileScreen.tsx",
      "components/elite/ClubScreen.tsx",
      "components/elite/JoinLanding.tsx",
      "components/elite/ClubsAdmin.tsx",
      "components/elite/FriendsFeed.tsx",
      "components/elite/MyWeek.tsx",
      "components/elite/FriendsBoard.tsx",
      "components/elite/TrackerQuiz.tsx",
      "components/elite/JoinForm.tsx",
      "lib/elite/tracker.ts",
      "lib/elite/tracker-actions.ts",
      "lib/elite/tracker-server.ts",
      "lib/elite/tracker-demo.ts",
      "app/(free)/log/week/page.tsx",
      // clubs as teams (077): the screens say "club", never "team"
      "components/elite/PlanForm.tsx",
      "components/elite/PlanDetail.tsx",
      "components/elite/PlanCardView.tsx",
      "components/elite/TeamRequests.tsx",
      "components/elite/EventEntry.tsx",
      "components/elite/CountySheet.tsx",
      "app/(free)/log/events/page.tsx",
      "app/(free)/log/club/[id]/near/page.tsx",
    ];
    // "club-teams" is a file's name (lib/elite/club-teams.ts), not a word on
    // a screen.
    const real =
      /team training|town team|club team|school team|College team|tournament team|higher team|for my team|What team do you play for|5v5: Team \d|club-teams/i;
    for (const f of files) {
      const src = code(f);
      for (const m of src.matchAll(/\bteams?\b/gi)) {
        const around = src.slice(Math.max(0, m.index! - 30), m.index! + 30).replace(/\s+/g, " ");
        expect(around, `${f}: ${around}`).toMatch(real);
      }
    }
  });
});
