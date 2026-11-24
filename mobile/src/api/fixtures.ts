import { Platform, Settings } from "react-native";
import type {
  AppBootstrap,
  AppCourse,
  AppCourseList,
  AppCourseStep,
  AppDrill,
  AppExtra,
  AppFeedCard,
  AppFreeFeed,
  AppFreePlan,
  AppFreeWeek,
  AppFreeYou,
  AppMemberState,
  AppOffer,
  AppWeek,
  AppYou,
} from "@shared/app-contract";
import { lessonBlocks } from "@shared/app-courses";
import type { FreeStage } from "@shared/free-intake";
import { auraLabel, friendsBoard, type Face } from "@shared/tracker";
import { MEDIA_BASE } from "@/config";

// The example player the screens are drawn with for review screenshots
// (EXPO_PUBLIC_FIXTURES=1): the browser build (scripts/screenshots.mjs) and
// the iPhone simulator build that GitHub's Mac walks through
// (.github/workflows/ios-simulator-screens.yml). Never the build that goes
// to TestFlight. Names and numbers are examples, the drills and their
// stills are the real bank's.
//
// Which member the example is, chosen per run:
//   browser    ?state=ok|consent|onboarding|membership|pro_checkout|setup|locked|free_quiz|free_offer|signedout
//   simulator  the launch argument -fixtureState <the same words>, which
//              iOS hands the app as a setting (sim/shots.sh, sim/flows)
//
// "locked" is a FREE account in the free app (Friends, Week, Courses, You):
// friends, posts, a week under way, and the Courses shelf the way an
// account that is not a member gets it (every course locked). "free_quiz"
// is a free account that has not taken the quiz, "free_offer" one that has
// and is at the offer. A run that starts "signedout" and taps Join free
// becomes a new free account and moves on as it goes (the quiz, the
// @username and photo, the offer, the week's set-up, a post), all of it
// kept in memory only.
//
// Which screen it opens on, simulator only: the launch argument
// -fixtureRoute <screen> (week, session/3, profile-setup?edit=photo). The
// simulator's "open this link" command cannot be used for that: iOS answers
// it with an "Open in Strive Elite?" box that stays on screen and covers
// every picture after it (the first simulator run, Nov 23 2026).
export const FIXTURE_STATES = ["ok", "consent", "onboarding", "membership", "pro_checkout", "setup", "locked", "free_quiz", "free_offer", "signedout"] as const;

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

// The screen the simulator run asked for, as a route the router takes, or
// null. Letters, digits, dashes and slashes, with at most one ?name=value.
export const FIXTURE_ROUTE = /^[A-Za-z0-9][A-Za-z0-9\-/]*(\?[A-Za-z]+=[A-Za-z0-9]+)?$/;

export function fixtureRoute(): string | null {
  let raw: unknown = null;
  try {
    if (Platform.OS === "ios") raw = Settings?.get?.("fixtureRoute");
  } catch {
    raw = null;
  }
  if (typeof raw !== "string" || !FIXTURE_ROUTE.test(raw)) return null;
  // A free tab is named with its group: the member tabs have a Courses
  // screen at the same address, and the run must open the free one.
  const first = raw.split(/[/?]/)[0];
  return now().free && FREE_TABS.has(first) ? `/(free)/${raw}` : `/${raw}`;
}
const FREE_TABS = new Set(["friends", "my-week", "courses", "me"]);

// Where the example account is. It starts as the run asked and, for a free
// account, moves on as the screens are used. Memory only.
type Live = {
  signedIn: boolean;
  free: boolean;
  stage: FreeStage;
  owed: ("username" | "photo")[];
  username: string | null;
  posted: boolean;
};
let live: Live | null = null;
const watchers = new Set<() => void>();

function now(): Live {
  if (!live) {
    const s = chosenState();
    const free = s === "locked" || s === "free_quiz" || s === "free_offer";
    live = {
      signedIn: s !== "signedout",
      free,
      stage: s === "free_quiz" ? "quiz" : s === "free_offer" ? "offer" : "ready",
      owed: s === "setup" ? ["username", "photo"] : [],
      username: s === "setup" ? null : "marcus.b",
      posted: false,
    };
  }
  return live;
}

