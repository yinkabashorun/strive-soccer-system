import { describe, expect, it } from "vitest";
import { chunkedStorage, CHUNK_SIZE, MAX_CHUNKS, parseCount, splitValue, type KV } from "@/auth/chunks";
import { applyDone } from "@/week-cache";
import { areaFor, inArea } from "@/navigation";
import { clipOrder, clipsInView, liveClip, pickedAfterScroll, pickedAfterTap } from "@/course-view";
import { drillEyebrow, repsTiles } from "@/drill-view";
import { APP_TABS } from "@/tabs";
import { APP_API, appCoursePath, type AppCourse } from "@shared/app-contract";
import { isStep, nextStepId, stepOrder, stepPosition } from "@/quiz-steps";
import { USERNAME_MESSAGES, normalizeUsername, usernameProblem } from "@shared/username";
import type { AppWeek } from "@shared/app-contract";
import { QUIZ_STEPS } from "@shared/quiz";

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
      { big: "Until it feels easy", small: "the work" },
      { big: "6 min", small: "about" },
    ]);
    expect(drillEyebrow("skill", 1, 3)).toBe("Drill 2 of 3");
    expect(drillEyebrow("warmup", -1, 3)).toBe("Warm-up");
  });
});

describe("the quiz screens", () => {
  it("are the website's questions, then the profile while 081 is live", () => {
    expect(stepOrder([])).toEqual(QUIZ_STEPS.map((s) => s.id));
    expect(stepOrder(["username", "photo"]).slice(-2)).toEqual(["username", "photo"]);
    expect(isStep("photo", [])).toBe(false);
    expect(isStep("gender", [])).toBe(true);
    expect(nextStepId("gender", [])).toBe("age");
    expect(nextStepId("parent", [])).toBeNull();
    expect(nextStepId("parent", ["username", "photo"])).toBe("username");
    expect(nextStepId("photo", ["username", "photo"])).toBeNull();
    expect(stepPosition("age", [])).toEqual({ index: 1, total: QUIZ_STEPS.length });
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

