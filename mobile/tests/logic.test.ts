import { BAR_MIN, barShare, inviteShare, matchupSplit, passedFriend, recordShort, SESSION_FALLBACK_MINUTES, sessionMinutes, sessionsToBeat, standingLine, standingSaid } from "@/social-view";
import { describe, expect, it } from "vitest";
import { chunkedStorage, CHUNK_SIZE, MAX_CHUNKS, parseCount, splitValue, type KV } from "@/auth/chunks";
import { applyDone } from "@/week-cache";
import { overlay, outcomeOf, parseTicks, queueTick, REFUSED_LINE, retryDelayMs, settle, UNSENT_LINE, type Tick } from "@/outbox-core";
import { LOCAL_CLOCK, ONE_APP_ROUTE, hasFreeApp, areaFor, areaHome, hasTrain, homeOf, inArea, localRoute, pushRoute, tappedNotice } from "@/navigation";
import { doorDue, quizWasLater } from "@/door";
import { doorCodeFrom, friendShareText } from "@shared/free-door";
import { clockNudgeAt } from "@shared/training-clock";
import { clipOrder, clipsInView, liveClip, pickedAfterScroll, pickedAfterTap } from "@/course-view";
import { drillEyebrow, repsTiles } from "@/drill-view";
import { APP_TABS, oneAppTabBar } from "@/tabs";
import { APP_API, appCoursePath, type AppCourse } from "@shared/app-contract";
import { isStep, nextStepId, quizStepIds, stepPosition } from "@/quiz-steps";
import { JOIN_STEPS, isJoinStep } from "@/join-draft";
import { FREE_STEPS } from "@shared/free-intake";
import { UPGRADE_CARD_PLACES, UPGRADE_CARD_REST_DAYS, upgradeCard } from "@shared/upgrade-card";
import { USERNAME_MESSAGES, normalizeUsername, usernameProblem } from "@shared/username";
import type { AppDrill, AppSession, AppWeek } from "@shared/app-contract";
import { NEXT_STILLS, nextCard, nextStills, rowLine, weekMinutesDone, weekRows, weekSummary } from "@/week-view";
import { QUIZ_STEPS } from "@shared/quiz";
import { WORDS_DARK, wordsShade } from "@/shade-stops";
import { START_TELL_AT_MS, cameraFirst, clockButton, clockFields, clockView, lessStep, parseClock, readyMinutes, refusalIsFinal, resendDelayMs, shotUri, startWorthTelling, type Clock } from "@/clock-core";
import { CLOCK_CAP_MINUTES, CLOCK_LIVE_SECONDS, CLOCK_MIN_SECONDS, CLOCK_WORDS } from "@shared/training-clock";

function memoryKV(): KV & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: async (k) => map.get(k) ?? null,
    set: async (k, v) => void map.set(k, v),
    remove: async (k) => void map.delete(k),
  };
}

describe("the session in the Keychain, in pieces", () => {
  it("splits and joins any length", async () => {
    const kv = memoryKV();
    const s = chunkedStorage(kv);
    const big = "x".repeat(CHUNK_SIZE * 3 + 17);
    await s.setItem("sb", big);
    expect(kv.map.get("sb.n")).toBe("4");
    expect(await s.getItem("sb")).toBe(big);
    await s.setItem("sb", "short");
    expect(kv.map.get("sb.n")).toBe("1");
    expect(kv.map.has("sb.1")).toBe(false); // old pieces removed
    expect(await s.getItem("sb")).toBe("short");
    await s.removeItem("sb");
    expect(kv.map.size).toBe(0);
    expect(await s.getItem("sb")).toBeNull();
  });

  it("a torn or odd count reads as signed out", async () => {
    const kv = memoryKV();
    const s = chunkedStorage(kv);
    kv.map.set("sb.n", "2");
    kv.map.set("sb.0", "half");
    expect(await s.getItem("sb")).toBeNull();
    expect(parseCount("0")).toBeNull();
    expect(parseCount("abc")).toBeNull();
    expect(parseCount(String(MAX_CHUNKS + 1))).toBeNull();
    expect(splitValue("")).toEqual([""]);
  });
});

function week(): AppWeek {
  const d = (id: string, minutes: number, completed = false) => ({
    id,
    title: id,
    name: id,
    kind: "skill" as const,
    kindLabel: "Drill",
    reps: "",
    how: "",
    notes: null,
    minutes,
    trained: completed ? minutes : 0,
    video: null,
    poster: null,
    completed,
  });
  const s = (n: number, drills: ReturnType<typeof d>[], extra = false) => ({
    n,
    name: `Session ${n}`,
    extra,
    headline: null,
    image: null,
    minutesTotal: drills.reduce((a, x) => a + x.minutes, 0),
    done: drills.filter((x) => x.completed).length,
    total: drills.length,
    complete: drills.every((x) => x.completed),
    drills,
  });
  return {
    week: 2,
    range: null,
    focus: null,
    sessions: [s(1, [d("a", 10, true), d("b", 5, true)]), s(2, [d("c", 10), d("e", 5)]), s(3, [d("f", 8)])],
    current: 2,
    planCount: 3,
    sessionsLeft: 2,
    weekDone: false,
    oneMore: null,
    nextWeekLine: "",
    dropLine: "",
    lastWeekLine: null,
    ladder: [{ key: "week", label: "This week", value: "1 of 3" }],
    totalMinutes: 15,
    onBreak: null,
    hasWall: false,
  };
}

describe("a drill done shows at once, by the server's rules", () => {
  it("ticks the drill, the session and the week", () => {
    let w = applyDone(week(), "c", true);
    expect(w.totalMinutes).toBe(25);
    expect(w.sessions[1].done).toBe(1);
    expect(w.current).toBe(2);
    w = applyDone(w, "e", true);
    expect(w.sessions[1].complete).toBe(true);
    expect(w.current).toBe(3);
    expect(w.sessionsLeft).toBe(1);
    expect(w.oneMore).toBe("One more session completes your week.");
    expect(w.ladder[0].value).toBe("2 of 3");
    w = applyDone(w, "f", true);
    expect(w.weekDone).toBe(true);
    expect(w.oneMore).toBeNull();
  });

  it("undo takes the minutes back off, and a repeat changes nothing", () => {
    const w0 = week();
    expect(applyDone(w0, "a", true)).toBe(w0);
    expect(applyDone(w0, "nope", true)).toBe(w0);
    const w = applyDone(w0, "a", false);
    expect(w.totalMinutes).toBe(5);
    expect(w.current).toBe(1);
  });

  it("never counts what was missed", () => {
    expect(JSON.stringify(applyDone(week(), "c", true))).not.toMatch(/streak|missed|percent/i);
  });
});