function moved() {
  watchers.forEach((w) => w());
}

export function onFixtureChange(fn: () => void): () => void {
  watchers.add(fn);
  return () => void watchers.delete(fn);
}

export function fixtureSignedIn(): boolean {
  return now().signedIn;
}

// "Create my account" on the join screens: a new free account, at the quiz,
// that still owes its @username and its photo.
export function fixtureJoin(): void {
  live = { signedIn: true, free: true, stage: "quiz", owed: ["username", "photo"], username: null, posted: false };
  moved();
}

// The example sign-in: the member the run asked for.
export function fixtureSignIn(): void {
  now().signedIn = true;
  moved();
}

// A profile step saved on the example account.
export function fixtureProfileSaved(step: "username" | "photo", username?: string): void {
  const l = now();
  l.owed = l.owed.filter((s) => s !== step);
  if (step === "username" && username) l.username = username;
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
    // the badges' own titles and lines (lib/elite/achievement-rules.ts)
    { id: "a1", title: "10 Sessions", detail: "Ten full sessions in the bank" },
    { id: "a2", title: "Week Conquered", detail: "Every drill in a week, done" },
    { id: "a3", title: "First Session", detail: "Your first full session, done" },
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

// The Courses library: four of the real courses, cut short. The drills,
// their clips and stills are the real bank's and the words are the
// courses' own (supabase/migrations 041, 043, 044, 048 to 053, 057).
function courseDrill(id: string, title: string, file: string, more: Partial<AppCourseStep> = {}): AppCourseStep {
  return {
    id,
    kind: "drill",
    title,
    tag: null,
    cue: null,
    passMark: null,
    blocks: [],
    video: m(`/drills/${file}.mp4`),
    poster: m(`/drills/posters/${file}.jpg`),
    download: null,
    ...more,
  };
}

function coursePage(id: string, title: string, body: string): AppCourseStep {
  return { id, kind: "lesson", title, tag: null, cue: null, passMark: null, blocks: lessonBlocks(body), video: null, poster: null, download: null };
}

export const FIXTURE_COURSES: AppCourse[] = [
  {
    slug: "keep-it-up",
    name: "Keep It Up",
    subtitle: "The Juggling Ladder",
    kind: "drill",
    intro: [
      "Start at Level 1, even if you can already juggle.",
      "Pass the catch version, then work the keep it up version, then move up.",
      "A pass mark is in a row. A drop ends the attempt.",
      "Film the day you pass a level.",
    ],
    cover: m("/drills/posters/juggling-one-touch-catch.jpg"),
    levels: [
      {
        no: 1,
        label: "Level 1",
        name: "One touch",
        steps: [
          courseDrill("k11", "One touch, catch", "juggling-one-touch-catch", {
            tag: "beginner",
            cue: "Toe up, ankle locked, hit the middle of the ball.",
            passMark: "10 in a row",
          }),
          courseDrill("k12", "One touch, keep it up", "juggling-one-touch-keep-it-up", { tag: "advanced", cue: "Small touches, both feet." }),
        ],
      },
      {
        no: 2,
        label: "Level 2",
        name: "Two touches each foot",
        steps: [
          courseDrill("k21", "Two touches each foot, catch", "juggling-two-touches-each-foot-catch", {
            tag: "beginner",
            cue: "The first touch is small, the second one sends it to your chest for the catch.",
            passMark: "10 in a row",
          }),
          courseDrill("k22", "Two touches each foot, keep it up", "juggling-two-touches-each-foot-keep-it-up", {
            tag: "advanced",
            cue: "Small touches, stay on the balls of your feet.",
          }),
        ],
      },
    ],
  },
  {
    slug: "weak-foot",
    name: "Weak Foot",
    subtitle: "Both feet, no excuses.",
    kind: "drill",
    intro: [],
    cover: m("/drills/posters/weak-foot-tap-pull-push.jpg"),
    levels: [
      {
        no: 1,
        label: "Level 1",
        name: "Touches",
        steps: [
          courseDrill("w11", "Weak foot tap, pull, push", "weak-foot-tap-pull-push", { tag: "beginner" }),
          courseDrill("w12", "Weak foot outside pull, inside pull", "weak-foot-outside-pull-inside-pull", { tag: "advanced" }),
        ],
      },
      {
        no: 2,
        label: "Level 2",
        name: "Off the ground",
        steps: [
          courseDrill("w21", "Weak foot pop and settle", "weak-foot-pop-and-settle", { tag: "beginner" }),
          courseDrill("w22", "Weak foot pop and juggle", "weak-foot-pop-and-juggle", { tag: "advanced" }),
        ],
      },
    ],
  },
  {
    slug: "speed",
    name: "Speed",
    subtitle: "Explosive first steps and quick feet.",
    kind: "drill",
    intro: ["Warm up first, every time.", "Work one level at a time. Full rest between reps; speed is never tired work.", "Land soft, leave fast."],
    cover: m("/drills/posters/plyo-pogo-jumps.jpg"),
    levels: [
      {
        no: 1,
        label: "Level 1",
        name: "Warm-up",
        steps: [
          courseDrill("s11", "Pogo jumps", "plyo-pogo-jumps"),
          courseDrill("s12", "Lateral hops over object", "plyo-lateral-hops"),
          courseDrill("s13", "Broad jumps", "plyo-broad-jumps"),
        ],
      },
      {
        no: 2,
        label: "Level 2",
        name: "Technique",
        steps: [
          courseDrill("s21", "Stop and go", "speed-stop-and-go"),
          courseDrill("s22", "50%, 100%, 25%", "speed-50-100-25"),
          courseDrill("s23", "Sprint around the cones", "speed-sprint-around-the-cones"),
        ],
      },
    ],
  },
  {
    slug: "general-nutrition-guide",
    name: "General Nutrition Guide",
    subtitle: "Fuel for a training day, a match day, and the hours between.",
    kind: "lesson",
    intro: [
      "A guide, not a plan. General food guidance for a young player, nothing more.",
      "No calorie counts, no supplements, no weight targets. Allergies, a medical condition or anything about weight is a conversation with your doctor, not a page in an app.",
      "Ask us anything here. We will tell you what we know and when to ask someone else.",
    ],
    cover: m("/courses/general-nutrition-guide.jpg"),
    levels: [
      {
        no: 1,
        label: "Part 1",
        name: "Start here",
        steps: [
          coursePage(
            "n11",
            "Three rules",
            "Everything in this guide comes back to three things.\n\nEAT ENOUGH\nA player who trains four times a week and plays on the weekend needs more food than a kid who does not. Hungry is normal. Eat.\n\nEAT ON TIME\nThe same food at the wrong time is a heavy stomach at kickoff or an empty tank at the hour mark. The pages here are mostly about when.\n\nDRINK BEFORE YOU ARE THIRSTY\nBy the time you feel thirsty you are already behind. Water through the day, a bottle at every session.\n\nRULES OF THUMB\n\nThis is general guidance for healthy young players. It is not medical advice. Allergies, a condition, or any question about weight go to your doctor first.\n\nNothing here needs a supplement, a powder or a special product. Food from the grocery store does the job."
          ),
          coursePage(
            "n12",
            "The plate",
            "The simplest picture of a good meal, and it works for breakfast, lunch and dinner.\n\nHALF THE PLATE\nFruit and vegetables. Any kind, any color, cooked or raw. More color, more good.\n\nA QUARTER\nCarbs. Rice, pasta, potatoes, bread, oats, tortillas. This is the fuel for the session; players who cut carbs run out of gas.\n\nA QUARTER\nProtein. Chicken, fish, eggs, beef, beans, yogurt, tofu. This is what repairs the legs after the work.\n\nRULES OF THUMB\n\nOn a training day or a match day, the carb quarter grows. That is the only change.\n\nPortions: roughly your own fist for carbs, your own palm for protein. Hands grow with the player, so the portion does too.\n\nWater with the meal. Milk is fine. Soda and energy drinks are not food."
          ),
        ],
      },
      {
        no: 2,
        label: "Part 2",
        name: "A training day",
        steps: [
          coursePage(
            "n21",
            "Before training",
            "Train on a full tank, never a full stomach.\n\nTWO TO THREE HOURS BEFORE\nA normal meal from the plate. Lunch before an after-school session; dinner early before an evening one.\n\nTHIRTY TO SIXTY MINUTES BEFORE\nSomething small and mostly carbs. A banana. Toast with peanut butter or jam. A granola bar. Pretzels. A small bowl of cereal.\n\nRULES OF THUMB\n\nIf practice is straight after school, the snack in the bag matters more than anything else on this page. Pack it in the morning.\n\nNothing new and nothing heavy close to a session. Fried food, a big burger or a milkshake an hour before is a stomach ache, not fuel.\n\nWater with the snack, and the bottle goes to the session full."
          ),
        ],
      },
    ],
  },
];

// The shelf, as the server would cut it from those courses.
export function fixtureShelf(): AppCourseList {
  const locked = now().free;
  return {
    locked,
    courses: FIXTURE_COURSES.map((c) => ({ slug: c.slug, name: c.name, subtitle: c.subtitle, cover: c.cover, locked })),
  };
}

const COURSE_PATH = "/api/app/courses/";

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

// ---- The free app's example: Marcus and three friends -------------------
// Every picture is a still of one of our own drill clips, standing in for a
// profile photo or a training photo. Nobody here is a real person.
const ME_PHOTO = m("/drills/posters/juggling-one-touch-keep-it-up.jpg");
const FRIENDS = [
  { id: "f-diego", name: "Diego R.", first: "Diego", initials: "DR", photo: m("/drills/posters/weak-foot-pop-and-juggle.jpg"), minutes: 195, today: 75 },
  { id: "f-nico", name: "Nico A.", first: "Nico", initials: "NA", photo: m("/drills/posters/two-touch-ball-mastery-v1.jpg"), minutes: 150, today: 45 },
  { id: "f-jalen", name: "Jalen T.", first: "Jalen", initials: "JT", photo: m("/drills/posters/speed-kneel-and-drive.jpg"), minutes: 90, today: 0 },
] as const;
const MY_WEEK_MINUTES = 120;
const POST_MINUTES = 45;
const TARGET = 240;

export const FIXTURE_OFFER: Omit<AppOffer, "later"> = {
  card: { name: "Marcus B.", tier: "Pro" },
  headline: "Marcus, your first week goes after your weak foot and first touch.",
  drillsLabel: "Inside your first week",
  drills: [
    { poster: m("/drills/posters/weak-foot-tap-pull-push.jpg") },
    { poster: m("/drills/posters/two-touch-ball-mastery-v1.jpg") },
    { poster: m("/drills/posters/weak-foot-outside-pull-inside-pull.jpg") },
    { poster: m("/drills/posters/l-turn-roll-touch.jpg") },
  ],
  drillLocked: "A drill from your first week. It opens when you start.",
  gets: ["A new week every Monday, built around what you told us.", "One drill at a time, with the video.", "Every course is included."],
  price: "$29 a month. Cancel anytime.",
  start: "Start Strive Pro",
  terms: "Strive Pro is $29 a month, charged every month until you cancel. By starting you agree to the Terms of Service and the Privacy Policy.",
};

function fixtureFeed(): AppFreeFeed {
  const l = now();
  const open = (id: string, f: (typeof FRIENDS)[number], day: string, ago: string, minutes: number, file: string, caption: string | null, props: number): AppFeedCard => ({
    state: "open",
    id,
    ownerId: f.id,
    mine: false,
    name: f.name,
    first: f.first,
    initials: f.initials,
    kind: "training",
    minutes,
    caption,
    day,
    photoUrl: m(`/drills/posters/${file}.jpg`),
    ago,
    props,
    propped: false,
    together: null,
    starred: false,
    photo: f.photo,
  });
  const today: AppFeedCard[] = l.posted
    ? [
        {
          state: "open", id: "p-me", ownerId: "me", mine: true, name: "You", first: "You", initials: "MB", kind: "training", minutes: POST_MINUTES,
          caption: "Weak foot only.", day: "2026-11-24", photoUrl: m("/drills/posters/weak-foot-tap-pull-push.jpg"), ago: "Just now", props: 0, propped: false, together: null, starred: false, photo: ME_PHOTO,
        },
        open("p-diego", FRIENDS[0], "2026-11-24", "42 min ago", 75, "wall-pass-touch-stepover", "Wall work before school.", 2),
        open("p-nico", FRIENDS[1], "2026-11-24", "2h ago", 45, "l-turn-roll-touch", null, 1),
      ]
    : [
        { state: "locked", id: "p-diego", ownerId: FRIENDS[0].id, photo: FRIENDS[0].photo, first: "Diego", initials: "DR", kind: "training", minutes: 75 },
        { state: "locked", id: "p-nico", ownerId: FRIENDS[1].id, photo: FRIENDS[1].photo, first: "Nico", initials: "NA", kind: "training", minutes: 45 },
      ];
  const faces: Face[] = [
    { id: "me", first: "You", initials: "MB", you: true, active: l.posted, starred: false, photo: ME_PHOTO },
    ...FRIENDS.map((f) => ({ id: f.id, first: f.first, initials: f.initials, you: false, active: f.today > 0, starred: false, photo: f.photo })),
  ];
  const minutes = MY_WEEK_MINUTES + (l.posted ? POST_MINUTES : 0);
  return {
    date: "Tuesday, Nov 24",
    unlocked: l.posted,
    faces,
    friendCount: FRIENDS.length,
    friendsToday: 2,
    cards: [
      ...today,
      open("p-jalen-y", FRIENDS[2], "2026-11-23", "Yesterday", 60, "speed-zigzag-sprint", "Sprints at the park.", 3),
      open("p-diego-y", FRIENDS[0], "2026-11-23", "Yesterday", 60, "juggling-thighs-high", null, 1),
    ],
    requests: l.posted ? [] : [{ id: "r-kai", name: "Kai M.", initials: "KM" }],
    week: { minutes, target: TARGET, percent: Math.round((minutes / TARGET) * 100) },
    invite: "https://thestriveapp.com/join?ref=EXAMPLE2",
  };
}

function fixtureFreeWeek(): AppFreeWeek {
  const l = now();
  const minutes = MY_WEEK_MINUTES + (l.posted ? POST_MINUTES : 0);
  const days = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"];
  const letters = ["M", "T", "W", "T", "F", "S", "S"];
  const plan = [0, 1, 3, 5];
  return {
    today: "2026-11-24",
    label: "Nov 23 to Nov 29",
    minutes,
    gymMinutes: 30,
    target: TARGET,
    percent: Math.round((minutes / TARGET) * 100),
    planDays: plan,
    strip: days.map((day, index) => ({
      day,
      index,
      letter: letters[index],
      planned: plan.includes(index),
      trained: index === 0 || (index === 1 && l.posted),
      today: index === 1,
      minutes: index === 0 ? MY_WEEK_MINUTES : index === 1 && l.posted ? POST_MINUTES : 0,
    })),
    todayLine: l.posted ? { strong: "Trained today.", rest: "Next up: Thursday, about 1h." } : { strong: "Today is a training day.", rest: "About 1h." },
    splitLine: "4 days. About 1h a day.",
    gymLine: "Gym this week: 30m",
    entries: [
      ...(l.posted ? [{ id: "e-today", day: "2026-11-24", label: "Tue, Nov 24", minutes: POST_MINUTES, kind: "training" as const, photo: true }] : []),
      { id: "e-mon", day: "2026-11-23", label: "Mon, Nov 23", minutes: MY_WEEK_MINUTES, kind: "training" as const, photo: true },
      { id: "e-gym", day: "2026-11-23", label: "Mon, Nov 23", minutes: 30, kind: "gym" as const, photo: false },
    ],
    board: friendsBoard(
      [{ id: "me", name: "Marcus B.", minutes, photo: ME_PHOTO }, ...FRIENDS.map((f) => ({ id: f.id, name: f.name, minutes: f.minutes, photo: f.photo }))],
      "me"
    ),
    invite: "https://thestriveapp.com/join?ref=EXAMPLE2",
    upgrade: { area: "Weak foot", sessions: 4 },
  };
}

function fixtureFreeYou(): AppFreeYou {
  const minutes = MY_WEEK_MINUTES + (now().posted ? POST_MINUTES : 0);
  return {
    name: "Marcus B.",
    aura: { level: 3, label: auraLabel(3), progress: 0.4, next: "3h of training to Level 4" },
    weekMinutes: minutes,
    allMinutes: 420 + (now().posted ? POST_MINUTES : 0),
    gymLine: "Gym this week: 30m",
    starred: false,
    invite: "https://thestriveapp.com/join?ref=EXAMPLE2",
  };
}

const FIXTURE_PLAN: AppFreePlan = {
  recommended: TARGET,
  line: "We recommend 4 hours a week on your own, outside team training.",
  target: TARGET,
  days: [],
};

export function fixtureBootstrap(): AppBootstrap {
  const l = now();
  const state: AppMemberState = l.free ? { kind: "free", stage: l.stage } : stateFor(chosenState());
  const photo = l.owed.includes("photo") ? null : ME_PHOTO;
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
    player: l.free
      ? null
      : {
          id: "p-example",
          tier: "pro",
          card: FIXTURE_YOU.card,
          position: "Attacking midfield",
          knownParentPhone: "",
        },
    free: l.free ? { name: "Marcus B.", gym: true } : null,
    quizOwed: null,
    tabs: [
      { key: "home", label: "Home" },
      { key: "week", label: "Week" },
      { key: "courses", label: "Courses" },
      { key: "you", label: "You" },
    ],
    unread: 0,
    // ?state=setup: a member from before 081 who still owes both screens,
    // and a new free account until it has picked them. Everyone else has a
    // photo (a drill still standing in for one), so every card and every
    // face is drawn with it.
    profileSetup: {
      username: l.username,
      hasPhoto: photo !== null,
      photoUrl: photo,
      steps: [...l.owed],
      ideas: l.owed.includes("username") ? ["marcus.b", "marcusbryant", "marcus_b"] : [],
    },
  };
}

