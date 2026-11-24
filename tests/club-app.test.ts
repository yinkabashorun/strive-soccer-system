import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  CLUB_CODE_MESSAGE,
  clubBoard,
  clubCodeFrom,
  clubShareText,
  clubWeek,
  clubWeeks,
  clubWeeksSince,
  nextLine,
  planDays,
  splitPlans,
  trainedToday,
  type ClubLog,
} from "@/lib/elite/club-app";
import {
  PLAN_TIMES,
  PLAN_TIME_DEFAULT,
  gamesRecordLine,
  planDayAt,
  planLabel,
  planScore,
  planSides,
  planWhat,
  timeLabel,
  type PlanCard,
} from "@/lib/elite/club-teams";
import { clubPlanReceivers } from "@/lib/elite/free-notices";
import { clubPlanPush, pushTextProblems } from "@/lib/elite/push-texts";
import { friendsBoard, type MyClub } from "@/lib/elite/tracker";

// Clubs in the native iPhone app (Nov 24 2026). The owner: "What happened
// to clubs? That needs to be put together in an extremely creatively
// practical and sticky way." Held here: the few rules the app's club
// screens add (joining by code, who trained today, this week next to the
// best week, the ranked members), that every other rule is the website's
// own, the one notification, and that nothing counts what was missed.

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

const TODAY = "2026-11-24"; // a Tuesday
type Member = MyClub["members"][number];
const member = (id: string, name: string, over: Partial<Member> = {}): Member => ({ id, name, captain: false, you: false, minutes: 0, lastDay: null, photo: null, ...over });
const MEMBERS: Member[] = [
  member("me", "Marcus B.", { you: true, minutes: 120, lastDay: "2026-11-23", photo: "me.jpg" }),
  member("d", "Diego R.", { captain: true, minutes: 195, lastDay: TODAY, photo: "d.jpg", starred: true }),
  member("n", "Nico A.", { minutes: 120, lastDay: TODAY }),
  member("j", "Jalen T.", { minutes: 0, lastDay: null }),
  member("k", "Kai M.", { minutes: 0, lastDay: "2026-11-10" }),
];