describe("where the app belongs", () => {
  it("follows the website's member gate", () => {
    expect(areaFor(false, { kind: "ok" })).toBe("sign-in");
    expect(areaFor(true, null)).toBeNull();
    expect(areaFor(true, { kind: "ok" })).toBe("app");
    expect(areaFor(true, { kind: "consent" })).toBe("agreement");
    expect(areaFor(true, { kind: "onboarding" })).toBe("onboarding");
    expect(areaFor(true, { kind: "coach" })).toBe("gate");
    expect(areaFor(true, { kind: "membership", gate: { title: "", body: "", emailCoach: true } })).toBe("gate");
  });

  it("asks a new account for the code from its email before anything else (093)", () => {
    const owed = { username: null, hasPhoto: false, photoUrl: null, steps: ["username", "photo"] as ("username" | "photo")[], ideas: [] };
    const due = { email: "m@example.com" };
    expect(areaFor(true, { kind: "free", stage: "quiz" }, owed, due)).toBe("confirm-email");
    expect(areaFor(true, { kind: "onboarding" }, owed, due)).toBe("confirm-email");
    expect(areaFor(true, { kind: "consent" }, null, due)).toBe("confirm-email");
    expect(areaFor(true, { kind: "ok" }, null, due)).toBe("confirm-email");
    // nothing owed, or an older server that does not send it: as before
    expect(areaFor(true, { kind: "free", stage: "quiz" }, owed, null)).toBe("profile");
    expect(areaFor(true, { kind: "ok" }, null, undefined)).toBe("app");
    // a coach is never asked
    expect(areaFor(true, { kind: "coach" }, null, due)).toBe("gate");
    expect(inArea("confirm-email", ["confirm-email"])).toBe(true);
    expect(inArea("confirm-email", ["(free)"])).toBe(false);
    // Delete my account stays one tap away
    expect(inArea("confirm-email", ["delete-account"])).toBe(true);
    expect(areaHome("confirm-email")).toBe("/confirm-email");
  });

  it("asks a member from before 081 for the photo and username after the gate", () => {
    const owed = { username: null, hasPhoto: false, photoUrl: null, steps: ["username", "photo"] as ("username" | "photo")[], ideas: [] };
    expect(areaFor(true, { kind: "ok" }, owed)).toBe("profile");
    expect(areaFor(true, { kind: "ok" }, { ...owed, steps: [] })).toBe("app");
    // not applied yet: ask nothing
    expect(areaFor(true, { kind: "ok" }, null)).toBe("app");
    // the gate comes first, as on the website
    expect(areaFor(true, { kind: "consent" }, owed)).toBe("agreement");
    expect(inArea("profile", ["profile-setup"])).toBe(true);
    expect(inArea("profile", ["(tabs)"])).toBe(false);
    expect(inArea("app", ["profile-setup"])).toBe(true); // changing them from Settings
  });

  it("asks a new member for the photo BEFORE the door, so its card carries one", () => {
    const owed = { username: null, hasPhoto: false, photoUrl: null, steps: ["username", "photo"] as ("username" | "photo")[], ideas: [] };
    expect(areaFor(true, { kind: "onboarding" }, owed)).toBe("profile");
    expect(areaFor(true, { kind: "onboarding" }, { ...owed, steps: [] })).toBe("onboarding");
    // the photo is never a screen of the quiz, so nobody is asked twice
    expect(quizStepIds({ state: { kind: "onboarding" }, quizOwed: null })).not.toContain("photo");
    expect(quizStepIds({ state: { kind: "onboarding" }, quizOwed: null })).not.toContain("username");
  });

  // Nov 26 2026: the photo and @username moved AHEAD of the quiz for a free
  // account, so the door's code ("Have a code from a teammate or a club?")
  // can send a friend request or a club request that carries them.
  it("walks a free account: the photo, the door and the quiz, the offer, the free app", () => {
    const owed = { username: null, hasPhoto: false, photoUrl: null, steps: ["username", "photo"] as ("username" | "photo")[], ideas: [] };
    const set = { ...owed, username: "marcus.b", hasPhoto: true, steps: [] };
    // the photo and @username first, whatever stage the account is at
    expect(areaFor(true, { kind: "free", stage: "quiz" }, owed)).toBe("profile");
    // then the door and the quiz, on the same spot
    expect(areaFor(true, { kind: "free", stage: "quiz" }, set)).toBe("free-quiz");
    // an account from before this order still owes them before the offer
    expect(areaFor(true, { kind: "free", stage: "offer" }, owed)).toBe("profile");
    expect(areaFor(true, { kind: "free", stage: "offer" }, set)).toBe("free-offer");
    expect(areaFor(true, { kind: "free", stage: "ready" }, set)).toBe("free");
    expect(areaFor(true, { kind: "free", stage: "ready" }, owed)).toBe("profile");
    // a server that cannot store the quiz yet: the log is the website's
    expect(areaFor(true, { kind: "free", stage: "web" }, set)).toBe("gate");
    // a free account never lands on the member tabs or the member gate
    for (const stage of ["quiz", "offer", "ready"] as const) {
      expect(areaFor(true, { kind: "free", stage }, set)).not.toBe("app");
      expect(areaFor(true, { kind: "free", stage }, set)).not.toBe("gate");
    }
  });

  it("keeps each free area to its own screens", () => {
    expect(areaHome("free")).toBe("/(free)/friends");
    expect(areaHome("free-offer")).toBe("/offer");
    expect(areaHome("free-quiz")).toBe("/onboarding");
    expect(areaHome("app")).toBe("/");
    expect(areaHome("profile")).toBe("/profile-setup");
    expect(inArea("free-quiz", ["onboarding", "grade"])).toBe(true);
    expect(inArea("free-quiz", ["offer"])).toBe(false);
    // a friend's profile and the blocked list belong to the free app only
    expect(inArea("free", ["player", "f-diego"])).toBe(true);
    expect(inArea("free", ["blocked"])).toBe(true);
    expect(inArea("app", ["player", "f-diego"])).toBe(false);
    expect(inArea("free-quiz", ["player", "f-diego"])).toBe(false);
    expect(inArea("free-quiz", ["(free)"])).toBe(false);
    // after the quiz: the offer, then the week's set-up, and nothing else
    expect(inArea("free-offer", ["offer"])).toBe(true);
    expect(inArea("free-offer", ["week-plan"])).toBe(true);
    expect(inArea("free-offer", ["(free)"])).toBe(false);
    expect(inArea("free-offer", ["post"])).toBe(false);
    // the free app: its tabs, posting, the offer again, its week, the profile
    for (const seg of ["(free)", "post", "offer", "week-plan", "profile-setup", "settings", "delete-account", "change-password"]) {
      expect(inArea("free", [seg])).toBe(true);
    }
    // a club and everything one tap from it (start, join by code, its page,
    // Manage, plan, clubs near you, how the matchup works)
    for (const segs of [["club", "[id]"], ["club", "[id]", "manage"], ["club", "[id]", "plan"], ["club", "[id]", "near"], ["club", "start"], ["club", "join"], ["club", "how"]]) {
      expect(inArea("free", segs), segs.join("/")).toBe(true);
      // and never for a member, at a gate, or before the free app is open
      for (const area of ["app", "gate", "free-offer", "free-quiz", "sign-in"] as const) expect(inArea(area, segs), `${area} ${segs.join("/")}`).toBe(false);
    }
    // never a member's screens
    for (const seg of ["(tabs)", "session", "course", "extra", "checkin", "drop"]) {
      expect(inArea("free", [seg])).toBe(false);
    }
    // THE QUIZ, LATER: a free player who came in by the door takes it from
    // the one card on Week, so its screens open over the free app for them.
    // Never for a member with Train (their quiz is behind them).
    expect(inArea("free", ["onboarding"])).toBe(true);
    expect(inArea("free", ["onboarding", "onBall"])).toBe(true);
    expect(inArea("free", ["onboarding"], true)).toBe(false);
    expect(inArea("free", ["onboarding", "onBall"], true)).toBe(false);
    expect(inArea("app", ["onboarding"])).toBe(false);
    // and a member never the free app's
    expect(inArea("app", ["(free)"])).toBe(false);
    expect(inArea("app", ["post"])).toBe(false);
    expect(inArea("app", ["offer"])).toBe(false);
    // deleting the account is never behind anything
    expect(inArea("free-quiz", ["delete-account"])).toBe(true);
    expect(inArea("free-offer", ["settings"])).toBe(true);
  });

  // THE DOOR (lib/elite/free-door.ts): asked once, of a new free account
  // that has not taken the quiz; never of anyone who is in the free app.
  it("shows the door's code screen once, to a new free account only", () => {
    const email = "marcus@example.com";
    expect(doorDue({ stage: "quiz", email, passed: "" })).toBe(true);
    expect(doorDue({ stage: "quiz", email, passed: null })).toBe(true);
    // "I don't have a code" is remembered on this phone for that account
    expect(doorDue({ stage: "quiz", email, passed: email })).toBe(false);
    expect(doorDue({ stage: "quiz", email, passed: " Marcus@Example.com " })).toBe(false);
    // another account on the same phone is asked for itself
    expect(doorDue({ stage: "quiz", email: "kai@example.com", passed: email })).toBe(true);
    // in the free app (came in by a code, or finished the quiz), at the
    // offer, or where the quiz cannot be stored: never
    for (const stage of ["ready", "offer", "web", null, undefined] as const) expect(doorDue({ stage, email, passed: "" }), String(stage)).toBe(false);
  });

  it("after a quiz taken later, the screen opens the offer itself; a new player's is the gatekeeper's", () => {
    expect(quizWasLater({ kind: "free", stage: "ready" })).toBe(true);
    expect(quizWasLater({ kind: "free", stage: "offer" })).toBe(false);
    expect(quizWasLater({ kind: "free", stage: "quiz" })).toBe(false);
    expect(quizWasLater({ kind: "ok", social: true })).toBe(false);
    expect(quizWasLater(null)).toBe(false);
  });

  it("the one card on Week asks a player with no answers for the quiz first", () => {
    const now = Date.UTC(2026, 10, 26);
    const later = upgradeCard({ place: "week", member: false, area: null, sessions: 0, dismissedAt: null, now, quiz: true });
    expect(later).toEqual({
      title: "A week built around your game.",
      line: "Rate your game in a few taps. Then see what your first week would go after.",
      action: "See what you get",
      dismiss: "Not now",
      opens: "quiz",
    });
    // still the one card: one place, never for a member, put away the same way
    expect(upgradeCard({ place: "friends", member: false, area: null, sessions: 0, dismissedAt: null, now, quiz: true })).toBeNull();
    expect(upgradeCard({ place: "week", member: true, area: null, sessions: 0, dismissedAt: null, now, quiz: true })).toBeNull();
    expect(upgradeCard({ place: "week", member: false, area: null, sessions: 0, dismissedAt: now - 1000, now, quiz: true })).toBeNull();
    // with answers it names their own area and opens the offer, as before
    expect(upgradeCard({ place: "week", member: false, area: "Weak foot", sessions: 4, dismissedAt: null, now })?.opens).toBe("offer");
    // and with neither answers nor the quiz flag, nothing is shown
    expect(upgradeCard({ place: "week", member: false, area: null, sessions: 0, dismissedAt: null, now })).toBeNull();
  });

  it("Send my link shares the code to type and the link; an older server's link alone still works", () => {
    const link = "https://thestriveapp.com/join?ref=ABCD2345";
    const text = friendShareText({ code: "ABCD2345", link });
    expect(text).toBe("Train with me on Strive Elite.\nMy code: ABCD2345\nhttps://thestriveapp.com/join?ref=ABCD2345");
    expect(inviteShare({ invite: link, inviteText: text })).toEqual({ message: text });
    expect(inviteShare({ invite: link })).toEqual({ url: link });
    // what is shared is what the door reads: the whole pasted invite works
    expect(doorCodeFrom(text)).toEqual({ code: "ABCD2345", kind: "friend" });
  });

  // THE CLOCK LEFT RUNNING: one notification the phone gives itself.
  it("the clock's own notice: once, at 1h 30m, only with notifications already allowed", () => {
    const started = Date.UTC(2026, 10, 26, 21, 0, 0);
    const at = started + 90 * 60_000;
    expect(clockNudgeAt({ startedMs: started, finished: false, allowed: true, nowMs: started })).toBe(at);
    expect(clockNudgeAt({ startedMs: started, finished: false, allowed: true, nowMs: started + 60 * 60_000 })).toBe(at);
    // never asked for: with notifications not allowed there is none
    expect(clockNudgeAt({ startedMs: started, finished: false, allowed: false, nowMs: started })).toBeNull();
    // the finish photo is taken, or there is no clock: taken back
    expect(clockNudgeAt({ startedMs: started, finished: true, allowed: true, nowMs: started })).toBeNull();
    expect(clockNudgeAt({ startedMs: null, finished: false, allowed: true, nowMs: started })).toBeNull();
    // a clock opened after 1h 30m is never told about the past
    expect(clockNudgeAt({ startedMs: started, finished: false, allowed: true, nowMs: at })).toBeNull();
    expect(clockNudgeAt({ startedMs: started, finished: false, allowed: true, nowMs: at + 5 * 60_000 })).toBeNull();
    // a tap opens the clock, for whoever has the free app, and nothing else does
    expect(localRoute("free", { url: undefined, topic: undefined, open: LOCAL_CLOCK })).toBe("/post");
    expect(localRoute("app", { url: undefined, topic: undefined, open: LOCAL_CLOCK })).toBeNull();
    expect(localRoute("free", { url: "/log", topic: "friends" })).toBeNull();
    expect(localRoute("free", { url: undefined, topic: undefined, open: "settings" })).toBeNull();
    // what the phone hands over for it, as the notifications library shapes it
    expect(tappedNotice({ notification: { request: { content: { data: { open: "clock" } }, trigger: { type: "date" } } } }).open).toBe("clock");
  });

  it("lets someone signed out join free, and nothing else", () => {
    expect(inArea("sign-in", ["sign-in"])).toBe(true);
    expect(inArea("sign-in", ["join", "[step]"])).toBe(true);
    expect(inArea("sign-in", ["offer"])).toBe(false);
    expect(inArea("sign-in", ["(free)"])).toBe(false);
    expect(JOIN_STEPS[0]).toBe("age"); // the birthday first: nothing is typed by someone under 13
    expect(isJoinStep("agree")).toBe(true);
    expect(isJoinStep("offer")).toBe(false);
  });

  it("keeps account pages reachable and lets building finish", () => {
    expect(inArea("app", ["(tabs)"])).toBe(true);
    expect(inArea("app", ["session", "[n]"])).toBe(true);
    // a course is one tap from the Courses tab, and only inside the app
    expect(inArea("app", ["course", "[slug]"])).toBe(true);
    expect(inArea("gate", ["course", "[slug]"])).toBe(false);
    expect(inArea("agreement", ["course", "[slug]"])).toBe(false);
    expect(inArea("app", ["onboarding"])).toBe(false);
    expect(inArea("app", ["onboarding", "building"])).toBe(true);
    expect(inArea("gate", ["onboarding", "building"])).toBe(true);
    expect(inArea("gate", ["delete-account"])).toBe(true);
    expect(inArea("agreement", ["settings"])).toBe(true);
    expect(inArea("agreement", ["(tabs)"])).toBe(false);
    expect(inArea("sign-in", ["settings"])).toBe(false);
    expect(inArea("onboarding", ["onboarding", "gender"])).toBe(true);
  });
});

