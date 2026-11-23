import { Platform, Settings } from "react-native";
import type { AppBootstrap, AppDrill, AppExtra, AppMemberState, AppWeek, AppYou } from "@shared/app-contract";
import { MEDIA_BASE } from "@/config";

// The example player the screens are drawn with for review screenshots
// (EXPO_PUBLIC_FIXTURES=1): the browser build (scripts/screenshots.mjs) and
// the iPhone simulator build that GitHub's Mac walks through
// (.github/workflows/ios-simulator-screens.yml). Never the build that goes
// to TestFlight. Names and numbers are examples, the drills and their
// stills are the real bank's.
//
// Which member the example is, chosen per run:
//   browser    ?state=ok|consent|onboarding|membership|pro_checkout|setup|signedout
//   simulator  the launch argument -fixtureState <the same words>, which
//              iOS hands the app as a setting (sim/shots.sh, sim/flows)
export const FIXTURE_STATES = ["ok", "consent", "onboarding", "membership", "pro_checkout", "setup", "signedout"] as const;

function chosenState(): string {
  let raw: unknown = null;
  try {
    if (Platform.OS === "web") raw = new URLSearchParams(globalThis.location?.search ?? "").get("state");
    else if (Platform.OS === "ios") raw = Settings?.get?.("fixtureState");
  } catch {
    raw = null;
  }
  return typeof raw === "string" && (FIXTURE_STATES as readonly string[]).includes(raw) ? raw : "ok";
}

export function fixtureSignedIn(): boolean {
  return chosenState() !== "signedout";
}

const m = (p: string) => `${MEDIA_BASE}${p}`;

function drill(id: string, title: string, name: string, kind: AppDrill["kind"], reps: string, minutes: number, file: string, completed = false): AppDrill {
  return {
    id,
    title,
    name,
    kind,
    kindLabel: kind === "warmup" ? "Warm-up" : kind === "finisher" ? "Finisher" : "Drill",
    reps,
    how: "",
    notes: null,
    minutes,
    video: m(`/drills/${file}.mp4`),
    poster: m(`/drills/posters/${file}.jpg`),
    completed,
  };
}

const sessions = [
  {
    n: 1,
    files: [
      ["Plyo warm-up: Pogo jumps", "Pogo jumps", "warmup", "3 x 15", 4, "plyo-pogo-jumps"],
      ["Weak foot pop and juggle", "Weak foot pop and juggle", "skill", "3 x 1 min, rest 30 sec", 6, "weak-foot-pop-and-juggle"],
      ["Wall juggles", "Wall juggles", "skill", "3 x 1 min, rest 30 sec", 6, "wall-juggles"],
      ["Two touch passing", "Two touch passing", "skill", "3 x 90 sec, rest 30 sec", 8, "two-touch-passing"],
    ],
    done: true,
  },
  {
    n: 2,
    files: [
      ["Plyo warm-up: Lateral hops", "Lateral hops", "warmup", "3 x 10 each way", 4, "plyo-lateral-hops"],
      ["2 touch ball mastery variation 1", "2 touch ball mastery variation 1", "skill", "3 x 1 min, rest 30 sec", 6, "two-touch-ball-mastery-v1"],
      ["L turn, roll, touch", "L turn, roll, touch", "skill", "3 x 1 min, rest 30 sec", 6, "l-turn-roll-touch"],
      ["Triangle turning", "3 cone turning drill", "skill", "3 x 90 sec, rest 30 sec", 8, "triangle-turning"],
    ],
    done: true,
  },
  {
    n: 3,
    files: [
      ["Plyo warm-up: Alternating lunge jumps", "Alternating lunge jumps", "warmup", "3 x 8 each leg", 4, "plyo-alternating-lunge-jumps"],
      ["Weak foot tap, pull, push", "Weak foot tap, pull, push", "skill", "3 x 1 min, rest 30 sec", 5, "weak-foot-tap-pull-push"],
      ["Wall pass, touch, stepover", "Wall pass, touch, stepover", "skill", "3 x 90 sec, rest 30 sec", 7, "wall-pass-touch-stepover"],
      ["Weak foot outside pull, inside pull", "Weak foot outside pull, inside pull", "skill", "3 x 1 min, rest 30 sec", 6, "weak-foot-outside-pull-inside-pull"],
    ],
    done: false,
  },
  {
    n: 4,
    files: [
      ["Plyo warm-up: Broad jumps", "Broad jumps", "warmup", "3 x 5", 4, "plyo-broad-jumps"],
      ["Push pull, fake roll, roll across", "Push pull, fake roll, roll across", "skill", "3 x 1 min, rest 30 sec", 6, "push-pull-fake-roll"],
      ["Pass, touch past, Cruyff turn", "Pass, touch past, Cruyff turn", "skill", "3 x 90 sec, rest 30 sec", 7, "pass-cruyff-turn"],
      ["L turn pullback chop", "L turn pullback chop", "skill", "3 x 1 min, rest 30 sec", 6, "l-turn-pullback-chop"],
    ],
    done: false,
  },
] as const;