describe("joining by code", () => {
  it("takes the code alone, however it was typed", () => {
    expect(clubCodeFrom("ABCD2345")).toBe("ABCD2345");
    expect(clubCodeFrom("  abcd2345 ")).toBe("ABCD2345");
  });
  it("takes a whole pasted link, or the whole message a teammate sent", () => {
    expect(clubCodeFrom("https://thestriveapp.com/join?club=ABCD2345")).toBe("ABCD2345");
    expect(clubCodeFrom("https://thestriveapp.com/join?src=ig&club=abcd2345")).toBe("ABCD2345");
    const text = clubShareText({ name: "Renegados FC", code: "ABCD2345", appUrl: "https://thestriveapp.com/" });
    expect(clubCodeFrom(text)).toBe("ABCD2345");
  });
  it("is nobody's code otherwise", () => {
    for (const bad of ["", "ABCD234", "ABCD23456", "ABCD0O1I", "https://thestriveapp.com/join?ref=ABCD2345", null, 42, "club=../../x"]) {
      expect(clubCodeFrom(bad), String(bad)).toBeNull();
    }
    expect(CLUB_CODE_MESSAGE).toMatch(/captain/);
  });
  it("the share sheet sends the link AND the code", () => {
    expect(clubShareText({ name: "Renegados FC", code: "ABCD2345", appUrl: "https://thestriveapp.com" })).toBe(
      "Join Renegados FC on Strive Elite.\nClub code: ABCD2345\nhttps://thestriveapp.com/join?club=ABCD2345"
    );
  });
  it("asks; the captain lets them in (073)", () => {
    const server = code("lib/elite/club-app-server.ts");
    const ask = server.slice(server.indexOf("export async function askToJoinByCode"));
    expect(ask).toContain("await confirmClub(code)");
    // nothing in the app's reader ever puts a player on a club
    expect(server).not.toMatch(/joinClub\(|elite_tracker_club_members/);
    expect(code("app/api/app/free/clubs/join/route.ts")).toContain("clubCodeFrom(body?.code)");
  });
});

describe("who trained today", () => {
  it("is the members who logged anything today, you first, and nobody else", () => {
    const faces = trainedToday(MEMBERS, TODAY);
    expect(faces.map((f) => f.first)).toEqual(["Diego", "Nico"]);
    const withMe = trainedToday([{ ...MEMBERS[0], lastDay: TODAY }, ...MEMBERS.slice(1)], TODAY);
    expect(withMe.map((f) => [f.first, f.you])).toEqual([["You", true], ["Diego", false], ["Nico", false]]);
    expect(withMe[0].photo).toBe("me.jpg");
    expect(faces[0]).toEqual({ id: "d", first: "Diego", initials: "DR", photo: "d.jpg", you: false });
  });
  it("a club where nobody has trained yet today has an empty row, not a list of names", () => {
    expect(trainedToday(MEMBERS, "2026-11-25")).toEqual([]);
  });
});

describe("the members, ranked by this week's training", () => {
  const rows = clubBoard(MEMBERS, TODAY);
  it("orders them as the friends board does: most first, one place each", () => {
    expect(rows.slice(0, 3).map((r) => [r.place, r.name, r.time])).toEqual([
      [1, "Diego R.", "3h 15m"],
      [2, "Marcus B.", "2h"],
      [3, "Nico A.", "2h"],
    ]);
    // the same rule, not a second one
    expect(code("lib/elite/club-app.ts")).toContain("friendsBoard(");
    expect(friendsBoard([{ id: "x", name: "A", minutes: 5 }], "x", 20)).toHaveLength(1);
  });
  it("a member with nothing yet this week is listed with no place and no time", () => {
    expect(rows.slice(3).map((r) => [r.place, r.time, r.name])).toEqual([
      [null, null, "Jalen T."],
      [null, null, "Kai M."],
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/"0m"/);
  });
  it("marks the captain, the coach's star, you, and who trained today", () => {
    const d = rows.find((r) => r.id === "d")!;
    expect(d).toMatchObject({ captain: true, starred: true, today: true, photo: "d.jpg", initials: "DR" });
    expect(rows.find((r) => r.id === "me")).toMatchObject({ you: true, today: false });
  });
  it("lists a whole club of twenty", () => {
    const twenty = Array.from({ length: 20 }, (_, i) => member(`m${i}`, `Player ${String.fromCharCode(65 + i)}.`, { minutes: 10 + i }));
    expect(clubBoard(twenty, TODAY).filter((r) => r.place !== null)).toHaveLength(20);
  });
});

describe("this week and the best week", () => {
  const log = (profile_id: string, trained_on: string, minutes: number, kind: ClubLog["kind"] = "training"): ClubLog => ({ profile_id, trained_on, minutes, kind });
  const members = [
    { id: "a", joinedOn: "2026-11-02" },
    { id: "b", joinedOn: "2026-11-18" }, // joined in the week of Nov 16
  ];
  const logs = [
    log("a", "2026-11-03", 300),
    log("a", "2026-11-10", 500),
    log("b", "2026-11-10", 900), // before b joined: never the club's
    log("a", "2026-11-17", 200),
    log("b", "2026-11-16", 100), // the Monday of the week b joined counts
    log("a", "2026-11-23", 240),
    log("b", "2026-11-24", 60),
    log("a", "2026-11-24", 600, "gym"), // gym never counts
    log("c", "2026-11-24", 999), // not on the club
  ];

  it("are real sums from the members' logs, training only", () => {
    expect(clubWeeks({ logs, members, today: TODAY })).toEqual({ minutes: 300, best: 500 });
    expect(clubWeeksSince("2026-11-04")).toBe("2026-11-02");
  });
  it("a new member's weeks before they joined never become the club's", () => {
    const { best } = clubWeeks({ logs, members, today: TODAY });
    expect(best).toBe(500); // not 1,400
  });
  it("a club in its first week has no best week yet", () => {
    expect(clubWeeks({ logs: [log("a", TODAY, 45)], members, today: TODAY })).toEqual({ minutes: 45, best: null });
    expect(clubWeek({ minutes: 45, best: null })).toEqual({ minutes: 45, time: "45m", bestLine: null, record: false });
  });
  it("says the best week as a number to beat, and never that a club is behind", () => {
    expect(clubWeek({ minutes: 840, best: 1140 })).toMatchObject({ time: "14h", bestLine: "Best week 19h.", record: false });
    const beaten = clubWeek({ minutes: 1200, best: 1140 });
    expect(beaten).toMatchObject({ time: "20h", record: true });
    expect(beaten.bestLine).toBe("Your club's best week yet. The one before was 19h.");
    for (const w of [clubWeek({ minutes: 0, best: 1140 }), clubWeek({ minutes: 1140, best: 1140 }), beaten]) {
      expect(w.bestLine ?? "").not.toMatch(/behind|missed|short|only|to go|left/i);
    }
  });
});

const card = (over: Partial<PlanCard> = {}): PlanCard => ({
  id: "p1",
  kind: "training",
  title: null,
  organizer: { id: "c1", name: "Renegados FC" },
  opponent: null,
  when: "Tue, Nov 24, 6:00 PM",
  minutes: 60,
  place: "Braemar Park, Bristow",
  status: "on",
  started: false,
  ins: 0,
  names: [],
  imIn: false,
  canJoin: true,
  canCancel: false,
  canAnswer: false,
  result: null,
  ...over,
});

describe("what is next", () => {
  const game = card({ id: "g1", kind: "game", opponent: { id: "c2", name: "Sunday Pickup" } });
  it("one line for a club's card", () => {
    expect(nextLine(card(), "c1")).toBe("Club training · Tue, Nov 24, 6:00 PM");
    expect(nextLine(card({ title: "Finishing night" }), "c1")).toBe("Finishing night · Tue, Nov 24, 6:00 PM");
    expect(nextLine(game, "c1")).toBe("Game against Sunday Pickup · Tue, Nov 24, 6:00 PM");
    expect(nextLine(game, "c2")).toBe("Game against Renegados FC · Tue, Nov 24, 6:00 PM");
  });
  it("coming up apart from games that have started; a request nobody answered in time is in neither", () => {
    const final = card({ id: "g2", kind: "game", started: true, opponent: game.opponent, result: { state: "confirmed", score: [3, 1], line: "Final.", canEnter: false, canAnswer: false } });
    const stale = card({ id: "g3", kind: "game", status: "pending", started: true, opponent: game.opponent });
    const waiting = card({ id: "g4", kind: "game", status: "pending", opponent: game.opponent });
    const split = splitPlans([card(), final, stale, waiting]);
    expect(split.next.map((p) => p.id)).toEqual(["p1", "g4"]);
    expect(split.results.map((p) => p.id)).toEqual(["g2"]);
  });
  it("the label, the sides and the score are one rule for the website and the app", () => {
    expect(planLabel(card())).toBe("Club training · Members only");
    expect(planLabel(card({ kind: "game", status: "pending" }))).toBe("Game · Waiting on their captain");
    expect(planSides(game, "c2")).toEqual({ ours: game.opponent, theirs: game.organizer });
    const scored = { ...game, result: { state: "confirmed" as const, score: [3, 1] as [number, number], line: null, canEnter: false, canAnswer: false } };
    expect(planScore(scored, "c1")).toEqual([3, 1]);
    expect(planScore(scored, "c2")).toEqual([1, 3]);
    const web = code("components/elite/PlanCardView.tsx");
    expect(web).toContain("planLabel(card)");
    expect(web).toContain("planSides(card, perspective)");
    expect(code("components/elite/PlanForm.tsx")).toContain("PLAN_TIMES.map(");
  });
  it("a captain picks a day from the next two weeks and a time on the half hour", () => {
    expect(planDays(TODAY).slice(0, 2)).toEqual([TODAY, "2026-11-25"]);
    expect(planDays(TODAY)).toHaveLength(14);
    expect(PLAN_TIMES[0]).toBe("06:00");
    expect(PLAN_TIMES[PLAN_TIMES.length - 1]).toBe("21:30");
    expect(PLAN_TIMES).toContain(PLAN_TIME_DEFAULT);
    expect([timeLabel("06:00"), timeLabel("12:30"), timeLabel("18:00"), timeLabel("00:00")]).toEqual(["6:00 AM", "12:30 PM", "6:00 PM", "12:00 AM"]);
  });
  it("the games record is its own plain line", () => {
    expect(gamesRecordLine({ wins: 4, losses: 1, draws: 0, played: 5 })).toBe("Games won: 4. Games lost: 1. Draws: 0.");
  });
});

describe("the one notification that pulls a club together", () => {
  const members = [
    { club_id: "c1", profile_id: "cap" },
    { club_id: "c1", profile_id: "a" },
    { club_id: "c1", profile_id: "b" },
    { club_id: "c2", profile_id: "b" }, // on both clubs
    { club_id: "c2", profile_id: "x" },
    { club_id: "c2", profile_id: "y" },
  ];
  const withDevice = new Set(["cap", "a", "b", "x"]);

  it("goes to the members of the club(s) in it with notifications on, once each, never to who planned it", () => {
    expect(clubPlanReceivers({ clubIds: ["c1"], members, byId: "cap", withDevice })).toEqual([
      { profileId: "a", clubId: "c1" },
      { profileId: "b", clubId: "c1" },
    ]);
    // a game: both clubs; a player on both hears once, for the organizing club
    expect(clubPlanReceivers({ clubIds: ["c1", "c2"], members, byId: "x", withDevice })).toEqual([
      { profileId: "cap", clubId: "c1" },
      { profileId: "a", clubId: "c1" },
      { profileId: "b", clubId: "c1" },
    ]);
  });

  it("says what, when, and one thing to tap", () => {
    const when = planDayAt("2026-11-24T23:00:00.000Z");
    expect(when).toBe("Tue, Nov 24 at 6:00 PM");
    const training = clubPlanPush({ club: "Renegados FC", clubId: "c1", what: planWhat({ kind: "training", title: null }, null), when });
    expect(training).toEqual({ title: "Renegados FC", body: "Club training Tue, Nov 24 at 6:00 PM. Tap I'm in.", url: "/log/club/c1" });
    const game = clubPlanPush({ club: "Renegados FC", clubId: "c1", what: planWhat({ kind: "game", title: null }, "Sunday Pickup"), when });
    expect(game.body).toBe("Game against Sunday Pickup Tue, Nov 24 at 6:00 PM. Tap I'm in.");
    for (const t of [training, game]) expect(pushTextProblems(t)).toEqual([]);
    // the place is never on a lock screen
    const texts = code("lib/elite/push-texts.ts");
    const fn = texts.slice(texts.indexOf("export function clubPlanPush"));
    expect(fn.slice(0, fn.indexOf("\n}\n"))).not.toMatch(/place/);
  });

  it("is claimed first, once per plan and player, in its own ledger (084)", () => {
    const src = code("lib/elite/free-notices-server.ts");
    const fn = src.slice(src.indexOf("export async function noticeClubPlan"));
    expect(fn.indexOf("claimPlan(admin, plan.id, r.profileId)")).toBeGreaterThan(-1);
    expect(fn.indexOf("claimPlan(admin, plan.id, r.profileId)")).toBeLessThan(fn.indexOf("sendPushToProfile(r.profileId, text)"));
    expect(fn).toContain("if (!maySend(await claimPlan(admin, plan.id, r.profileId))) continue;");
    expect(fn).toContain('.from("elite_plan_notices").insert({ plan_id: planId, profile_id: profileId })');
    // inside the free app's quiet hours, and only to a phone left on
    expect(fn).toContain("const admin = ready();");
    expect(fn).toContain("withDevices(admin,");
    // only for a plan that is on and has not started
    expect(fn).toContain('plan.status !== "on"');
    const sql = read("supabase/migrations/084_club_plan_notices.sql");
    expect(sql).toContain("primary key (plan_id, profile_id)");
    expect(sql).toContain("enable row level security");
    expect(sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n")).not.toMatch(/\bdrop\b/i);
  });

  it("is sent from exactly two places: a session planned, and a game accepted", () => {
    const actions = code("lib/elite/club-teams-actions.ts");
    expect(actions.match(/noticeClubPlan\(/g)).toHaveLength(2);
    expect(actions).toContain("await noticeClubPlan({ planId: data.id as string, byId: p.profileId }).catch(() => 0);");
    expect(actions).toContain("if (accept === true) await noticeClubPlan({ planId: plan.id, byId: p.profileId }).catch(() => 0);");
    // a game that is only sent (still waiting on the other captain) tells nobody
    const planGame = actions.slice(actions.indexOf("export async function planGame"), actions.indexOf("export async function answerGame"));
    expect(planGame).not.toContain("noticeClubPlan");
    // and it is the only new notification: three profile pushes in all
    expect((code("lib/elite/free-notices-server.ts").match(/sendPushToProfile\(/g) ?? []).length).toBe(3);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("the app's club routes use the website's rules, never their own", () => {
  const routes = [...walk(join(root, "app/api/app/free/clubs")), ...walk(join(root, "app/api/app/free/plans")), join(root, "app/api/app/free/play-terms/route.ts")];
  const src = (f: string) => readFileSync(f, "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

  it("every one is a bearer route for an account in the free app, and touches no table itself", () => {
    expect(routes.length).toBe(7);
    for (const f of routes) {
      expect(src(f), f).toMatch(/appRoute\(\{ name: "free-[a-z-]+", access: "free_app"/);
      expect(src(f), f).not.toMatch(/createServiceClient|\.from\(|supabase/);
      expect(src(f), f).toContain('export const dynamic = "force-dynamic";');
    }
  });

  it("a club's page is read only for one of its own members", () => {
    const server = code("lib/elite/club-app-server.ts");
    const page = server.slice(server.indexOf("export async function appClubPageFor"), server.indexOf("export async function appClubNearFor"));
    expect(page).toContain("const club = (await myClubsFor(viewer, today)).find((c) => c.id === clubId);");
    expect(page.indexOf("if (!club) return null;")).toBeLessThan(page.indexOf("clubTeamFor("));
    expect(code("app/api/app/free/clubs/[id]/route.ts")).toContain("return page ? { club: page } : appJson(NOT_FOUND, 404);");
  });

  it("this week's photos follow the feed's own lock: a locked post carries no photo of it", () => {
    const server = code("lib/elite/club-app-server.ts");
    const photos = server.slice(server.indexOf("async function clubPhotosFor"), server.indexOf("export async function appClubPageFor"));
    expect(photos).toContain("buildFeed({");
    expect(photos).toContain("unlocked: postedPhotoToday(rows, me, today)");
    // only open cards are ever signed
    expect(photos).toMatch(/signPhotos\(\s*admin,\s*cards\.filter\(\(c\): c is OpenCard => c\.state === "open"\)/);
    const locked = photos.slice(photos.indexOf('if (c.state === "locked")'), photos.indexOf("const photoUrl"));
    expect(locked).not.toMatch(/photoUrl|photoPath|caption/);
    expect(locked).toContain("avatar.get(c.ownerId)"); // the teammate's profile photo, never the post's
  });

  it("the place, the captain's tools and the sheets are the website's own actions", () => {
    const plan = code("app/api/app/free/plans/route.ts");
    expect(plan).toContain("planTraining(body.club, input)");
    expect(plan).toContain("planGame(body.club, body.opponent, input)");
    // an address is refused where the website refuses it
    expect(code("lib/elite/club-teams-actions.ts")).toContain("const place = cleanPlace(input.place);");
    const one = code("app/api/app/free/plans/[id]/route.ts");
    for (const call of ["setImIn(id, true)", "answerGame(id, true)", "cancelPlan(id)", "enterScore(id, body.club, body.opponent)", "answerScore(id, false)", "reportPlan(id, reason)"]) {
      expect(one, call).toContain(call);
    }
    const club = code("app/api/app/free/clubs/[id]/route.ts");
    for (const call of ["leaveClub(id)", "reportClub(id)", "renameMyClub(id, body.name)", "removeClubMember(id, body.member)", "newClubLink(id)", "setClubCounty(id, county, body.open)", "endMyClub(id)", "answerClubRequest(id, body.player, body.accept)"]) {
      expect(club, call).toContain(call);
    }
    expect(code("app/api/app/free/play-terms/route.ts")).toContain("acceptPlayTerms(body.kind)");
  });

  it("starting a club records the captain's organizer acceptance first, the website's way", () => {
    const server = code("lib/elite/club-app-server.ts");
    const start = server.slice(server.indexOf("export async function startClubInApp"), server.indexOf("export async function askToJoinByCode"));
    expect(start.indexOf("playAcceptancesOf(admin, viewer.profile.id)")).toBeLessThan(start.indexOf("await startClub(name)"));
    expect(start).toContain('needs: "organizer"');
    expect(start).toContain("setClubCounty(started.id, county, false)");
  });
});