describe("a drill's tiles", () => {
  it("reads the coach's words by the set timer's rules", () => {
    expect(repsTiles("3 x 1 min, rest 30 sec")).toEqual([
      { big: "3 × 1 min", small: "sets" },
      { big: "30 sec", small: "rest between" },
    ]);
    expect(repsTiles("3 x 10 reps, rest 30 sec")).toEqual([
      { big: "3 × 10 reps", small: "sets" },
      { big: "30 sec", small: "rest between" },
    ]);
    expect(repsTiles("3 x 90 sec, rest 30 sec")[0].big).toBe("3 × 1 min 30 sec");
    expect(repsTiles("5 mins")).toEqual([{ big: "5 min", small: "one set" }]);
    // words it cannot time are shown exactly as written
    expect(repsTiles("Until it feels easy", 6)).toEqual([
      { big: "Until it feels easy", small: "what to do" },
      { big: "6 min", small: "about this long" },
    ]);
    expect(drillEyebrow("skill", 1, 3)).toBe("Drill 2 of 3");
    expect(drillEyebrow("warmup", -1, 3)).toBe("Warm-up");
  });
});

describe("the quiz screens", () => {
  const member = quizStepIds({ state: { kind: "onboarding" }, quizOwed: null });
  const free = quizStepIds({ state: { kind: "free", stage: "quiz" }, quizOwed: null });

  it("are the website's questions for a member, in its order", () => {
    expect(member).toEqual(QUIZ_STEPS.map((s) => s.id));
    expect(quizStepIds(null)).toEqual(member);
    expect(isStep("photo", member)).toBe(false);
    expect(isStep("gender", member)).toBe(true);
    expect(isStep(undefined, member)).toBe(false);
    expect(nextStepId("gender", member)).toBe("age");
    expect(nextStepId("parent", member)).toBeNull();
    expect(stepPosition("age", member)).toEqual({ index: 1, total: QUIZ_STEPS.length });
  });

  it("are the same quiz for a free account, minus what only a member is asked", () => {
    expect(free).toEqual(FREE_STEPS.map((s) => s.id));
    // a tap instead of a typed age and typed goals; the parent is a member's
    expect(free).toContain("grade");
    expect(free).toContain("aim");
    expect(free).not.toContain("age");
    expect(free).not.toContain("goals");
    expect(free).not.toContain("parent");
    // every other screen is the member's own
    const own = new Set(["grade", "aim"]);
    expect(free.filter((s) => !own.has(s)).every((s) => member.includes(s))).toBe(true);
    expect(nextStepId(free[free.length - 1], free)).toBeNull();
  });

  it("asks a member who took it while free only what is still owed", () => {
    const owed = quizStepIds({ state: { kind: "onboarding" }, quizOwed: ["parent"] });
    expect(owed).toEqual(["parent"]);
    expect(stepPosition("parent", owed)).toEqual({ index: 0, total: 1 });
    // nothing owed at all: the door builds the week at once
    expect(quizStepIds({ state: { kind: "onboarding" }, quizOwed: [] })).toEqual([]);
  });

  it("the phone answers a username's shape with the website's own rule", () => {
    expect(normalizeUsername(" @Marcus.B ")).toBe("marcus.b");
    expect(usernameProblem("marcus.b")).toBeNull();
    expect(USERNAME_MESSAGES[usernameProblem("ab")!]).toMatch(/at least 3/);
    expect(usernameProblem("strive.official")).toBe("reserved");
  });
});