export const FIXTURE_WEEK: AppWeek = {
  week: 7,
  range: "Nov 23 to Nov 29",
  focus: "This week goes after your weak foot.",
  sessions: sessions.map((s) => {
    const drills = s.files.map((f, i) =>
      drill(`00000000-0000-4000-8000-0000000${s.n}${i}000`, f[0], f[1], f[2], f[3], f[4], f[5], s.done)
    );
    const minutesTotal = drills.reduce((a, d) => a + d.minutes, 0);
    const headlines: Record<number, string> = { 1: "Weak foot and passing", 2: "Ball mastery and passing", 3: "Weak foot and first touch", 4: "1v1 moves and passing" };
    return {
      n: s.n,
      name: `Session ${s.n}`,
      extra: false,
      headline: headlines[s.n],
      image: drills[2].poster,
      minutesTotal,
      done: s.done ? drills.length : 0,
      total: drills.length,
      complete: s.done,
      drills,
    };
  }),
  current: 3,
  planCount: 4,
  sessionsLeft: 2,
  weekDone: false,
  oneMore: null,
  nextWeekLine: "Your coach is building week 8. It drops Monday.",
  dropLine: "Four sessions. This week goes after your weak foot.",
  ladder: [
    { key: "goal", label: "Goal", value: "Start for my club team" },
    { key: "week", label: "This week", value: "2 of 4" },
  ],
  totalMinutes: 262,
  onBreak: null,
  hasWall: true,
};

export const FIXTURE_YOU: AppYou = {
  card: { name: "Marcus B.", since: "Member since Oct 2026", tier: "Pro" },
  position: "Attacking midfield",
  week: 7,
  weekMinutesDone: 54,
  weekMinutesPlanned: 104,
  allTimeMinutes: 262,
  sessionsDone: 11,
  bars: [
    { week: 1, minutes: 38 },
    { week: 2, minutes: 52 },
    { week: 3, minutes: 30 },
    { week: 4, minutes: 64 },
    { week: 5, minutes: 0 },
    { week: 6, minutes: 24 },
    { week: 7, minutes: 54 },
  ],
  areas: [
    { area: "Weak foot", minutes: 96, thisWeek: 12 },
    { area: "Ball mastery", minutes: 64, thisWeek: 12 },
    { area: "Passing", minutes: 52, thisWeek: 16 },
    { area: "Plyo warm-ups", minutes: 30, thisWeek: 8 },
    { area: "1v1 moves", minutes: 20, thisWeek: 0 },
  ],
  medals: [
    { hours: 1, earned: true },
    { hours: 3, earned: true },
    { hours: 5, earned: false },
  ],
  next: { hours: 5, minutesAway: 38 },
  achievements: [
    { id: "a1", title: "10 Sessions", detail: "Ten sessions done" },
    { id: "a2", title: "First Week", detail: "Every session of a week" },
  ],
};

