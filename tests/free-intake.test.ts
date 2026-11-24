import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  FREE_INSTEAD,
  FREE_QUESTIONS,
  FREE_STEPS,
  MEMBER_ONLY_STEPS,
  areasPhrase,
  cleanFreeAnswers,
  firstUnansweredFree,
  freeStage,
  freeStepReady,
  memberAnswersFrom,
  mergeOwed,
  owedMemberSteps,
  seasonFromTeam,
  trackerLevel,
  trackerQuizFrom,
  type FreeAnswers,
} from "@/lib/elite/free-intake";
import { ATTRIBUTES, QUIZ_STEPS, attributesWeakestFirst, firstUnanswered, lowestAttributes, quizInput } from "@/lib/elite/quiz";
import { weekPreview } from "@/lib/elite/bank-conform";
import { UPGRADE_CARD_PLACES, UPGRADE_CARD_REST_DAYS, parseDismissedAt, upgradeCard } from "@/lib/elite/upgrade-card";
import { OFFER_GETS, OFFER_LATER, OFFER_LATER_FIRST, OFFER_PRICE, OFFER_PRODUCT, OFFER_START, OFFER_TERMS, offerHeadline } from "@/lib/elite/offer";
import { PRO_APP_RETURN, PRO_PRICE_LINE, PRO_PRODUCT_NAME, proCheckoutParams } from "@/lib/elite/pro";
import { sessionsFor } from "@/lib/elite/training";
import type { Drill } from "@/lib/elite/types";

// The funnel a free account goes through in the iPhone app (Nov 24 2026):
// the same quiz a member takes, the offer named from its own answers, a
// membership started from those answers without asking again, and the one
// quiet upgrade card in the free app. Held here as pure rules.

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

function answers(over: Partial<FreeAnswers> = {}): FreeAnswers {
  return cleanFreeAnswers({
    gender: "boy",
    grade: "high_school",
    position: "Winger",
    foot: "Right",
    level: "Competitive",
    club: "Rovers 2011",
    attrs: Object.fromEntries(ATTRIBUTES.map((x) => [x.id, 4])),
    aim: "higher_team",
    team: "3-4",
    space: "open",
    wall: false,
    goal: false,
    nearbyAnswered: true,
    ...over,
  });
}

describe("the quiz a free account takes", () => {
  it("is the member quiz, screen for screen, with three accounted for", () => {
    // every member screen is asked, asked another way, or left to the membership
    for (const s of QUIZ_STEPS) {
      const asked = FREE_STEPS.some((f) => f.id === s.id);
      const instead = FREE_INSTEAD[s.id];
      const memberOnly = MEMBER_ONLY_STEPS.includes(s.id);
      expect([asked, Boolean(instead), memberOnly].filter(Boolean), s.id).toHaveLength(1);
      if (instead) expect(FREE_STEPS.some((f) => f.id === instead), s.id).toBe(true);
    }
    expect(MEMBER_ONLY_STEPS).toEqual(["parent"]);
    expect(FREE_INSTEAD).toEqual({ age: "grade", goals: "aim" });
    // the same order, the same parts
    expect(FREE_STEPS.map((s) => s.id)).toEqual([
      "gender", "grade", "position", "foot", "level", "club", "onBall", "offBall", "aim", "team", "space", "nearby",
    ]);
    for (const s of FREE_STEPS) expect(FREE_QUESTIONS[s.id].title.length, s.id).toBeGreaterThan(5);
    // the two of its own are the free app's own questions, a tap each
    expect(FREE_QUESTIONS.grade.title).toBe("What grade are you in?");
    expect(FREE_QUESTIONS.aim.title).toBe("What are you working toward?");
    expect(read("components/elite/TrackerQuiz.tsx")).toContain(FREE_QUESTIONS.grade.title);
    expect(read("components/elite/TrackerQuiz.tsx")).toContain(FREE_QUESTIONS.aim.title);
    expect(FREE_STEPS.find((s) => s.id === "grade")?.autoAdvance).toBe(true);
    expect(FREE_STEPS.find((s) => s.id === "aim")?.autoAdvance).toBe(true);
  });

  it("is finished only when every screen is answered", () => {
    expect(firstUnansweredFree(answers())).toBe(-1);
    expect(firstUnansweredFree(cleanFreeAnswers({}))).toBe(0);
    const noGrade = answers();
    delete noGrade.grade;
    expect(FREE_STEPS[firstUnansweredFree(noGrade)].id).toBe("grade");
    expect(freeStepReady("aim", answers({ aim: undefined }))).toBe(false);
    const half = answers();
    delete half.attrs.weak_foot;
    expect(FREE_STEPS[firstUnansweredFree(half)].id).toBe("onBall");
  });

  it("keeps only the quiz's own choices, and nothing a free account is not asked", () => {
    const a = cleanFreeAnswers({
      ...answers(),
      grade: "phd",
      aim: "win",
      age: 15,
      goals: "typed",
      parentName: "Someone",
      parentPhone: "7035550100",
      parentEmail: "p@example.com",
      extra: "x",
      level: "Legend",
    });
    expect(a.grade).toBeUndefined();
    expect(a.aim).toBeUndefined();
    expect(a.age).toBeUndefined();
    expect(a.level).toBeUndefined();
    expect([a.goals, a.parentName, a.parentPhone, a.parentEmail]).toEqual(["", "", "", ""]);
    expect("extra" in a).toBe(false);
  });

  it("gives the free app its own four answers without asking them again", () => {
    expect(trackerQuizFrom(answers())).toEqual({ grade: "high_school", level: "travel", season: "in_season", goal: "higher_team" });
    expect(seasonFromTeam("1-2")).toBe("off_season");
    expect(seasonFromTeam("off")).toBe("off_season");
    expect(seasonFromTeam("5+")).toBe("in_season");
    expect(seasonFromTeam(undefined)).toBeNull();
    expect(trackerLevel("Elite", "high_school")).toBe("elite");
    expect(trackerLevel("Developing", "middle_or_younger")).toBe("rec");
    expect(trackerLevel("Advanced", "high_school")).toBe("travel");
    expect(trackerLevel("Advanced", "college_or_older")).toBe("college");
    expect(trackerLevel(undefined, "high_school")).toBeNull();
    expect(trackerQuizFrom(answers({ team: undefined }))).toBeNull();
  });

  it("where a free account is", () => {
    expect(freeStage({ available: false, hasIntake: true, planned: true })).toBe("web");
    expect(freeStage({ available: true, hasIntake: false, planned: true })).toBe("quiz");
    expect(freeStage({ available: true, hasIntake: true, planned: false })).toBe("offer");
    expect(freeStage({ available: true, hasIntake: true, planned: true })).toBe("ready");
  });
});