describe("the tabs", () => {
  it("are the server's, in its order, with Courses between Week and You", () => {
    expect(APP_TABS.map((t) => t.key)).toEqual(["home", "week", "courses", "you"]);
    expect(APP_TABS.map((t) => t.route)).toEqual(["index", "week", "courses", "you"]);
  });

  it("are four for a free player: Friends, Week, Clubs, You", () => {
    const free = oneAppTabBar(false);
    expect(free.map((t) => t.label)).toEqual(["Friends", "Week", "Clubs", "You"]);
    expect(free.map((t) => t.route)).toEqual(["friends", "my-week", "clubs", "me"]);
    expect(areaHome("free")).toBe(`/(free)/${free[0].route}`);
  });
});

// Coach Yinka, Nov 24 2026: "pro should just add tabs" (after "why would
// they lose friends when they upgrade"). lib/elite/one-app.ts.
describe("one app: Strive Pro adds a tab and takes nothing away", () => {
  const set = { username: "marcus.b", hasPhoto: true, photoUrl: null, steps: [], ideas: [] };
  const pro = { kind: "ok", social: true } as const;

  it("a Pro member who came through the free app stays in the same tabs", () => {
    expect(areaFor(true, pro, set)).toBe("free");
    // a member with no free app behind them keeps the member app
    expect(areaFor(true, { kind: "ok" }, set)).toBe("app");
    expect(hasTrain(pro)).toBe(true);
    expect(hasTrain({ kind: "ok" })).toBe(false);
    expect(hasTrain({ kind: "free", stage: "ready" })).toBe(false);
  });

  it("their bar is the free bar with Train in front: every free tab, same order, same screen", () => {
    const free = oneAppTabBar(false);
    const withPro = oneAppTabBar(true);
    expect(withPro.map((t) => t.label)).toEqual(["Train", "Friends", "Week", "Clubs", "You"]);
    expect(withPro.slice(1)).toEqual(free);
    // an iPhone tab bar holds five: a sixth would hide a tab under "More"
    expect(withPro.length).toBeLessThanOrEqual(5);
    for (const t of withPro) expect(ONE_APP_ROUTE[t.key]).toBe(`/(free)/${t.route}`);
  });

  it("their Friends, Week, Clubs and You load the same data a free player's do", () => {
    // the fault the first preview showed: those tabs asked "is this a free
    // account?" before loading, and a Pro member got four empty screens
    expect(hasFreeApp(pro)).toBe(true);
    expect(hasFreeApp(pro, "ready")).toBe(true);
    expect(hasFreeApp({ kind: "free", stage: "ready" }, "ready")).toBe(true);
    expect(hasFreeApp({ kind: "free", stage: "offer" }, "ready")).toBe(false);
    expect(hasFreeApp({ kind: "free", stage: "offer" })).toBe(true);
    // a member with no free app behind them has none of it
    expect(hasFreeApp({ kind: "ok" })).toBe(false);
    expect(hasFreeApp(null)).toBe(false);
  });

  it("they open on Train; a free player opens on Friends", () => {
    expect(areaHome("free", true)).toBe("/(free)/train");
    expect(areaHome("free", false)).toBe("/(free)/friends");
    expect(homeOf(pro)).toBe("/(free)/train");
    expect(homeOf({ kind: "free", stage: "ready" })).toBe("/(free)/friends");
    expect(homeOf({ kind: "ok" })).toBe("/");
  });

  it("what Train opens (a session, the drop, extra work, a course, the Inbox) is theirs, and only theirs", () => {
    for (const seg of ["session", "drop", "extra", "checkin", "course", "inbox"]) {
      expect(inArea("free", [seg], true), seg).toBe(true);
      expect(inArea("free", [seg], false), seg).toBe(false);
    }
    // everything the free app had is still one tap away
    for (const seg of ["(free)", "post", "club", "week-plan", "settings"]) expect(inArea("free", [seg], true), seg).toBe(true);
  });

  it("their notices open the right tab: the week on Train, a friend on Friends, a medal on You", () => {
    expect(pushRoute("free", "/dashboard", "week", true)).toBe("/(free)/train");
    expect(pushRoute("free", "/homework", "week", true)).toBe("/(free)/train");
    expect(pushRoute("free", "/log", "friends", true)).toBe("/(free)/friends");
    expect(pushRoute("free", "/log/week", undefined, true)).toBe("/(free)/my-week");
    expect(pushRoute("free", "/you", undefined, true)).toBe("/(free)/me");
    expect(pushRoute("free", "/courses/keep-it-up", undefined, true)).toBe("/course/keep-it-up");
    expect(pushRoute("free", undefined, undefined, true)).toBe("/(free)/train");
    // a free player's notices are unchanged
    expect(pushRoute("free", "/dashboard", "week", false)).toBe("/(free)/friends");
  });
});