export const FIXTURE_EXTRA: AppExtra = {
  shelves: [
    { key: "ball_mastery", label: "Ball Mastery", blurb: "Touches, cones, control. Any space." },
    { key: "wall_work", label: "Wall Work", blurb: "Passing and weak foot against a wall." },
    { key: "one_v_one", label: "1v1 Skills", blurb: "Moves, feints, beating a defender." },
  ],
  groups: [
    {
      key: "ball",
      label: "Ball mastery",
      drills: [
        { id: "x1", title: "2 touch ball mastery variation 2", minutes: 6, poster: m("/drills/posters/two-touch-ball-mastery-v2.jpg"), doneBefore: false },
        { id: "x2", title: "L turn, roll, touch", minutes: 6, poster: m("/drills/posters/l-turn-roll-touch.jpg"), doneBefore: true },
      ],
    },
    {
      key: "weak",
      label: "Weak foot",
      drills: [
        { id: "x3", title: "Weak foot pop and settle", minutes: 6, poster: m("/drills/posters/weak-foot-pop-and-settle.jpg"), doneBefore: false },
        { id: "x4", title: "Weak foot tap, pull, push", minutes: 5, poster: m("/drills/posters/weak-foot-tap-pull-push.jpg"), doneBefore: true },
      ],
    },
  ],
  warmUpMinutes: 4,
  finisherMinutes: 0,
  error: null,
};

function stateFor(kind: string): AppMemberState {
  switch (kind) {
    case "consent":
      return { kind: "consent" };
    case "onboarding":
      return { kind: "onboarding" };
    case "membership":
      return {
        kind: "membership",
        gate: {
          title: "One step left",
          body: "Your profile is saved. Your coach switches your membership on from their side, and then your first week shows up here. If you have been waiting more than a day, email your coach.",
          emailCoach: true,
        },
      };
    case "pro_checkout":
      return {
        kind: "pro_checkout",
        gate: { title: "Start Strive Pro", body: "Your account is ready. Start your membership to build your first week.", emailCoach: false, startPro: true },
      };
    default:
      return { kind: "ok" };
  }
}

export function fixtureBootstrap(): AppBootstrap {
  const state = stateFor(chosenState());
  return {
    viewer: { name: "Marcus Bryant", firstName: "Marcus", email: "marcus@example.com" },
    state,
    consent:
      state.kind === "consent"
        ? {
            version: "2026-11-18",
            points: [
              "We store your player's profile, training, clips and messages to run their program.",
              "Some of that information is handled by the service providers named in the Privacy Policy, including automated tools that help our coaches prepare training plans.",
              "We text you about your player's training. Message and data rates may apply. Reply STOP to any text to end them.",
            ],
            guardian: "I am this player's parent or legal guardian, or I am the player and I am 18 or older.",
            terms: "I agree to the Terms of Service and the Privacy Policy.",
          }
        : null,
    player: {
      id: "p-example",
      tier: "pro",
      card: FIXTURE_YOU.card,
      position: "Attacking midfield",
      knownParentPhone: "",
    },
    tabs: [
      { key: "home", label: "Home" },
      { key: "week", label: "Week" },
      { key: "courses", label: "Courses" },
      { key: "you", label: "You" },
    ],
    unread: 0,
    // ?state=setup: a member from before 081 who still owes both screens
    profileSetup:
      chosenState() === "setup"
        ? { username: null, hasPhoto: false, photoUrl: null, steps: ["username", "photo"], ideas: ["marcus.b", "marcusbryant", "marcus_b"] }
        : { username: "marcus.b", hasPhoto: false, photoUrl: null, steps: [], ideas: [] },
  };
}

// What each call answers with in the example build.
export function fixtureResponse(path: string, method: string): unknown {
  if (path.startsWith("/api/app/me")) return fixtureBootstrap();
  if (path.startsWith("/api/app/week")) return { week: FIXTURE_WEEK };
  if (path.startsWith("/api/app/you")) return { you: FIXTURE_YOU };
  if (path.startsWith("/api/app/extra")) return method === "GET" ? FIXTURE_EXTRA : { ok: true, session: 5 };
  if (path.startsWith("/api/app/drill")) return { ok: true, totalMinutes: FIXTURE_WEEK.totalMinutes };
  if (path.startsWith("/api/app/first-week")) return { status: "live", line: null };
  if (path.startsWith("/api/app/profile/username")) return { ok: true, name: "marcus.b" };
  return { ok: true };
}