describe("a membership started from a free account's answers", () => {
  it("asks only the screens a free account was never shown", () => {
    const m = memberAnswersFrom(answers(), 15);
    expect(owedMemberSteps(m)).toEqual(["parent"]);
    expect(m.age).toBe(15);
    expect(m.goals).toBe("Make a higher team");
    expect("grade" in m || "aim" in m).toBe(false);
    // with no birthday on file, the age is asked too
    expect(owedMemberSteps(memberAnswersFrom(answers(), null))).toEqual(["age", "parent"]);
    // a player older than the age screen goes is not asked their age again
    expect(owedMemberSteps(memberAnswersFrom(answers(), 24))).toEqual(["parent"]);
  });

  it("stores the intake the member quiz would have stored", () => {
    const low = answers();
    low.attrs.weak_foot = 1;
    low.attrs.first_touch = 2;
    const merged = mergeOwed(memberAnswersFrom(low, 16), {
      ...memberAnswersFrom(answers(), null),
      parentName: "Dana Bryant",
      parentPhone: "7035550100",
    });
    expect(firstUnanswered(merged)).toBe(-1);
    const input = quizInput(merged);
    expect(input).toMatchObject({
      age: 16,
      position: "Winger",
      level: "Competitive",
      dominant_foot: "Right",
      gender: "boy",
      goals: ["Make a higher team"],
      weaknesses: ["Weak foot", "First touch"],
      parent_name: "Dana Bryant",
      training_load: "in_season",
      space: "open",
      has_wall: false,
    });
  });

  it("an answer already given cannot be rewritten from the phone", () => {
    const stored = memberAnswersFrom(answers(), 15);
    const merged = mergeOwed(stored, { ...stored, level: "Elite", space: "tight", wall: true, attrs: { weak_foot: 5 }, parentName: "P" });
    expect(merged.level).toBe("Competitive");
    expect(merged.space).toBe("open");
    expect(merged.wall).toBe(false);
    expect(merged.attrs.weak_foot).toBe(4);
    expect(merged.parentName).toBe("P");
  });

  it("the checkout opened from the app comes back to a page that needs no sign-in", () => {
    const site = proCheckoutParams({ profileId: "p", email: "a@example.com", appUrl: "https://thestriveapp.com" });
    const app = proCheckoutParams({ profileId: "p", email: "a@example.com", appUrl: "https://thestriveapp.com", returnTo: "app" });
    expect(site.success_url).toBe("https://thestriveapp.com/onboarding?session_id={CHECKOUT_SESSION_ID}");
    expect(app.success_url).toBe(`https://thestriveapp.com${PRO_APP_RETURN}?session_id={CHECKOUT_SESSION_ID}`);
    expect(app.cancel_url).toBe(`https://thestriveapp.com${PRO_APP_RETURN}`);
    // the same price and the same plan either way
    expect(app.line_items).toEqual(site.line_items);
    expect(app.metadata).toEqual(site.metadata);
    const page = read("app/(public)/pro/done/page.tsx");
    expect(page).not.toMatch(/getViewer|redirect\(/);
    expect(page).toContain("confirmProSession(sessionId)");
    expect(page).not.toMatch(/\$\d|—/);
  });

  it("is one path on the server: one member row, one checkout, the same switch", () => {
    const up = read("lib/elite/free-upgrade-server.ts");
    expect(up).toContain("createProMember(admin, {");
    expect(up).toContain('openProCheckout({ profileId, playerId, email: viewer.profile.email, returnTo: "app" })');
    expect(up).toContain("if (row && !isPro(row.tier)) return");
    // the website's sign-up and checkout use the same two functions
    expect(read("app/api/elite/pro/signup/route.ts")).toContain("createProMember(admin, {");
    expect(read("app/api/elite/pro/checkout/route.ts")).toContain("openProCheckout({");
    const server = read("lib/elite/pro-server.ts");
    expect(server).toContain('subscription_status: "none"');
    expect(server.match(/from\("elite_players"\)\.insert\(/g)).toHaveLength(1);
    // paying is the only thing that switches it on
    expect(up).not.toMatch(/subscription_status: "active"/);
    expect(server).toContain("return await activateProCheckout(await stripe().checkout.sessions.retrieve(sessionId));");
  });

  it("migration 082 only adds, and says what the pointer is", () => {
    const sql = read("supabase/migrations/082_free_quiz_and_upgrade.sql");
    expect(sql.replace(/--.*$/gm, "")).not.toMatch(/\bdrop\b|\bdelete\b|\btruncate\b/i);
    for (const col of ["intake jsonb", "intake_at timestamptz", "upgrade_checkout text"]) {
      expect(sql).toContain(`add column if not exists ${col}`);
    }
    expect(sql).toContain("upgrade_checkout ~ '^cs_[A-Za-z0-9_]{8,200}$'");
    expect(sql).toContain("enable row level security");
    // read best effort, apart from the row 069 made, so a database without
    // the columns never takes a free account away
    expect(read("lib/elite/tracker-server.ts")).not.toMatch(/TRACKER_COLUMNS =[^;]*intake/);
    expect(read("lib/elite/free-intake-server.ts")).toContain('.select("intake, upgrade_checkout")');
  });
});

// ---- The offer ---------------------------------------------------------------

function drill(id: string, pillar: string, over: Partial<Drill> = {}): Drill {
  return {
    id,
    pillar: pillar as Drill["pillar"],
    title: id,
    how: "",
    reps: "",
    minutes: 5,
    cues: "",
    needs_wall: false,
    active: true,
    sort: 100,
    video_url: `https://thestriveapp.com/drills/${id}.mp4`,
    ...over,
  };
}

describe("what the offer says their first week goes after", () => {
  const bank = [
    drill("wf-1", "Weak Foot", { sort: 100 }),
    drill("wf-2", "Weak Foot", { sort: 110 }),
    drill("wf-wall", "Weak Foot", { sort: 90, needs_wall: true }),
    drill("bm-1", "Ball Mastery"),
    drill("bm-manus", "Ball Mastery", { sort: 10, video_url: "https://files.manuscdn.com/x.mp4" }),
    drill("moves-1", "Confidence"),
    drill("juggle", "Ball Mastery", { opt_in: true, sort: 1 }),
    drill("sprint", "Speed", { opt_in: true }),
    drill("plyo", "Plyo"),
    drill("plank", "Strengthening"),
    drill("pass-wall", "Passing", { needs_wall: true }),
    drill("off", "Weak Foot", { active: false, sort: 1 }),
  ];

  it("names the weakest areas the filmed bank can train, in the player's own order", () => {
    const p = weekPreview(bank, ["Speed", "Fitness", "Weak foot", "First touch", "Dribbling and 1v1"], { has_wall: false });
    // speed drills are course drills and fitness has no drills: neither is named
    expect(p.areas).toEqual(["Weak foot", "First touch"]);
    // one from each area in turn; never a wall drill without a wall, a
    // course drill, a warm-up, a finisher, a switched-off drill or a clip
    // with no still on our own domain
    expect(p.drills.map((d) => d.id)).toEqual(["wf-1", "bm-1", "wf-2"]);
  });

  it("follows what the player has: a wall brings the wall drills in", () => {
    const p = weekPreview(bank, ["Short passing", "Weak foot"], { has_wall: true });
    expect(p.areas).toEqual(["Short passing", "Weak foot"]);
    expect(p.drills.map((d) => d.id)).toEqual(["pass-wall", "wf-wall", "wf-1", "wf-2"]);
    expect(weekPreview(bank, ["Short passing"], { has_wall: false }).areas).toEqual([]);
  });

  it("names nothing it cannot show", () => {
    expect(weekPreview([], ["Weak foot"])).toEqual({ areas: [], drills: [] });
    expect(weekPreview(bank, ["Defending", "Strength"]).areas).toEqual([]);
  });

  it("reads the ratings weakest first, by the same order the weaknesses use", () => {
    const attrs = Object.fromEntries(ATTRIBUTES.map((x) => [x.id, 4]));
    attrs.speed = 1;
    attrs.weak_foot = 2;
    attrs.first_touch = 2;
    const order = attributesWeakestFirst(attrs);
    expect(order.slice(0, 3)).toEqual(["Speed", "First touch", "Weak foot"]);
    expect(order).toHaveLength(ATTRIBUTES.length);
    expect(order.slice(0, 3)).toEqual(lowestAttributes(attrs));
  });

  it("says it in their words, and only what is true", () => {
    expect(offerHeadline("Marcus", ["Weak foot", "First touch"])).toBe("Marcus, your first week goes after your weak foot and first touch.");
    expect(offerHeadline("Marcus", ["Dribbling and 1v1"])).toBe("Marcus, your first week goes after your 1v1 dribbling.");
    expect(offerHeadline("", [])).toBe("Your first week is built around what you told us.");
    expect(areasPhrase(["Weak foot", "First touch", "Short passing"])).toBe("your weak foot, first touch and short passing");
    expect(areasPhrase([])).toBeNull();
    // the price and the name each come from one place
    expect(OFFER_PRODUCT).toBe(PRO_PRODUCT_NAME);
    expect(OFFER_START).toBe(`Start ${PRO_PRODUCT_NAME}`);
    expect(OFFER_PRICE).toBe(`${PRO_PRICE_LINE}. Cancel anytime.`);
    expect(OFFER_LATER_FIRST).toBe("Not now, start free");
    expect(OFFER_LATER).toBe("Not now");
    const src = read("lib/elite/offer.ts")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    expect(src).not.toMatch(/\$\d/); // no price written by hand
    const all = [...OFFER_GETS, OFFER_PRICE, OFFER_START, OFFER_TERMS, offerHeadline("A", ["Weak foot"])].join(" ");
    expect(all).not.toMatch(/—|\bAI\b|automated|algorithm|guarantee|spots left|only \d|last chance|hurry|streak/i);
  });
});

// ---- The one upgrade card ------------------------------------------------------

describe("the one upgrade prompt in the free app", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 10, 24);
  const base = { place: "week", member: false, area: "Weak foot", sessions: sessionsFor("in_season"), dismissedAt: null, now };

  it("has one place, and it is the Week tab", () => {
    expect(UPGRADE_CARD_PLACES).toEqual(["week"]);
    expect(upgradeCard(base)).not.toBeNull();
    for (const place of ["friends", "you", "post", "offer", ""]) expect(upgradeCard({ ...base, place }), place).toBeNull();
  });

  it("names their own weakest area and the sessions their answers give", () => {
    expect(upgradeCard(base)).toEqual({
      title: "A week built around your weak foot.",
      line: "Four sessions a week, one drill at a time with the video.",
      action: "See what you get",
      dismiss: "Not now",
    });
    expect(upgradeCard({ ...base, sessions: sessionsFor("off_season") })?.line).toBe("Six sessions a week, one drill at a time with the video.");
    // nothing to name, nothing shown
    expect(upgradeCard({ ...base, area: null })).toBeNull();
    expect(upgradeCard({ ...base, area: "  " })).toBeNull();
    expect(upgradeCard({ ...base, sessions: 0 })).toBeNull();
  });

  it("is never shown to a member", () => {
    expect(upgradeCard({ ...base, member: true })).toBeNull();
  });

  it("stays away for thirty days after Not now", () => {
    expect(UPGRADE_CARD_REST_DAYS).toBe(30);
    expect(upgradeCard({ ...base, dismissedAt: now - 1 })).toBeNull();
    expect(upgradeCard({ ...base, dismissedAt: now - 29 * DAY })).toBeNull();
    expect(upgradeCard({ ...base, dismissedAt: now - 30 * DAY })).not.toBeNull();
    expect(parseDismissedAt(String(now))).toBe(now);
    expect(parseDismissedAt("nonsense")).toBeNull();
    expect(parseDismissedAt(null)).toBeNull();
  });

  it("says nothing the copy rules forbid", () => {
    const c = upgradeCard(base)!;
    expect(Object.values(c).join(" ")).not.toMatch(/—|\bAI\b|automated|algorithm|guarantee|\$\d|streak|missed|ready/i);
  });
});