describe("a tapped notification", () => {
  const CLUB = "22222222-2222-4222-8222-222222222222";
  it("opens where the person lives", () => {
    expect(pushRoute("app", "/dashboard")).toBe("/");
    expect(pushRoute("free", "/log")).toBe("/(free)/friends");
    expect(pushRoute("free", undefined)).toBe("/(free)/friends");
    expect(pushRoute(null, "/log")).toBe("/");
  });
  it("opens the club itself for a club's session or game, in the free app only", () => {
    expect(pushRoute("free", `/log/club/${CLUB}`)).toBe(`/club/${CLUB}`);
    expect(pushRoute("app", `/log/club/${CLUB}`)).toBe("/");
    expect(pushRoute("free-offer", `/log/club/${CLUB}`)).toBe("/offer");
  });
  it("opens the screen the notice is about", () => {
    // a new week, a reminder: Home. A medal: You. The week itself: Week.
    expect(pushRoute("app", "/dashboard", "week")).toBe("/");
    expect(pushRoute("app", "/you", "week")).toBe("/you");
    expect(pushRoute("app", "/homework", "week")).toBe("/week");
    expect(pushRoute("app", "/courses/keep-it-up")).toBe("/course/keep-it-up");
    expect(pushRoute("free", "/log/week", "friends")).toBe("/(free)/my-week");
    expect(pushRoute("free", "/log/clubs", "clubs")).toBe("/(free)/clubs");
  });
  it("opens the Inbox for anything from the coach: the note is read there", () => {
    expect(pushRoute("app", "/messages", "coach")).toBe("/inbox");
    expect(pushRoute("app", "/film", "coach")).toBe("/inbox");
    expect(pushRoute("app", "/dashboard", "coach")).toBe("/inbox");
    expect(pushRoute("app", "/messages")).toBe("/inbox");
    // a topic the app does not know changes nothing
    expect(pushRoute("app", "/dashboard", "sales")).toBe("/");
    expect(pushRoute("app", "/dashboard", 7)).toBe("/");
  });
  it("never jumps a gate: someone not in the app yet is sent where they belong", () => {
    for (const area of ["sign-in", "agreement", "onboarding", "gate", "profile", "free-quiz", "free-offer"] as const) {
      expect(pushRoute(area, "/messages", "coach"), area).toBe(areaHome(area));
      expect(pushRoute(area, "/you", "week"), area).toBe(areaHome(area));
    }
  });
  it("the Inbox belongs to the member app, and to nobody else", () => {
    expect(inArea("app", ["inbox"])).toBe(true);
    expect(inArea("free", ["inbox"])).toBe(false);
    expect(inArea("gate", ["inbox"])).toBe(false);
    expect(inArea("agreement", ["inbox"])).toBe(false);
    expect(inArea("sign-in", ["inbox"])).toBe(false);
  });
  it("reads the address and the topic from Apple's own payload", () => {
    const res = (trigger: unknown, data?: unknown) => ({ notification: { request: { trigger, content: { data } } } });
    expect(tappedNotice(res({ type: "push", payload: { aps: {}, url: "/you", topic: "week", kind: "earned" } }))).toEqual({ url: "/you", topic: "week" });
    // the library's own data, when a relay filled it
    expect(tappedNotice(res({ type: "push", payload: null }, { url: "/log", topic: "friends" }))).toEqual({ url: "/log", topic: "friends" });
    // a local notification, or nothing at all
    expect(tappedNotice(res(null))).toEqual({ url: undefined, topic: undefined });
    expect(tappedNotice(null)).toEqual({ url: undefined, topic: undefined });
    expect(tappedNotice({})).toEqual({ url: undefined, topic: undefined });
  });
  it("never opens anything else an address asks for", () => {
    for (const url of ["/log/club/../settings", "/log/club/abc", `https://evil.example/log/club/${CLUB}`, `/log/club/${CLUB}/manage`, 7, null]) {
      expect(pushRoute("free", url), String(url)).toBe("/(free)/friends");
    }
  });
});

describe("the one upgrade card", () => {
  const base = { place: "week" as const, member: false, area: "Weak foot", sessions: 4, dismissedAt: null, now: Date.parse("2026-11-24T12:00:00Z") };

  it("has one place in the whole free app", () => {
    expect(UPGRADE_CARD_PLACES).toEqual(["week"]);
    expect(upgradeCard(base)).not.toBeNull();
  });

  it("is never shown to a member, and stays away thirty days after Not now", () => {
    expect(upgradeCard({ ...base, member: true })).toBeNull();
    expect(UPGRADE_CARD_REST_DAYS).toBe(30);
    const day = 24 * 60 * 60 * 1000;
    expect(upgradeCard({ ...base, dismissedAt: base.now - 29 * day })).toBeNull();
    expect(upgradeCard({ ...base, dismissedAt: base.now - 31 * day })).not.toBeNull();
  });

  it("says what a week would be, with no price, pressure or invented number", () => {
    const said = JSON.stringify(upgradeCard(base));
    expect(said).toMatch(/weak foot/);
    expect(said).not.toMatch(/\$|%|only|last chance|hurry|limited|guarantee|\bAI\b|automated|algorithm|\u2014/i);
  });
});

describe("a course's clips", () => {
  const step = (id: string, video: string | null) => ({
    id,
    kind: "drill" as const,
    title: id,
    tag: null,
    cue: null,
    passMark: null,
    blocks: [],
    video,
    poster: null,
    download: null,
  });
  const course: Pick<AppCourse, "levels"> = {
    levels: [
      { no: 1, label: "Level 1", name: "One touch", steps: [step("a", "https://x/a.mp4"), step("page", null), step("b", "https://x/b.mp4")] },
      { no: 2, label: "Level 2", name: null, steps: [step("c", "https://x/c.mp4")] },
    ],
  };
  const order = clipOrder(course);

  it("are the steps with a clip, in the course's order, however the list reports them", () => {
    expect(order).toEqual(["a", "b", "c"]);
    expect(clipsInView(order, ["c", "page", "b"])).toEqual(["b", "c"]);
    expect(clipsInView(order, [])).toEqual([]);
  });

  it("play one at a time: the top one on screen when demos play on their own", () => {
    expect(liveClip({ autoplay: true, picked: undefined, inView: ["b", "c"] })).toBe("b");
    expect(liveClip({ autoplay: true, picked: undefined, inView: [] })).toBeNull();
  });

  it("stay still until tapped when demos are switched off", () => {
    expect(liveClip({ autoplay: false, picked: undefined, inView: ["b", "c"] })).toBeNull();
    const picked = pickedAfterTap(null, "c");
    expect(liveClip({ autoplay: false, picked, inView: ["b", "c"] })).toBe("c");
  });

  it("a tap plays that clip, a tap on the live one pauses it", () => {
    expect(pickedAfterTap("b", "c")).toBe("c");
    expect(pickedAfterTap("b", "b")).toBeNull();
    expect(liveClip({ autoplay: true, picked: null, inView: ["b", "c"] })).toBeNull();
  });

  it("a tapped clip plays while it is on screen, then the setting decides again", () => {
    expect(pickedAfterScroll("c", ["b", "c"])).toBe("c");
    expect(pickedAfterScroll("c", ["a"])).toBeUndefined();
    // a pause by hand lasts until what is on screen changes
    expect(pickedAfterScroll(null, ["a"])).toBeUndefined();
    expect(pickedAfterScroll(undefined, ["a"])).toBeUndefined();
  });

  it("are asked for by the course's slug", () => {
    expect(APP_API.courses).toBe("/api/app/courses");
    expect(appCoursePath("keep-it-up")).toBe("/api/app/courses/keep-it-up");
    expect(appCoursePath("a b/../c")).toBe("/api/app/courses/a%20b%2F..%2Fc");
  });
});