// The free app's calls, answered from the example and moved on by it.
function fixtureFree(path: string, method: string): unknown {
  const l = now();
  const at = path.slice("/api/app/free/".length);
  if (at === "open") return { open: true };
  if (at === "join") return { ok: true, signedIn: false };
  if (at === "intake") {
    l.stage = "offer";
    return { ok: true };
  }
  if (at === "offer") return { ...FIXTURE_OFFER, later: l.stage === "ready" ? "Not now" : "Not now, start free" } satisfies AppOffer;
  if (at === "plan") {
    if (method === "GET") return l.stage === "ready" ? { ...FIXTURE_PLAN, days: [0, 1, 3, 5] } : FIXTURE_PLAN;
    l.stage = "ready";
    return { ok: true };
  }
  if (at === "upgrade") return { ok: false, error: "Payments are not switched on yet, so Strive Pro cannot be started today. Check back soon." };
  if (at === "upgrade/confirm") return { active: false };
  if (at === "feed") return fixtureFeed();
  if (at === "post" || (at === "log" && method === "POST")) {
    if (at === "post") l.posted = true;
    return { ok: true, id: "e-today" };
  }
  if (at === "week") return fixtureFreeWeek();
  if (at === "you") return fixtureFreeYou();
  if (at === "props") return { ok: true, propped: true };
  return { ok: true };
}