// The Week tab (Nov 24 2026, Coach Yinka on build 7: five equal cards,
// "I don't think that screen is super addicting"): the week is a path with
// one big card, the session it is waiting on.
describe("the Week tab's path", () => {
  const drillOf = (id: string, minutes: number, completed: boolean): AppDrill => ({
    id,
    title: id,
    name: id,
    kind: "skill",
    kindLabel: "Drill",
    reps: "3 x 1 min",
    how: "",
    notes: null,
    minutes,
    trained: completed ? minutes : 0,
    video: null,
    poster: `https://example.test/${id}.jpg`,
    completed,
  });
  const session = (n: number, done: number, total = 4, extra = false): AppSession => {
    const drills = Array.from({ length: total }, (_, i) => drillOf(`s${n}d${i}`, 5, i < done));
    return { n, name: extra ? "Extra session" : `Session ${n}`, extra, headline: "Weak foot and passing", image: null, minutesTotal: total * 5, done, total, complete: done === total, drills };
  };
  const week = (sessions: AppSession[], current: number | null) => ({ sessions, current });

  it("a finished session is done, the one the week waits on is next, the rest are ahead", () => {
    const rows = weekRows(week([session(1, 4), session(2, 4), session(3, 0), session(4, 0)], 3));
    expect(rows.map((r) => r.state)).toEqual(["done", "done", "next", "open"]);
    // one big card, never two
    expect(rows.filter((r) => r.state === "next")).toHaveLength(1);
  });

  it("the line is gold as far as the player has got, and stops at both ends", () => {
    const rows = weekRows(week([session(1, 4), session(2, 4), session(3, 0), session(4, 0)], 3));
    expect(rows.map((r) => [r.lineAbove, r.lineBelow])).toEqual([
      [null, "gold"],
      ["gold", "gold"],
      ["gold", "grey"],
      ["grey", null],
    ]);
  });

  it("a session done out of order is still done, and nothing is marked as missed", () => {
    const rows = weekRows(week([session(1, 4), session(2, 0), session(3, 4), session(4, 0)], 2));
    expect(rows.map((r) => r.state)).toEqual(["done", "next", "done", "open"]);
    const words = JSON.stringify([rows.map((r) => rowLine(r.s, r.state)), weekSummary(week([session(1, 4), session(2, 0)], 2))]);
    expect(words).not.toMatch(/miss|late|behind|overdue|streak|%/i);
  });

  it("a finished week has no big card", () => {
    expect(weekRows(week([session(1, 4), session(2, 4)], null)).map((r) => r.state)).toEqual(["done", "done"]);
  });

  it("the summary counts the plan and the minutes ticked off, extra work included", () => {
    expect(weekSummary(week([session(1, 0), session(2, 0)], 1))).toBe("2 sessions this week");
    expect(weekSummary(week([session(1, 4), session(2, 1), session(3, 0)], 2))).toBe("1 of 3 sessions done · 25 min trained");
    expect(weekSummary(week([session(1, 4), session(2, 4)], null))).toBe("All 2 sessions done · 40 min trained");
    expect(weekSummary(week([session(1, 0)], 1))).toBe("1 session this week");
    // an extra session adds minutes, never a session to the plan's count
    expect(weekSummary(week([session(1, 4), session(2, 0), session(3, 4, 4, true)], 2))).toBe("1 of 2 sessions done · 40 min trained");
    expect(weekMinutesDone([session(1, 2), session(2, 4)])).toBe(30);
  });

  it("the big card says Start, or Continue once a drill of it is done", () => {
    expect(nextCard(session(3, 0))).toEqual({ eyebrow: "Up next", line: "4 drills · 20 min", button: "Start" });
    expect(nextCard(session(3, 1))).toEqual({ eyebrow: "Keep going", line: "1 of 4 drills done · 20 min", button: "Continue" });
    expect(nextCard(session(3, 0, 1)).line).toBe("1 drill · 5 min");
  });

  it("shows five drill stills at most, then how many more", () => {
    expect(nextStills(session(3, 1)).more).toBe(0);
    const big = nextStills(session(3, 2, 8));
    expect(big.stills).toHaveLength(NEXT_STILLS);
    expect(big.more).toBe(3);
    expect(big.stills.map((d) => d.done)).toEqual([true, true, false, false, false]);
  });

  it("the other rows carry what the session works on", () => {
    expect(rowLine(session(1, 4), "done")).toBe("Weak foot and passing · 20 min");
    expect(rowLine(session(4, 0), "open")).toBe("Weak foot and passing · 4 drills · 20 min");
    expect(rowLine({ ...session(4, 0), headline: null }, "open")).toBe("4 drills · 20 min");
  });
});

// Session tracking (Nov 24 2026, Coach Yinka: "absolutely and utterly on
// point"). A tick is kept on the phone and sent until the server answers;
// it is never taken back off the screen because the signal dropped, and
// never counted as saved when it is not.
describe("a drill ticked on the phone", () => {
  const d = (id: string, minutes: number, completed: boolean): AppDrill => ({
    id, title: id, name: id, kind: "skill", kindLabel: "Drill", reps: "", how: "", notes: null, minutes, trained: completed ? minutes : 0, video: null, poster: null, completed,
  });
  const serverWeek = (): AppWeek => {
    const s1 = [d("a", 5, true), d("b", 6, true)];
    const s2 = [d("c", 7, false), d("e", 8, false)];
    const session = (n: number, drills: AppDrill[]): AppSession => {
      const done = drills.filter((x) => x.completed).length;
      return { n, name: `Session ${n}`, extra: false, headline: null, image: null, minutesTotal: drills.reduce((a, x) => a + x.minutes, 0), done, total: drills.length, complete: done === drills.length, drills };
    };
    return {
      week: 3, range: null, focus: null, sessions: [session(1, s1), session(2, s2)], current: 2, planCount: 2, sessionsLeft: 1, weekDone: false,
      oneMore: null, nextWeekLine: "", dropLine: "", lastWeekLine: null, ladder: [], totalMinutes: 100, onBreak: null, hasWall: true,
    };
  };

  it("the newest tap on a drill is the one that is sent", () => {
    let list: Tick[] = queueTick([], "c", true, 1);
    list = queueTick(list, "e", true, 2);
    list = queueTick(list, "c", false, 3);
    expect(list.map((t) => [t.id, t.completed])).toEqual([["e", true], ["c", false]]);
  });

  it("an unsent tick shows as done over the server's week, minutes and all", () => {
    const shown = overlay(serverWeek(), queueTick(queueTick([], "c", true, 1), "e", true, 2));
    expect(shown.sessions[1].complete).toBe(true);
    expect(shown.weekDone).toBe(true);
    expect(shown.totalMinutes).toBe(115);
    // and a refresh that brings the same server week back changes nothing
    expect(overlay(serverWeek(), queueTick(queueTick([], "c", true, 1), "e", true, 2))).toEqual(shown);
  });

  it("once the server holds it, laying the tick over again adds nothing twice", () => {
    const tick = queueTick([], "c", true, 1);
    const saved = { ...applyDone(serverWeek(), "c", true), totalMinutes: 107 };
    expect(overlay(saved, tick).totalMinutes).toBe(107);
    expect(overlay(saved, []).totalMinutes).toBe(107);
  });

  it("a tick carries the time the drill really took, and that is what it adds", () => {
    // drill c is planned at 7 minutes; it took 4m10s
    const shown = overlay(serverWeek(), queueTick([], "c", true, 1, 250));
    expect(shown.totalMinutes).toBe(104);
    expect(shown.sessions[1].drills[0]).toMatchObject({ completed: true, trained: 4 });
    // ticked off in a few seconds: done, and nothing added
    const quick = overlay(serverWeek(), queueTick([], "c", true, 1, 12));
    expect(quick.totalMinutes).toBe(100);
    expect(quick.sessions[1].drills[0]).toMatchObject({ completed: true, trained: 0 });
    // left open all night: capped at twice the plan
    expect(overlay(serverWeek(), queueTick([], "c", true, 1, 30000)).totalMinutes).toBe(114);
    // unticking a done drill takes back exactly what it had added
    expect(applyDone(shown, "c", false).totalMinutes).toBe(100);
  });

  it("no answer keeps the tick; only an answer removes it", () => {
    const list = queueTick([], "c", true, 1);
    const sent = list[0];
    expect(settle(list, sent, "retry")).toEqual([{ ...sent, tries: 1 }]);
    expect(settle(list, sent, "saved")).toEqual([]);
    expect(settle(list, sent, "refused")).toEqual([]);
  });

  it("a tap made while the first was on its way is kept whatever the answer", () => {
    const first = queueTick([], "c", true, 1)[0];
    const now = queueTick([first], "c", false, 2);
    expect(settle(now, first, "saved")).toEqual(now);
    expect(settle(now, first, "refused")).toEqual(now);
  });

  it("no signal, a busy server or a session being renewed mean send again", () => {
    for (const status of [0, 401, 408, 429, 500, 502, 503, 504]) expect(outcomeOf(status), String(status)).toBe("retry");
    for (const status of [400, 403, 404, 409, 422]) expect(outcomeOf(status), String(status)).toBe("refused");
  });

  it("waits a little longer each time, and never gives up", () => {
    expect([0, 1, 2, 3, 4, 5, 50].map(retryDelayMs)).toEqual([2000, 5000, 15000, 30000, 60000, 60000, 60000]);
  });

  it("reads back only well-formed ticks from the phone's storage", () => {
    expect(parseTicks(null)).toEqual([]);
    expect(parseTicks("not json")).toEqual([]);
    expect(parseTicks(JSON.stringify({ id: "c" }))).toEqual([]);
    expect(parseTicks(JSON.stringify([{ id: "c", completed: true, at: 5, tries: 9 }, { id: 1 }, null]))).toEqual([{ id: "c", completed: true, at: 5, tries: 0 }]);
  });

  it("says what is true about saving, in plain words", () => {
    for (const line of [UNSENT_LINE, REFUSED_LINE]) {
      expect(line).not.toMatch(/\u2014|sync|queue|outbox|error|server|retry/i);
      expect(line.endsWith(".")).toBe(true);
    }
  });
});

// Home's photo card (simulator, Nov 24 2026): a two-line headline with the
// goal under it pushed the small gold line up onto the clear part of the
// photo. The shade is worked out from where the words start.
describe("the shade under words on a photo", () => {
  it("is already dark where the words start, wherever that is", () => {
    for (const top of [0, 0.1, 0.22, 0.4, 0.55, 0.78, 0.95]) {
      const stops = wordsShade(top);
      const at = stops.find(([, alpha]) => alpha >= WORDS_DARK)!;
      // the dark part begins at or above the first word (never lower than 78% down)
      expect(at[0], String(top)).toBeLessThanOrEqual(Math.max(0.1, Math.min(0.78, top)) + 1e-9);
    }
  });
  it("only ever gets darker going down, and ends black", () => {
    for (const top of [0, 0.05, 0.3, 0.6, 0.9, 1]) {
      const stops = wordsShade(top);
      for (let i = 1; i < stops.length; i++) {
        expect(stops[i][0], String(top)).toBeGreaterThan(stops[i - 1][0]);
        expect(stops[i][1], String(top)).toBeGreaterThanOrEqual(stops[i - 1][1]);
      }
      expect(stops[0][1]).toBe(0);
      expect(stops[stops.length - 1][1]).toBe(1);
    }
  });
});

// The social half's pictures (Nov 24 2026: polished to the training loop).
describe("the social half's small rules", () => {
  it("a board bar is this player's time against the most on the board, and never nothing for someone who trained", () => {
    expect(barShare(195, 195)).toBe(1);
    expect(barShare(120, 240)).toBe(0.5);
    expect(barShare(1, 600)).toBe(BAR_MIN);
    expect(barShare(0, 600)).toBe(0);
    expect(barShare(30, 0)).toBe(0);
  });

  it("a matchup bar is this club's share of the two times, level at half, and never empties a side", () => {
    expect(matchupSplit(60, 60)).toBe(0.5);
    expect(matchupSplit(0, 0)).toBe(0.5);
    expect(matchupSplit(111, 99)).toBeCloseTo(111 / 210);
    expect(matchupSplit(500, 0)).toBe(0.94);
    expect(matchupSplit(0, 500)).toBe(0.06);
  });

  it("a record reads as the numbers a player says, from the plain line the server sends", () => {
    expect(recordShort("Weeks won: 3. Weeks lost: 1. Draws: 0.")).toBe("3-1");
    expect(recordShort("Games won: 4. Games lost: 1. Draws: 2.")).toBe("4-1-2");
    expect(recordShort("Weeks won: 0. Weeks lost: 0. Draws: 0.")).toBe("0-0");
    expect(recordShort("")).toBeNull();
    expect(recordShort(null)).toBeNull();
  });
});

describe("the version line in Settings", () => {
  it("names the version and the build, and leaves out what it does not know", async () => {
    const { versionLine } = await import("@/version");
    expect(versionLine("1.0.0", "9")).toBe("Strive Elite 1.0.0 (9)");
    expect(versionLine("1.0.0", null)).toBe("Strive Elite 1.0.0");
    expect(versionLine(undefined, " ")).toBe("Strive Elite");
  });
});

// The training clock as the phone keeps it (src/clock-core.ts; the rules
// are lib/elite/training-clock.ts). It has to survive the app being closed
// and a field with no signal, and it never sends a length.
describe("the training clock on the phone", () => {
  const T = 1_800_000_000_000;
  const MIN = 60_000;
  const running: Clock = { owner: "m@example.com", start: { atMs: T, b64: "AAAA", uri: null }, finish: null, heard: false, post: null };
  const ready: Clock = { ...running, finish: { atMs: T + 47 * MIN, b64: "BBBB", uri: null } };

  it("comes back from storage whole, or not at all", () => {
    expect(parseClock(JSON.stringify(running))).toEqual(running);
    expect(parseClock(JSON.stringify(ready))).toEqual(ready);
    // the example build keeps where the picked photo is, not its bytes
    expect(parseClock(JSON.stringify({ ...running, start: { atMs: T, b64: null, uri: "file:///x.jpg" } }))?.start.uri).toBe("file:///x.jpg");
    for (const bad of [null, "", "nope", "{}", JSON.stringify({ ...running, owner: "" }), JSON.stringify({ ...running, start: { atMs: T } }), JSON.stringify({ ...running, start: { atMs: "soon", b64: "AAAA" } })]) {
      expect(parseClock(bad), String(bad)).toBeNull();
    }
    // a finish before its start is not a clock
    expect(parseClock(JSON.stringify({ ...running, finish: { atMs: T - 1, b64: "BBBB" } }))).toBeNull();
    expect(shotUri(running.start)).toBe("data:image/jpeg;base64,AAAA");
  });

  it("says where it stands: none, running, capped, expired, ready", () => {
    expect(clockView(null, T)).toEqual({ at: "none" });
    expect(clockView(running, T + 42 * MIN + 10_000)).toEqual({ at: "running", seconds: 42 * 60 + 10 });
    expect(clockView(running, T + 160 * MIN)).toEqual({ at: "capped", seconds: CLOCK_CAP_MINUTES * 60 });
    expect(clockView(running, T + 181 * MIN)).toEqual({ at: "expired" });
    // once both photos are taken the clock no longer moves, whatever time it is
    expect(clockView(ready, T + 500 * MIN)).toEqual({ at: "ready", minutes: 47, waiting: false });
  });

  it("a finished clock shows the time between the photos, never past the cap", () => {
    expect(readyMinutes(ready)).toBe(47);
    expect(readyMinutes({ ...ready, finish: { atMs: T + 170 * MIN, b64: "B", uri: null } })).toBe(CLOCK_CAP_MINUTES);
    expect(readyMinutes({ ...ready, finish: { atMs: T + 70_000, b64: "B", uri: null } })).toBe(1);
    expect(readyMinutes(running)).toBe(0);
  });

  it("the one button says where the clock stands", () => {
    expect(clockButton({ at: "none" })).toBe(CLOCK_WORDS.start);
    expect(clockButton({ at: "running", seconds: 5 })).toBe(CLOCK_WORDS.finishShort);
    expect(clockButton({ at: "capped", seconds: 9000 })).toBe(CLOCK_WORDS.finishShort);
    expect(clockButton({ at: "expired" })).toBe(CLOCK_WORDS.finishShort);
    expect(clockButton({ at: "ready", minutes: 47, waiting: false })).toBe(CLOCK_WORDS.postShort);
    expect([CLOCK_WORDS.start, CLOCK_WORDS.finishShort, CLOCK_WORDS.postShort]).toEqual(["Start training", "Finish my training", "Post my training"]);
  });

  it("tells the server the clock started only while that word can still arrive live", () => {
    expect(startWorthTelling(running, T + 5_000)).toBe(true);
    expect(startWorthTelling(running, T + CLOCK_LIVE_SECONDS * 1000)).toBe(true);
    expect(startWorthTelling(running, T + CLOCK_LIVE_SECONDS * 1000 + 1)).toBe(false);
    expect(startWorthTelling({ ...running, heard: true }, T + 5_000)).toBe(false);
    expect(startWorthTelling(ready, T + 5_000)).toBe(false);
    expect(startWorthTelling(null, T)).toBe(false);
    // every try lands inside the live window, the first at once
    expect(START_TELL_AT_MS[0]).toBe(0);
    expect(Math.max(...START_TELL_AT_MS)).toBeLessThan(CLOCK_LIVE_SECONDS * 1000);
  });

  it("sends the two times, when it was sent, and what the player chose: never a length", () => {
    expect(clockFields(ready, T + 48 * MIN, { kind: "training", caption: "  Weak foot only.  ", less: 10 })).toEqual({
      started: String(T),
      ended: String(T + 47 * MIN),
      sent: String(T + 48 * MIN),
      kind: "training",
      caption: "Weak foot only.",
      less: "10",
    });
    expect(clockFields(running, T, { kind: "training", caption: "", less: 0 })).toBeNull();
  });

  it("a post that could not be sent stays with the clock, through the app being closed", () => {
    const waiting: Clock = { ...ready, post: { kind: "gym", caption: "Legs.", less: 5 } };
    expect(parseClock(JSON.stringify(waiting))).toEqual(waiting);
    // it shows as waiting, at the time it will count
    expect(clockView(waiting, T + 500 * MIN)).toEqual({ at: "ready", minutes: 42, waiting: true });
    // a post is only ever waiting on a finished clock, and only a whole one is kept
    expect(parseClock(JSON.stringify({ ...running, post: waiting.post }))?.post).toBeNull();
    expect(parseClock(JSON.stringify({ ...ready, post: { kind: "nap", caption: "", less: 0 } }))?.post).toBeNull();
    // tried again soon, then every minute while the app is open
    expect([0, 1, 2, 3, 40].map(resendDelayMs)).toEqual([10_000, 30_000, 60_000, 60_000, 60_000]);
  });

  it("time can only come off a finished clock, five minutes a tap, never down to nothing", () => {
    expect(lessStep(47, 0, -1)).toBe(5);
    expect(lessStep(47, 5, -1)).toBe(10);
    expect(lessStep(47, 45, -1)).toBe(45); // 2 minutes left: no further
    expect(lessStep(47, 5, 1)).toBe(0);
    expect(lessStep(47, 0, 1)).toBe(0); // never adds time
    expect(lessStep(4, 0, -1)).toBe(0); // too short to take anything off
  });

  it("one tap goes to the camera only where a photo is the one thing to do next", () => {
    // the first clock ever shows how it works first
    expect(cameraFirst({ at: "none" }, false, CLOCK_MIN_SECONDS)).toBeNull();
    expect(cameraFirst({ at: "none" }, true, CLOCK_MIN_SECONDS)).toBe("start");
    // under a minute there is nothing to finish yet
    expect(cameraFirst({ at: "running", seconds: 30 }, true, CLOCK_MIN_SECONDS)).toBeNull();
    expect(cameraFirst({ at: "running", seconds: 60 }, true, CLOCK_MIN_SECONDS)).toBe("finish");
    expect(cameraFirst({ at: "capped", seconds: 9000 }, false, CLOCK_MIN_SECONDS)).toBe("finish");
    // nothing to photograph once both photos are taken, or it can no longer be timed
    expect(cameraFirst({ at: "ready", minutes: 47, waiting: false }, true, CLOCK_MIN_SECONDS)).toBeNull();
    expect(cameraFirst({ at: "expired" }, true, CLOCK_MIN_SECONDS)).toBeNull();
  });

  it("keeps a clock the server could not be reached for, and lets go of one it will never take", () => {
    for (const reason of ["short", "expired", "bad", "overlap", "day_cap"]) expect(refusalIsFinal(reason), reason).toBe(true);
    for (const reason of [null, undefined, "", "server", "offline", 7]) expect(refusalIsFinal(reason), String(reason)).toBe(false);
  });
});