// What each call answers with in the example build.
export function fixtureResponse(path: string, method: string, _body?: unknown): unknown {
  if (path.startsWith("/api/app/free/")) return fixtureFree(path, method);
  if (path.startsWith("/api/app/me")) return fixtureBootstrap();
  if (path.startsWith("/api/app/week")) return { week: FIXTURE_WEEK };
  if (path.startsWith("/api/app/you")) return { you: FIXTURE_YOU };
  if (path.startsWith("/api/app/extra")) return method === "GET" ? FIXTURE_EXTRA : { ok: true, session: 5 };
  if (path.startsWith("/api/app/drill")) return { ok: true, totalMinutes: FIXTURE_WEEK.totalMinutes };
  if (path.startsWith("/api/app/first-week")) return { status: "live", line: null };
  if (path.startsWith("/api/app/profile/username")) return { ok: true, name: "marcus.b" };
  if (path.startsWith(COURSE_PATH)) {
    const course = FIXTURE_COURSES.find((c) => c.slug === decodeURIComponent(path.slice(COURSE_PATH.length)));
    // as the server: a course that is not on the shelf is not found
    if (!course) throw Object.assign(new Error("not_found"), { status: 404 });
    return { course };
  }
  if (path.startsWith("/api/app/courses")) return fixtureShelf();
  return { ok: true };
}