describe("where you stand this week (Friends and Week)", () => {
  const row = (name: string, minutes: number, me = false) => ({ name, minutes, me });
  it("says the one thing a player cares about: how many of their own sessions beat the next friend up", () => {
    // a 1 hour session (4h over 4 days), 18 minutes back: one session does it
    const s = standingLine([row("Diego R.", 75), row("Marcus B.", 57, true), row("Kai T.", 30), row("Nico A.", 0)], 60);
    expect(s).toEqual({ strong: "You're 1 session away from beating Diego", rest: null });
    expect(standingSaid(s!)).toBe("You're 1 session away from beating Diego.");
    // the friend named is the next one up, never the leader two places away
    expect(standingLine([row("A One", 200), row("B Two", 90), row("Me", 60, true)], 60)!.strong).toBe("You're 1 session away from beating B");
    // a longer gap takes more sessions, and a shorter session takes more of them
    expect(standingLine([row("A One", 200), row("Me", 65, true)], 60)!.strong).toBe("You're 3 sessions away from beating A");
    expect(standingLine([row("A One", 200), row("Me", 65, true)], 45)!.strong).toBe("You're 4 sessions away from beating A");
    // no time yet: the same line, aimed at the closest friend with time
    expect(standingLine([row("Me", 0, true), row("Diego R.", 75), row("Kai T.", 20)], 60)!.strong).toBe("You're 1 session away from beating Kai");
  });
  it("a session is the player's own planned day, and beating means passing, not tying", () => {
    expect(sessionMinutes(45)).toBe(45);
    expect(sessionMinutes(0)).toBe(SESSION_FALLBACK_MINUTES);
    expect(sessionMinutes(null)).toBe(60);
    expect(sessionsToBeat(18, 60)).toBe(1);
    expect(sessionsToBeat(59, 60)).toBe(1);
    // exactly one session back: one session only ties, so it takes two
    expect(sessionsToBeat(60, 60)).toBe(2);
    expect(sessionsToBeat(0, 60)).toBe(1);
    // with no plan given, a session is one hour
    expect(standingLine([row("A One", 130), row("Me", 65, true)])!.strong).toBe("You're 2 sessions away from beating A");
  });
  it("in front: says so, and how close the next friend is", () => {
    expect(standingLine([row("Me", 90, true), row("Diego R.", 78), row("Kai T.", 0)], 60)).toEqual({ strong: "You're beating all your friends this week", rest: "Diego is 12m from catching you." });
    expect(standingLine([row("Me", 90, true), row("Diego R.", 78)], 60)).toEqual({ strong: "You're beating Diego this week", rest: "Diego is 12m from catching you." });
    // nobody else has time yet: nothing is said about anyone
    expect(standingLine([row("Me", 90, true), row("Kai T.", 0), row("Nico A.", 0)], 60)).toEqual({ strong: "You're beating all your friends this week", rest: null });
    expect(standingLine([row("Me", 60, true), row("Diego R.", 60)], 60)).toEqual({ strong: "You and Diego are tied", rest: "Your next session puts you in front." });
  });
  it("never says what a player has not done", () => {
    // nobody has trained, or no friends on the board: no line at all
    expect(standingLine([row("Me", 0, true), row("Diego R.", 0)], 60)).toBeNull();
    expect(standingLine([row("Me", 40, true)], 60)).toBeNull();
    expect(standingLine([], 60)).toBeNull();
    for (const board of [
      [row("Me", 0, true), row("Diego R.", 75), row("Kai T.", 0)],
      [row("Me", 10, true), row("Diego R.", 75), row("Kai T.", 0)],
      [row("Me", 90, true), row("Diego R.", 75), row("Kai T.", 0)],
    ]) {
      const said = standingSaid(standingLine(board, 60)!);
      expect(said).not.toMatch(/Kai|has not|hasn't|missed|behind|last|streak|\b(they|them|their)\b/i);
    }
  });
  it("the payoff: names the friend the player's own training just passed", () => {
    const before = [row("Diego R.", 75), row("Nico A.", 60), row("Me", 30, true)];
    expect(passedFriend(before, [row("Diego R.", 75), row("Nico A.", 60), row("Me", 70, true)])).toBe("Nico");
    // passed both: the one passed last is named
    expect(passedFriend(before, [row("Diego R.", 75), row("Nico A.", 60), row("Me", 90, true)])).toBe("Diego");
    // level is not passed; nothing on the first read; nothing when the player's time did not go up
    expect(passedFriend(before, [row("Diego R.", 75), row("Nico A.", 60), row("Me", 60, true)])).toBeNull();
    expect(passedFriend(null, before)).toBeNull();
    expect(passedFriend(before, [row("Diego R.", 75), row("Nico A.", 10), row("Me", 30, true)])).toBeNull();
    // a friend who was already behind is not "passed"
    expect(passedFriend([row("Kai T.", 10), row("Me", 30, true)], [row("Kai T.", 10), row("Me", 90, true)])).toBeNull();
  });
});
