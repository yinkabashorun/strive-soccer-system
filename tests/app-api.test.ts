import { beforeEach, describe, expect, it, vi } from "vitest";

// The native iPhone app's JSON API (app/api/app/*). What is held here:
//   - nobody gets in without a well-formed bearer token that Supabase
//     verifies (the body is never trusted for who is calling)
//   - the demo tour is never an app session
//   - every route enforces the same member gate as the website, at the
//     access level the route declares
//   - bodies are checked before any shared action runs
//   - callers are rate limited
// The database and the shared actions are stood in for.

const TOKEN = "aaa.bbb.ccc";
type Viewer = {
  profile: { id: string; role: string; full_name: string; email: string; avatar_color: string };
  role: string;
  playerId: string | null;
  demo: boolean;
  setup: { available: boolean; username: string | null; hasPhoto: boolean; photoKey: string | null };
};
const s = {
  viewer: null as Viewer | null,
  player: null as Record<string, unknown> | null,
  consentDue: false,
  tracker: null as unknown,
  intake: null as unknown,
  carried: null as unknown,
  signupOpen: true,
  seenTokens: [] as (string | null)[],
  calls: [] as { fn: string; args: unknown[] }[],
  homeworkRow: { id: "", completed: true } as { id: string; completed: boolean } | null,
  // what the website's own tick action answers, and whether the database read fails
  toggle: { ok: true } as { ok: true } | { ok: false; again: boolean },
  readFails: false,
  courses: [] as Record<string, unknown>[],
  // clubs: is the club one of the caller's, and are the two one-time sheets accepted
  // whether a notification choice is stored
  prefsSave: true,
  clubFound: true,
  organizerOk: true,
  playerOk: true,
};

function player(over: Record<string, unknown> = {}) {
  return {
    id: "p1",
    full_name: "Marcus Bryant",
    tier: "pro",
    subscription_status: "active",
    onboarded_at: "2026-11-01T00:00:00Z",
    week1_monday: "2026-11-02",
    current_week: 1,
    has_wall: true,
    goals: ["Make the A team"],
    joined_at: "2026-11-01T00:00:00Z",
    position: "Winger",
    parent_phone: "",
    ...over,
  };
}
function viewer(over: Partial<Viewer> = {}): Viewer {
  return {
    profile: { id: "u1", role: "player", full_name: "Marcus Bryant", email: "m@example.com", avatar_color: "#000" },
    role: "player",
    playerId: "p1",
    demo: false,
    setup: { available: true, username: "marcus.b", hasPhoto: true, photoKey: "k" },
    ...over,
  };
}
function call(fn: string) {
  return async (...args: unknown[]) => {
    s.calls.push({ fn, args });
    if (fn === "toggleHomework") return s.toggle;
    if (fn === "completeOnboarding") return { ok: true };
    if (fn === "buildMyFirstWeek") return { status: "waiting" };
    if (fn === "submitCheckin") return { ok: true };
    if (fn === "addExtraSession" || fn === "addPickedExtraSession") return { ok: true, session: 5 };
    if (fn === "getExtraPicker") return { ok: true, groups: [], warmUpMinutes: 5, finisherMinutes: 0, example: false };
    if (fn === "deleteOwnAccount") return { error: null };
    if (fn === "changeMyPassword") return { error: null, done: true };
    if (fn === "recordConsent") return true;
    if (fn === "loadWeek") return { week: 1 };
    if (fn === "loadYou") return { allTimeMinutes: 0 };
    if (fn === "loadInbox") return { notices: [] };
    if (fn === "loadNoticePrefs") return { topics: [], reminder: null };
    if (fn === "saveNoticeTopic" || fn === "saveReminderChoice") {
      return s.prefsSave ? { ok: true, prefs: { topics: [], reminder: null } } : { ok: false, error: "That could not be saved. Try again in a minute." };
    }
    if (fn === "loadBootstrap") return { state: args[1] };
    if (fn === "startProFromFree") return { ok: true, url: "https://checkout.stripe.com/c/pay/cs_test_1" };
    if (fn === "confirmUpgrade") return { active: false };
    if (fn === "toggleProps") return { ok: true, propped: true };
    if (fn === "logTraining") return { ok: true, id: "l1" };
    if (fn === "appClubsFor") return { clubs: [], canStart: true };
    if (fn === "appClubPageFor" || fn === "appClubNearFor") return s.clubFound ? { id: args[1] } : null;
    if (fn === "appProfileFor") return s.clubFound ? { id: args[1] } : null;
    if (fn === "appBlockedFor") return { blocked: [] };
    if (fn === "startClubInApp") return s.organizerOk ? { ok: true, id: "c1", code: "ABCD2345" } : { ok: false, error: "needs_organizer_ok", needs: "organizer" };
    if (fn === "askToJoinByCode") return { ok: true, line: "Request sent. You are in Renegados FC once the captain lets you in." };
    if (fn === "newClubLink") return { ok: true, code: "NEWC2345" };
    if (fn === "planTraining" || fn === "planGame") return s.organizerOk ? { ok: true, id: "plan1" } : { ok: false, error: "needs_organizer_ok" };
    if (fn === "setImIn") return s.playerOk ? { ok: true } : { ok: false, error: "needs_player_ok" };
    if (fn === "enterScore") return { ok: false, error: "Only a captain of either club enters the score, once the game has started." };
    return { ok: true };
  };
}

// The Courses library as getCourses returns it: a drill course, a lesson
// course, a link course with pages of its own, one with none, and one
// that is switched off.
function library(): Record<string, unknown>[] {
  const step = (over: Record<string, unknown>) => ({
    id: "s",
    course_id: "c",
    level_no: 1,
    level_name: null,
    tag: null,
    drill_id: null,
    drill: null,
    title: null,
    body: null,
    video_url: null,
    download_url: null,
    cue: null,
    pass_mark: null,
    sort: 10,
    ...over,
  });
  const drill = (id: string, title: string, file: string | null, active = true) => ({ id, title, video_url: file, active });
  return [
    {
      id: "c1",
      slug: "keep-it-up",
      name: "Keep It Up",
      subtitle: "The juggling ladder.",
      intro: "Pass the catch version first.\nThen move up.",
      kind: "drill",
      external_url: null,
      cover_url: null,
      active: true,
      sort: 10,
      steps: [
        step({ id: "k1", level_name: "One touch", tag: "beginner", drill_id: "d1", drill: drill("d1", "Juggling: one touch, catch", "/drills/juggling-one-touch-catch.mp4"), cue: "Lock the ankle.", pass_mark: "10 in a row" }),
        step({ id: "k2", level_no: 2, level_name: "Two touches each foot", tag: "advanced", drill_id: "d2", drill: drill("d2", "Juggling: two touches each foot, keep it up", "https://files.example.com/clip.mp4") }),
        // not filmed, and switched off in the bank: never sent
        step({ id: "k3", level_no: 2, drill_id: "d3", drill: drill("d3", "Juggling: unfilmed", null) }),
        step({ id: "k4", level_no: 2, drill_id: "d4", drill: drill("d4", "Juggling: off", "/drills/juggling-head-it-up.mp4", false) }),
      ],
    },
    {
      id: "c2",
      slug: "college-recruiting",
      name: "College Recruiting",
      subtitle: "The college route, part by part.",
      intro: null,
      kind: "lesson",
      external_url: null,
      cover_url: "/courses/college-recruiting.jpg",
      active: true,
      sort: 20,
      steps: [
        step({ id: "l1", level_name: "The CV", title: "The one-page CV", body: "One page.\n\nTEMPLATE\n[Full name]\n[Graduation year]\n\nRULES OF THUMB\n\nFacts only.", download_url: "/downloads/cv.pdf" }),
      ],
    },
    {
      id: "c3",
      slug: "dribbling-transformation",
      name: "Dribbling Transformation",
      subtitle: "Most dangerous dribbler on the team.",
      intro: "The password is on this page.",
      kind: "link",
      external_url: "https://course.example.com/",
      cover_url: null,
      active: true,
      sort: 15,
      steps: [step({ id: "t1", level_name: "Start here", title: "Welcome", body: "Train five days a week." })],
    },
    { id: "c4", slug: "outside-only", name: "Outside Only", subtitle: null, intro: "pw", kind: "link", external_url: "https://course.example.com/x", cover_url: null, active: true, sort: 30, steps: [] },
    {
      id: "c5",
      slug: "not-yet",
      name: "Not Yet",
      subtitle: null,
      intro: null,
      kind: "lesson",
      external_url: null,
      cover_url: null,
      active: false,
      sort: 40,
      steps: [step({ id: "n1", title: "Soon", body: "Soon." })],
    },
  ];
}

vi.mock("@/lib/elite/session", async () => {
  const { bearerToken } = await import("@/lib/elite/supabase/bearer");
  return {
    getViewer: async () => {
      s.seenTokens.push(bearerToken());
      return s.viewer;
    },
  };
});
vi.mock("@/lib/elite/data", () => ({
  getPlayer: async () => s.player,
  // as the real getters: active courses for the shelf, any course by its slug
  getCourses: async () => (s.calls.push({ fn: "getCourses", args: [] }), s.courses.filter((c) => c.active)),
  getCourse: async (slug: string) => (s.calls.push({ fn: "getCourse", args: [slug] }), s.courses.find((c) => c.slug === slug) ?? null),
  getHomework: async () => [
    { id: "h1", week: 1, completed: true, duration_min: 20, title: "x", exercise: "", reps: "", video_url: null, notes: null, completed_at: null, sort: 0, player_id: "p1" },
  ],
}));
vi.mock("@/lib/elite/legal-server", () => ({
  consentDue: async () => s.consentDue,
  recordConsent: call("recordConsent"),
}));
vi.mock("@/lib/elite/tracker-server", () => ({
  getTracker: async () => s.tracker,
  getTargetTable: async () => [],
  isFreeSignupOpen: async () => s.signupOpen,
}));
// the quiz a free account takes: its rules are real, its reads and writes stood in for
vi.mock("@/lib/elite/free-intake-server", async (actual) => ({
  ...(await actual<typeof import("@/lib/elite/free-intake-server")>()),
  readIntake: async () => s.intake ?? { available: false, answers: null, checkout: null },
  intakeColumnsReady: async () => true,
  saveFreeIntake: call("saveFreeIntake"),
  saveFreePlan: call("saveFreePlan"),
}));
vi.mock("@/lib/elite/free-app-server", () => ({
  offerFor: call("offerFor"),
  planFor: call("planFor"),
  freeFeedFor: call("freeFeedFor"),
  freeWeekFor: call("freeWeekFor"),
  freeYouFor: call("freeYouFor"),
  appProfileFor: call("appProfileFor"),
  appBlockedFor: call("appBlockedFor"),
}));
vi.mock("@/lib/elite/free-upgrade-server", () => ({
  startProFromFree: call("startProFromFree"),
  confirmUpgrade: call("confirmUpgrade"),
  memberAnswersFor: async () => s.carried,
}));
vi.mock("@/lib/elite/tracker-actions", () => ({
  logTraining: call("logTraining"),
  deleteLog: call("deleteLog"),
  toggleProps: call("toggleProps"),
  reportPost: call("reportPost"),
  blockPlayer: call("blockPlayer"),
  unblockPlayer: call("unblockPlayer"),
  removeFriend: call("removeFriend"),
  reportLine: call("reportLine"),
  answerFriendRequest: call("answerFriendRequest"),
  // clubs, for a member and for the captain
  leaveClub: call("leaveClub"),
  reportClub: call("reportClub"),
  renameMyClub: call("renameMyClub"),
  removeClubMember: call("removeClubMember"),
  newClubLink: call("newClubLink"),
  endMyClub: call("endMyClub"),
  answerClubRequest: call("answerClubRequest"),
}));
vi.mock("@/lib/elite/club-app-server", () => ({
  appClubsFor: call("appClubsFor"),
  appClubPageFor: call("appClubPageFor"),
  appClubNearFor: call("appClubNearFor"),
  startClubInApp: call("startClubInApp"),
  askToJoinByCode: call("askToJoinByCode"),
}));
vi.mock("@/lib/elite/club-teams-actions", () => ({
  setClubCounty: call("setClubCounty"),
  acceptPlayTerms: call("acceptPlayTerms"),
  planTraining: call("planTraining"),
  planGame: call("planGame"),
  answerGame: call("answerGame"),
  cancelPlan: call("cancelPlan"),
  setImIn: call("setImIn"),
  enterScore: call("enterScore"),
  answerScore: call("answerScore"),
  reportPlan: call("reportPlan"),
}));
vi.mock("@/app/api/elite/auth/join/route", () => ({
  POST: async () => (s.calls.push({ fn: "join", args: [] }), new Response(JSON.stringify({ ok: true, signedIn: true }), { status: 200 })),
}));
vi.mock("@/app/api/elite/tracker/post/route", () => ({
  POST: async () => (s.calls.push({ fn: "storePost", args: [] }), new Response(JSON.stringify({ ok: true, id: "l1" }), { status: 200 })),
}));
vi.mock("@/lib/elite/player-actions", () => ({
  markAllNotificationsRead: call("markAllNotificationsRead"),
  toggleHomework: call("toggleHomework"),
  submitCheckin: call("submitCheckin"),
  completeOnboarding: call("completeOnboarding"),
}));
vi.mock("@/lib/elite/extra-actions", () => ({
  addExtraSession: call("addExtraSession"),
  addPickedExtraSession: call("addPickedExtraSession"),
  getExtraPicker: call("getExtraPicker"),
}));
vi.mock("@/lib/elite/bank-conform", () => ({
  EXTRA_SHELVES: {
    ball_mastery: { label: "Ball Mastery", blurb: "" },
    wall_work: { label: "Wall Work", blurb: "" },
    one_v_one: { label: "1v1 Skills", blurb: "" },
  },
}));
vi.mock("@/lib/elite/first-week-actions", () => ({ buildMyFirstWeek: call("buildMyFirstWeek") }));
vi.mock("@/lib/elite/account-delete", () => ({ deleteOwnAccount: call("deleteOwnAccount") }));
vi.mock("@/lib/elite/account-actions", () => ({ changeMyPassword: call("changeMyPassword") }));
vi.mock("@/lib/elite/app-data", () => ({
  loadWeek: call("loadWeek"),
  loadYou: call("loadYou"),
  loadBootstrap: call("loadBootstrap"),
  loadInbox: call("loadInbox"),
}));
// the notification choices: the savers answer for themselves (their own
// rules are held in tests/notices.test.ts)
vi.mock("@/lib/elite/notice-prefs-server", () => ({
  loadNoticePrefs: call("loadNoticePrefs"),
  saveNoticeTopic: call("saveNoticeTopic"),
  saveReminderChoice: call("saveReminderChoice"),
}));
vi.mock("@/app/api/elite/push/native/route", () => ({
  POST: async () => {
    s.calls.push({ fn: "savePushToken", args: [] });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  },
  DELETE: async () => {
    s.calls.push({ fn: "removePushToken", args: [] });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  },
}));
vi.mock("@/lib/elite/profile-actions", () => ({
  checkUsername: async (n: string) => (s.calls.push({ fn: "checkUsername", args: [n] }), { ok: true, name: n }),
  saveUsername: async (n: string) => (s.calls.push({ fn: "saveUsername", args: [n] }), { ok: true, name: n }),
  myUsernameIdeas: async () => ["marcus.b"],
}));
vi.mock("@/app/api/elite/profile/photo/route", () => ({
  GET: async () => (s.calls.push({ fn: "readPhoto", args: [] }), new Response("jpeg", { status: 200 })),
  POST: async () => (s.calls.push({ fn: "storePhoto", args: [] }), new Response(JSON.stringify({ ok: true }), { status: 200 })),
}));
vi.mock("@/lib/elite/supabase/server", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => (s.readFails ? { data: null, error: { code: "57014" } } : { data: s.homeworkRow, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

let ip = 0;
function req(method: string, opts: { auth?: string | null; body?: unknown } = {}) {
  const headers: Record<string, string> = { "x-forwarded-for": `10.0.${Math.floor(ip / 250)}.${ip++ % 250}` };
  if (opts.auth !== null) headers.authorization = opts.auth ?? `Bearer ${TOKEN}`;
  return new Request("https://thestriveapp.com/api/app/x", {
    method,
    headers,
    body: opts.body === undefined || method === "GET" ? undefined : JSON.stringify(opts.body),
  });
}

const ROUTES = {
  me: () => import("@/app/api/app/me/route"),
  week: () => import("@/app/api/app/week/route"),
  you: () => import("@/app/api/app/you/route"),
  drill: () => import("@/app/api/app/drill/route"),
  extra: () => import("@/app/api/app/extra/route"),
  checkin: () => import("@/app/api/app/checkin/route"),
  onboarding: () => import("@/app/api/app/onboarding/route"),
  firstWeek: () => import("@/app/api/app/first-week/route"),
  consent: () => import("@/app/api/app/consent/route"),
  pushToken: () => import("@/app/api/app/push-token/route"),
  accountDelete: () => import("@/app/api/app/account/delete/route"),
  accountPassword: () => import("@/app/api/app/account/password/route"),
  username: () => import("@/app/api/app/profile/username/route"),
  photo: () => import("@/app/api/app/profile/photo/route"),
  freeIntake: () => import("@/app/api/app/free/intake/route"),
  freeOffer: () => import("@/app/api/app/free/offer/route"),
  freePlan: () => import("@/app/api/app/free/plan/route"),
  freeUpgrade: () => import("@/app/api/app/free/upgrade/route"),
  freeUpgradeConfirm: () => import("@/app/api/app/free/upgrade/confirm/route"),
  freeFeed: () => import("@/app/api/app/free/feed/route"),
  freePost: () => import("@/app/api/app/free/post/route"),
  freeLog: () => import("@/app/api/app/free/log/route"),
  freeProps: () => import("@/app/api/app/free/props/route"),
  freeReport: () => import("@/app/api/app/free/report/route"),
  freeBlock: () => import("@/app/api/app/free/block/route"),
  freeFriend: () => import("@/app/api/app/free/friend/route"),
  freeWeek: () => import("@/app/api/app/free/week/route"),
  freeYou: () => import("@/app/api/app/free/you/route"),
  freeProfile: () => import("@/app/api/app/free/profile/[id]/route"),
  freeBlocked: () => import("@/app/api/app/free/blocked/route"),
  courses: () => import("@/app/api/app/courses/route"),
  course: () => import("@/app/api/app/courses/[slug]/route"),
  notices: () => import("@/app/api/app/notices/route"),
  noticePrefs: () => import("@/app/api/app/notices/prefs/route"),
  // clubs, in the free app
  freeClubs: () => import("@/app/api/app/free/clubs/route"),
  freeClubJoin: () => import("@/app/api/app/free/clubs/join/route"),
  freeClub: () => import("@/app/api/app/free/clubs/[id]/route"),
  freeClubNear: () => import("@/app/api/app/free/clubs/[id]/near/route"),
  freeClubPlans: () => import("@/app/api/app/free/plans/route"),
  freeClubPlan: () => import("@/app/api/app/free/plans/[id]/route"),
  freePlayTerms: () => import("@/app/api/app/free/play-terms/route"),
};
// The two routes nobody is signed in for yet.
const PUBLIC = {
  freeOpen: () => import("@/app/api/app/free/open/route"),
  freeJoin: () => import("@/app/api/app/free/join/route"),
};

type Access = "account" | "player" | "member" | "person" | "free" | "free_only" | "free_app";

// Every handler, its method and the access level it must declare.
const TABLE: { route: keyof typeof ROUTES; method: "GET" | "POST" | "DELETE"; access: Access }[] = [
  { route: "me", method: "GET", access: "account" },
  { route: "week", method: "GET", access: "member" },
  { route: "you", method: "GET", access: "member" },
  { route: "drill", method: "POST", access: "member" },
  { route: "extra", method: "GET", access: "member" },
  { route: "extra", method: "POST", access: "member" },
  { route: "checkin", method: "POST", access: "member" },
  { route: "onboarding", method: "POST", access: "player" },
  { route: "firstWeek", method: "POST", access: "player" },
  { route: "consent", method: "POST", access: "account" },
  { route: "pushToken", method: "POST", access: "person" },
  { route: "pushToken", method: "DELETE", access: "person" },
  { route: "accountDelete", method: "POST", access: "account" },
  { route: "accountPassword", method: "POST", access: "account" },
  { route: "username", method: "GET", access: "person" },
  { route: "username", method: "POST", access: "person" },
  { route: "photo", method: "GET", access: "person" },
  { route: "photo", method: "POST", access: "person" },
  // the free app
  { route: "freeIntake", method: "POST", access: "free_only" },
  { route: "freeOffer", method: "GET", access: "free_only" },
  { route: "freePlan", method: "GET", access: "free" },
  { route: "freePlan", method: "POST", access: "free" },
  { route: "freeUpgrade", method: "POST", access: "free_only" },
  { route: "freeUpgradeConfirm", method: "POST", access: "account" },
  { route: "freeFeed", method: "GET", access: "free_app" },
  { route: "freePost", method: "POST", access: "free_app" },
  { route: "freeLog", method: "POST", access: "free_app" },
  { route: "freeLog", method: "DELETE", access: "free_app" },
  { route: "freeProps", method: "POST", access: "free_app" },
  { route: "freeReport", method: "POST", access: "free_app" },
  { route: "freeBlock", method: "POST", access: "free_app" },
  { route: "freeFriend", method: "POST", access: "free_app" },
  { route: "freeWeek", method: "GET", access: "free_app" },
  { route: "freeYou", method: "GET", access: "free_app" },
  { route: "freeProfile", method: "GET", access: "free_app" },
  { route: "freeProfile", method: "POST", access: "free_app" },
  { route: "freeBlocked", method: "GET", access: "free_app" },
  { route: "freeBlocked", method: "POST", access: "free_app" },
  { route: "courses", method: "GET", access: "account" },
  { route: "course", method: "GET", access: "member" },
  // the Inbox is a member's; the notification choices are anyone's own
  { route: "notices", method: "GET", access: "member" },
  { route: "notices", method: "POST", access: "member" },
  { route: "noticePrefs", method: "GET", access: "person" },
  { route: "noticePrefs", method: "POST", access: "person" },
  // clubs: only ever an account in the free app
  { route: "freeClubs", method: "GET", access: "free_app" },
  { route: "freeClubs", method: "POST", access: "free_app" },
  { route: "freeClubJoin", method: "POST", access: "free_app" },
  { route: "freeClub", method: "GET", access: "free_app" },
  { route: "freeClub", method: "POST", access: "free_app" },
  { route: "freeClubNear", method: "GET", access: "free_app" },
  { route: "freeClubPlans", method: "POST", access: "free_app" },
  { route: "freeClubPlan", method: "POST", access: "free_app" },
  { route: "freePlayTerms", method: "POST", access: "free_app" },
];
const FOR_FREE = new Set<Access>(["free", "free_only", "free_app"]);

// A free account in the free app: its week is set, its quiz is stored.
const ANSWERS = {
  gender: "boy",
  grade: "high_school",
  position: "Winger",
  foot: "Right",
  level: "Competitive",
  club: "",
  attrs: {
    first_touch: 3, close_control: 4, weak_foot: 1, dribbling: 4, short_passing: 3, long_passing: 3, shooting: 4,
    speed: 4, agility: 4, strength: 3, fitness: 4, scanning: 3, decisions: 3, movement: 4, defending: 3,
  },
  aim: "higher_team",
  team: "3-4",
  space: "open",
  wall: true,
  goal: false,
  nearbyAnswered: true,
};
function freeAccount(over: Record<string, unknown> = {}) {
  s.viewer = viewer({ playerId: null });
  s.player = null;
  s.tracker = { profile_id: "u1", grade: "high_school", season: "in_season", target_minutes: 240, plan_days: [0, 2], quiz_done_at: "2026-11-24T00:00:00Z", referral_code: "ABCDEFGH", ...over };
  s.intake = { available: true, answers: ANSWERS, checkout: null };
}

async function handler(route: keyof typeof ROUTES, method: string) {
  const mod = (await ROUTES[route]()) as unknown as Record<string, (r: Request, ctx?: unknown) => Promise<Response>>;
  return mod[method];
}

beforeEach(() => {
  s.prefsSave = true;
  s.viewer = viewer();
  s.player = player();
  s.consentDue = false;
  s.tracker = null;
  s.intake = null;
  s.carried = null;
  s.signupOpen = true;
  s.seenTokens = [];
  s.calls = [];
  s.homeworkRow = { id: "11111111-1111-4111-8111-111111111111", completed: true };
  s.toggle = { ok: true };
  s.readFails = false;
  s.courses = library();
  s.clubFound = true;
  s.organizerOk = true;
  s.playerOk = true;
});

describe("the bearer token", () => {
  it("parses only a Bearer JWT", async () => {
    const { parseBearer } = await import("@/lib/elite/supabase/bearer");
    expect(parseBearer(`Bearer ${TOKEN}`)).toBe(TOKEN);
    expect(parseBearer(`bearer ${TOKEN}`)).toBe(TOKEN);
    expect(parseBearer(TOKEN)).toBeNull();
    expect(parseBearer("Bearer not-a-jwt")).toBeNull();
    expect(parseBearer("Basic dXNlcjpwYXNz")).toBeNull();
    expect(parseBearer(`Bearer ${"a".repeat(3000)}.${"b".repeat(1100)}.c`)).toBeNull();
    expect(parseBearer(null)).toBeNull();
  });

  it("is seen by getViewer only inside the request", async () => {
    const { runWithBearer, bearerToken } = await import("@/lib/elite/supabase/bearer");
    expect(bearerToken()).toBeNull();
    await runWithBearer(TOKEN, async () => {
      await Promise.resolve();
      expect(bearerToken()).toBe(TOKEN);
    });
    expect(bearerToken()).toBeNull();
  });
});

describe("every route", () => {
  for (const row of TABLE) {
    const label = `${row.method} ${row.route}`;

    it(`${label}: refuses a request with no token or a malformed one`, async () => {
      const h = await handler(row.route, row.method);
      expect((await h(req(row.method, { auth: null }))).status).toBe(401);
      expect((await h(req(row.method, { auth: "Bearer nope" }))).status).toBe(401);
      expect(s.calls).toEqual([]);
    });

    it(`${label}: refuses a token Supabase does not verify, and the demo tour`, async () => {
      const h = await handler(row.route, row.method);
      s.viewer = null;
      expect((await h(req(row.method))).status).toBe(401);
      s.viewer = viewer({ demo: true });
      expect((await h(req(row.method))).status).toBe(401);
      expect(s.calls).toEqual([]);
    });

    it(`${label}: resolves the viewer from the header, never anything else`, async () => {
      const h = await handler(row.route, row.method);
      await h(req(row.method, { body: {} }));
      expect(s.seenTokens).toEqual([TOKEN]);
    });

    it(`${label}: keeps a coach out unless the route is for any account`, async () => {
      const h = await handler(row.route, row.method);
      s.viewer = viewer({ role: "coach", playerId: null });
      const res = await h(req(row.method, { body: {} }));
      if (row.access === "account") expect(res.status).not.toBe(403);
      else {
        expect(res.status).toBe(403);
        expect((await res.json()).state.kind).toBe("coach");
      }
    });

    it(`${label}: while the agreement is due, only account routes answer`, async () => {
      const h = await handler(row.route, row.method);
      s.consentDue = true;
      const res = await h(req(row.method, { body: {} }));
      if (row.access === "account") expect(res.status).not.toBe(403);
      else {
        expect(res.status).toBe(403);
        expect((await res.json()).state.kind).toBe("consent");
      }
    });

    it(`${label}: a membership not switched on reaches only account and player routes`, async () => {
      const h = await handler(row.route, row.method);
      s.player = player({ tier: "elite", subscription_status: "none" });
      const res = await h(req(row.method, { body: {} }));
      if (row.access === "member" || FOR_FREE.has(row.access)) {
        expect(res.status).toBe(403);
        expect((await res.json()).state.kind).toBe("membership");
      } else expect(res.status).not.toBe(403);
    });

    it(`${label}: a free account reaches its own routes and no member route`, async () => {
      const h = await handler(row.route, row.method);
      freeAccount();
      const res = await h(req(row.method, { body: {} }));
      if (row.access === "player" || row.access === "member") {
        expect(res.status).toBe(403);
        expect((await res.json()).state).toEqual({ kind: "free", stage: "ready" });
        expect(s.calls).toEqual([]);
      } else expect(res.status).not.toBe(403);
    });

    it(`${label}: the free app itself opens only once the week is set and the photo and username are in`, async () => {
      const h = await handler(row.route, row.method);
      // the quiz is answered, the week is not set yet: the offer and the set-up only
      freeAccount({ quiz_done_at: null, plan_days: [] });
      let res = await h(req(row.method, { body: {} }));
      if (row.access === "free_app") expect((await res.json()).state).toEqual({ kind: "free", stage: "offer" });
      expect(res.status === 403).toBe(row.access === "free_app" || row.access === "player" || row.access === "member");
      // the photo or the username is still owed
      freeAccount();
      s.viewer = { ...s.viewer!, setup: { available: true, username: null, hasPhoto: false, photoKey: null } };
      res = await h(req(row.method, { body: {} }));
      expect(res.status === 403).toBe(row.access === "free_app" || row.access === "player" || row.access === "member");
      // the quiz cannot be stored yet (082 not applied): the free app is the website's
      freeAccount();
      s.intake = { available: false, answers: null, checkout: null };
      res = await h(req(row.method, { body: {} }));
      expect(res.status === 403).toBe(FOR_FREE.has(row.access) || row.access === "player" || row.access === "member");
    });
  }
});

describe("nobody is signed in yet", () => {
  it("says whether free sign-up is open, from the coaches' own switch", async () => {
    const { GET } = await PUBLIC.freeOpen();
    const ask = () => GET(new Request("https://thestriveapp.com/api/app/free/open", { headers: { "x-forwarded-for": `11.0.0.${ip++ % 250}` } }));
    expect(await (await ask()).json()).toEqual({ open: true });
    s.signupOpen = false;
    const closed = await ask();
    expect(await closed.json()).toEqual({ open: false });
    expect(closed.headers.get("cache-control")).toContain("no-store");
    expect(s.seenTokens).toEqual([]); // no viewer is resolved
  });

  it("joining free is the website's own route, and is rate limited", async () => {
    const { POST } = await PUBLIC.freeJoin();
    const join = () =>
      POST(new Request("https://thestriveapp.com/api/app/free/join", { method: "POST", headers: { "x-forwarded-for": "12.12.12.12" }, body: "{}" }));
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await join()).status);
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429]);
    expect(s.calls.filter((c) => c.fn === "join")).toHaveLength(10);
    const src = (await import("node:fs")).readFileSync("app/api/app/free/join/route.ts", "utf8");
    expect(src).toContain('import { POST as join } from "@/app/api/elite/auth/join/route"');
  });
});

describe("a free account stays free until a membership is on", () => {
  it("a Strive Pro row that is not switched on does not take the free app away", async () => {
    const { memberState, livesInFreeApp, mayBeFree } = await import("@/lib/elite/member-gate");
    const base = { role: "player" as const, playerId: "p1", isFree: true, freeStage: "ready" as const, consentDue: false };
    // tapped Start, has not paid: still free
    expect(memberState({ ...base, player: player({ subscription_status: "none", onboarded_at: null }) })).toEqual({ kind: "free", stage: "ready" });
    // Strive Pro ended: back in the free app
    expect(memberState({ ...base, player: player({ subscription_status: "canceled" }) }).kind).toBe("free");
    // paid: a member, at the quiz (only what is still owed is asked)
    expect(memberState({ ...base, player: player({ subscription_status: "active", onboarded_at: null }) }).kind).toBe("onboarding");
    expect(memberState({ ...base, player: player() }).kind).toBe("ok");
    // with no free account behind it, a Strive Pro row that has not paid is the checkout, as before
    expect(memberState({ ...base, isFree: false, player: player({ subscription_status: "none" }) }).kind).toBe("pro_checkout");
    // an Elite family is never read as a free account
    expect(mayBeFree(player({ tier: "elite", subscription_status: "none" }))).toBe(false);
    expect(mayBeFree(player({ subscription_status: "active" }))).toBe(false);
    expect(mayBeFree(player({ subscription_status: "none" }))).toBe(true);
    expect(livesInFreeApp({ hasTracker: false, hasPlayer: false, player: null })).toBe(false);
    expect(livesInFreeApp({ hasTracker: true, hasPlayer: false, player: null })).toBe(true);
    expect(livesInFreeApp({ hasTracker: true, hasPlayer: true, player: player() })).toBe(false);
  });

  it("the app API reads it the same way", async () => {
    freeAccount();
    s.viewer = viewer(); // the member row exists now
    s.player = player({ subscription_status: "none", onboarded_at: null });
    const feed = await (await handler("freeFeed", "GET"))(req("GET"));
    expect(feed.status).toBe(200);
    const week = await (await handler("week", "GET"))(req("GET"));
    expect(week.status).toBe(403);
    expect((await week.json()).state.kind).toBe("free");
    // once paid, the member routes open AND the free routes stay open:
    // Strive Pro adds to the free app, it never takes it away (one-app.ts)
    s.player = player({ subscription_status: "active" });
    expect((await (await handler("freeFeed", "GET"))(req("GET"))).status).toBe(200);
    expect((await (await handler("week", "GET"))(req("GET"))).status).toBe(200);
  });

  it("the website's member shell and its free shell use the same rule", async () => {
    const { readFileSync } = await import("node:fs");
    const layout = readFileSync("app/(player)/layout.tsx", "utf8");
    expect(layout).toContain("mayHaveFreeApp(player) ? await getTracker(viewer.profile.id) : null");
    expect(layout).toContain('if (state.kind === "free" && freeAccount) redirect(freeLanding(quizDone(freeAccount)));');
    expect(readFileSync("lib/elite/tracker-server.ts", "utf8")).toContain("livesInFreeApp({ hasTracker: true, hasPlayer: true, player })");
  });
});

describe("the gate, one rule with the website", () => {
  it("runs in the web member shell's order", async () => {
    const { memberState } = await import("@/lib/elite/member-gate");
    const base = { role: "player" as const, playerId: "p1", isFree: false, consentDue: false, player: player() };
    expect(memberState({ ...base, role: "coach" }).kind).toBe("coach");
    expect(memberState({ ...base, playerId: null, isFree: true }).kind).toBe("free");
    expect(memberState({ ...base, playerId: null }).kind).toBe("no_profile");
    // the agreement comes before everything else for a member
    expect(memberState({ ...base, consentDue: true, player: player({ onboarded_at: null, subscription_status: "none" }) }).kind).toBe("consent");
    // Pro pays before the quiz
    expect(memberState({ ...base, player: player({ onboarded_at: null, subscription_status: "none" }) }).kind).toBe("pro_checkout");
    // an Elite family takes the quiz before the coach switches them on
    expect(memberState({ ...base, player: player({ tier: "elite", onboarded_at: null, subscription_status: "none" }) }).kind).toBe("onboarding");
    expect(memberState({ ...base, player: player({ tier: "elite", subscription_status: "paused" }) }).kind).toBe("membership");
    // before 012 (no column) nobody is trapped in the quiz
    expect(memberState({ ...base, player: player({ onboarded_at: undefined }) }).kind).toBe("ok");
    expect(memberState(base).kind).toBe("ok");
  });

  it("is the rule the web member shell uses", async () => {
    const { readFileSync } = await import("node:fs");
    const layout = readFileSync("app/(player)/layout.tsx", "utf8");
    expect(layout).toContain("memberState(");
    expect(layout).not.toContain("gateFor(");
  });
});

describe("bodies are checked first", () => {
  it("drill: needs a uuid and a boolean, and the row must be the member's own", async () => {
    const h = await handler("drill", "POST");
    expect((await h(req("POST", { body: { id: "x", completed: true } }))).status).toBe(400);
    expect((await h(req("POST", { body: { id: s.homeworkRow!.id } }))).status).toBe(400);
    expect(s.calls).toEqual([]);
    const ok = await h(req("POST", { body: { id: s.homeworkRow!.id, completed: true } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, completed: true, totalMinutes: 20 });
    // not the member's row: nothing is written, and asking again will not help
    s.calls = [];
    s.homeworkRow = null;
    expect((await h(req("POST", { body: { id: "11111111-1111-4111-8111-111111111111", completed: true } }))).status).toBe(404);
    expect(s.calls).toEqual([]);
  });

  // The phone keeps a tick and sends it until it is answered
  // (mobile/src/outbox.ts). The status tells it which of two things a
  // failure was: 503 "ask again" or 4xx "asking again will not change it".
  it("drill: says whether a tick that did not save is worth sending again", async () => {
    const h = await handler("drill", "POST");
    const body = { id: s.homeworkRow!.id, completed: true };
    s.toggle = { ok: false, again: true }; // the database was busy
    expect((await h(req("POST", { body }))).status).toBe(503);
    s.toggle = { ok: false, again: false }; // a guard in the database said no
    expect((await h(req("POST", { body }))).status).toBe(409);
    s.toggle = { ok: true };
    s.homeworkRow = { id: body.id, completed: false }; // written, but the row reads otherwise
    expect((await h(req("POST", { body }))).status).toBe(409);
    s.readFails = true; // the row could not be read at all
    expect((await h(req("POST", { body }))).status).toBe(503);
  });

  it("drill: the same tick twice gets the same answer", async () => {
    const h = await handler("drill", "POST");
    const body = { id: s.homeworkRow!.id, completed: true };
    const a = await (await h(req("POST", { body }))).json();
    const b = await (await h(req("POST", { body }))).json();
    expect(b).toEqual(a);
  });

  it("extra: a shelf it knows, or a list of picks", async () => {
    const h = await handler("extra", "POST");
    expect((await h(req("POST", { body: { shelf: "anything" } }))).status).toBe(400);
    expect((await h(req("POST", { body: {} }))).status).toBe(400);
    expect((await h(req("POST", { body: { shelf: "ball_mastery" } }))).status).toBe(200);
    expect((await h(req("POST", { body: { drillIds: ["a"] } }))).status).toBe(200);
    expect(s.calls.map((c) => c.fn)).toEqual(["addExtraSession", "addPickedExtraSession"]);
  });

  it("extra: Wall Work is offered only to a player with a wall", async () => {
    const h = await handler("extra", "GET");
    s.player = player({ has_wall: false });
    const body = await (await h(req("GET"))).json();
    expect(body.shelves.map((x: { key: string }) => x.key)).toEqual(["ball_mastery", "one_v_one"]);
  });

  it("checkin: something about the week, ratings 1 to 5 only", async () => {
    const h = await handler("checkin", "POST");
    expect((await h(req("POST", { body: { rating: 9 } }))).status).toBe(400);
    expect((await h(req("POST", { body: { rating: 4, went_well: "x".repeat(5000) } }))).status).toBe(200);
    const input = s.calls[0].args[0] as { rating: number; went_well: string };
    expect(input.rating).toBe(4);
    expect(input.went_well.length).toBe(1000);
  });

  it("onboarding: only while the quiz is due, and every question answered", async () => {
    const h = await handler("onboarding", "POST");
    expect((await h(req("POST", { body: { answers: {} } }))).status).toBe(409); // already onboarded
    s.player = player({ tier: "elite", subscription_status: "none", onboarded_at: null });
    const res = await h(req("POST", { body: { answers: { gender: "boy" } } }));
    expect(res.status).toBe(400);
    expect((await res.json()).step).toBe(1);
    expect(s.calls).toEqual([]);
  });

  it("consent: both boxes and a name, recorded as in_app", async () => {
    const h = await handler("consent", "POST");
    s.consentDue = true;
    expect((await h(req("POST", { body: { guardian: true, terms: false, guardianName: "Tatsiana K" } }))).status).toBe(400);
    expect((await h(req("POST", { body: { guardian: true, terms: true, guardianName: "" } }))).status).toBe(400);
    const ok = await h(req("POST", { body: { guardian: true, terms: true, guardianName: "  Tatsiana   K " } }));
    expect(ok.status).toBe(200);
    expect(s.calls[0].args[0]).toMatchObject({ profileId: "u1", source: "in_app", guardianName: "Tatsiana K" });
  });

  it("username: a check or a save, through the website's own actions", async () => {
    const h = await handler("username", "POST");
    expect((await h(req("POST", { body: {} }))).status).toBe(400);
    await h(req("POST", { body: { username: "Marcus.B", check: true } }));
    await h(req("POST", { body: { username: "marcus.b" } }));
    expect(s.calls.map((c) => c.fn)).toEqual(["checkUsername", "saveUsername"]);
    const ideas = await (await (await handler("username", "GET"))(req("GET"))).json();
    expect(ideas).toEqual({ ideas: ["marcus.b"] });
  });

  it("photo: the website's own route serves and stores it", async () => {
    expect((await (await handler("photo", "GET"))(req("GET"))).status).toBe(200);
    expect((await (await handler("photo", "POST"))(req("POST", { body: {} }))).status).toBe(200);
    expect(s.calls.map((c) => c.fn)).toEqual(["readPhoto", "storePhoto"]);
  });

  it("password and delete pass the shared action's own answer through", async () => {
    const del = await handler("accountDelete", "POST");
    expect((await del(req("POST", { body: { password: "secret123" } }))).status).toBe(200);
    expect(s.calls[0]).toEqual({ fn: "deleteOwnAccount", args: ["secret123"] });
    const pw = await handler("accountPassword", "POST");
    await pw(req("POST", { body: { current: "a", next: "bbbbbbbb" } }));
    const form = s.calls[1].args[1] as FormData;
    expect(form.get("current")).toBe("a");
    expect(form.get("next")).toBe("bbbbbbbb");
  });
});

describe("the Inbox and the notification choices", () => {
  it("the Inbox is read for the member the token names, with the website's own bell rule", async () => {
    const res = await (await handler("notices", "GET"))(req("GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notices: [] });
    expect(s.calls).toEqual([{ fn: "loadInbox", args: [s.player] }]);
  });

  it("opening the Inbox marks everything read through the website's own action, and takes nothing from the body", async () => {
    const res = await (await handler("notices", "POST"))(req("POST", { body: { player_id: "someone-else", ids: ["x"] } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(s.calls).toEqual([{ fn: "markAllNotificationsRead", args: [] }]);
  });

  it("the choices are read for the caller, a member or a free account", async () => {
    const get = await handler("noticePrefs", "GET");
    expect(await (await get(req("GET"))).json()).toEqual({ prefs: { topics: [], reminder: null } });
    expect(s.calls[0]).toEqual({ fn: "loadNoticePrefs", args: [s.viewer] });
    freeAccount();
    s.calls = [];
    expect((await get(req("GET"))).status).toBe(200);
    expect(s.calls[0].fn).toBe("loadNoticePrefs");
  });

  it("one change a request: a switch, or the reminder time, never both and never neither", async () => {
    const post = await handler("noticePrefs", "POST");
    const send = async (body: unknown) => (await post(req("POST", { body }))).status;
    expect(await send({})).toBe(400);
    expect(await send({ topic: "week", on: false, reminder: "evening" })).toBe(400);
    expect(await send({ topic: 3, on: false })).toBe(400);
    expect(await send({ reminder: 16 })).toBe(400);
    expect(s.calls).toEqual([]);
    expect(await send({ topic: "week", on: false })).toBe(200);
    expect(s.calls[0]).toEqual({ fn: "saveNoticeTopic", args: [s.viewer, "week", false] });
    expect(await send({ reminder: "after_school" })).toBe(200);
    expect(s.calls[1]).toEqual({ fn: "saveReminderChoice", args: [s.viewer, "after_school"] });
  });

  it("a choice that cannot be stored says so, with a line the screen can show", async () => {
    s.prefsSave = false;
    const res = await (await handler("noticePrefs", "POST"))(req("POST", { body: { topic: "week", on: false } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "That could not be saved. Try again in a minute." });
  });
});

describe("the free app's bodies are checked first", () => {
  it("intake: the answers go to the one saver, which answers for itself", async () => {
    freeAccount({ quiz_done_at: null, plan_days: [] });
    const h = await handler("freeIntake", "POST");
    expect((await h(req("POST", { body: { answers: ANSWERS } }))).status).toBe(200);
    expect(s.calls[0].fn).toBe("saveFreeIntake");
    expect(s.calls[0].args.slice(0, 2)).toEqual(["u1", ANSWERS]); // the account comes from the token
  });

  it("the offer needs the quiz", async () => {
    freeAccount();
    const h = await handler("freeOffer", "GET");
    expect((await h(req("GET"))).status).toBe(200);
    s.intake = { available: true, answers: null, checkout: null };
    expect((await h(req("GET"))).status).toBe(409);
  });

  it("starting a membership takes nothing from the request", async () => {
    freeAccount();
    const h = await handler("freeUpgrade", "POST");
    const res = await h(req("POST", { body: { profileId: "someone-else", price: 1 } }));
    expect(await res.json()).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    expect((s.calls[0].args[0] as { profile: { id: string } }).profile.id).toBe("u1");
    expect(s.calls[0].args).toHaveLength(2); // the viewer and the phone's user agent, nothing else
  });

  it("log, props, report, block and friend need well-formed ids and choices", async () => {
    freeAccount();
    const id = "11111111-1111-4111-8111-111111111111";
    const post = async (route: keyof typeof ROUTES, body: unknown, method = "POST") => (await (await handler(route, method))(req(method, { body }))).status;
    expect(await post("freeLog", { minutes: "30", kind: "training" })).toBe(400);
    expect(await post("freeLog", { minutes: 30, kind: "training" })).toBe(200);
    expect(await post("freeLog", { id: "x" }, "DELETE")).toBe(400);
    expect(await post("freeLog", { id }, "DELETE")).toBe(200);
    expect(await post("freeProps", { id: "nope" })).toBe(400);
    expect(await post("freeProps", { id })).toBe(200);
    expect(await post("freeReport", { id, reason: "because" })).toBe(400);
    expect(await post("freeReport", { id, reason: "bullying" })).toBe(200);
    expect(await post("freeBlock", { id: 7 })).toBe(400);
    expect(await post("freeBlock", { id })).toBe(200);
    expect(await post("freeFriend", { id, accept: "yes" })).toBe(400);
    expect(await post("freeFriend", { id, accept: true })).toBe(200);
    expect(s.calls.map((c) => c.fn)).toEqual(["logTraining", "deleteLog", "toggleProps", "reportPost", "blockPlayer", "answerFriendRequest"]);
  });

  it("a post is stored by the website's own route", async () => {
    freeAccount();
    expect((await (await handler("freePost", "POST"))(req("POST", { body: {} }))).status).toBe(200);
    expect(s.calls.map((c) => c.fn)).toEqual(["storePost"]);
  });

  it("a member who took the quiz as a free account is asked only what is still owed", async () => {
    const h = await handler("onboarding", "POST");
    s.player = player({ subscription_status: "active", onboarded_at: null });
    const { cleanFreeAnswers, memberAnswersFrom } = await import("@/lib/elite/free-intake");
    s.carried = memberAnswersFrom(cleanFreeAnswers(ANSWERS), 15);
    // the parent screen is the one a free account was never shown
    const short = await h(req("POST", { body: { answers: {} } }));
    expect(short.status).toBe(400);
    const ok = await h(req("POST", { body: { answers: { parentName: "Dana Bryant", level: "Elite", attrs: { weak_foot: 5 } } } }));
    expect(ok.status).toBe(200);
    const input = s.calls[0].args[0] as { parent_name: string; level: string; age: number; weaknesses: string[]; goals: string[] };
    expect(input.parent_name).toBe("Dana Bryant");
    // nothing already answered can be rewritten from the phone
    expect(input.level).toBe("Competitive");
    expect(input.weaknesses[0]).toBe("Weak foot");
    expect(input.age).toBe(15);
    expect(input.goals).toEqual(["Make a higher team"]);
  });
});

describe("clubs: bodies are checked first, and every write is the website's own action", () => {
  const CLUB = "22222222-2222-4222-8222-222222222222";
  const OTHER = "33333333-3333-4333-8333-333333333333";
  const PLAYER = "44444444-4444-4444-8444-444444444444";
  const PLAN = "55555555-5555-4555-8555-555555555555";
  const go = async (route: keyof typeof ROUTES, method: string, body: unknown, id?: string) =>
    (await handler(route, method))(req(method, { body }), id === undefined ? undefined : { params: { id } });
  const fns = () => s.calls.map((c) => c.fn);

  it("the tab: my clubs, read for the caller the token names", async () => {
    freeAccount();
    const res = await go("freeClubs", "GET", undefined);
    expect(await res.json()).toEqual({ clubs: [], canStart: true });
    expect((s.calls[0].args[0] as { profile: { id: string } }).profile.id).toBe("u1");
  });

  it("starting a club: a real name, a county from the list or none, the organizer sheet first", async () => {
    freeAccount();
    expect((await go("freeClubs", "POST", { name: "" })).status).toBe(400);
    expect((await go("freeClubs", "POST", { name: "www.join-us.com" })).status).toBe(400);
    expect((await go("freeClubs", "POST", { name: "Renegados FC", county: "Gainesville" })).status).toBe(400);
    expect(s.calls).toEqual([]);
    // the sheet has not been accepted: a step to take, not an error
    s.organizerOk = false;
    const needs = await go("freeClubs", "POST", { name: "Renegados FC" });
    expect(needs.status).toBe(200);
    expect(await needs.json()).toEqual({ ok: false, needs: "organizer" });
    s.organizerOk = true;
    const ok = await go("freeClubs", "POST", { name: "  Renegados   FC ", county: "va-prince-william", captain: "someone-else" });
    expect(await ok.json()).toEqual({ ok: true, id: "c1", code: "ABCD2345" });
    const last = s.calls[s.calls.length - 1];
    expect(last.args.slice(1)).toEqual(["Renegados FC", "va-prince-william"]);
    expect((last.args[0] as { profile: { id: string } }).profile.id).toBe("u1");
  });

  it("joining by code: the code alone or a whole pasted link, nothing else", async () => {
    freeAccount();
    expect((await go("freeClubJoin", "POST", { code: "nope" })).status).toBe(400);
    expect((await go("freeClubJoin", "POST", {})).status).toBe(400);
    expect(s.calls).toEqual([]);
    const typed = await go("freeClubJoin", "POST", { code: "abcd2345" });
    expect((await typed.json()).line).toContain("once the captain lets you in");
    await go("freeClubJoin", "POST", { code: "https://thestriveapp.com/join?club=ABCD2345" });
    expect(s.calls.map((c) => c.args[1])).toEqual(["ABCD2345", "ABCD2345"]);
  });

  it("a club's page and its clubs near you: a well-formed id, and 404 for a club that is not the caller's", async () => {
    freeAccount();
    for (const route of ["freeClub", "freeClubNear"] as const) {
      expect((await go(route, "GET", undefined, "../week")).status).toBe(404);
      expect((await go(route, "GET", undefined)).status).toBe(404);
    }
    expect(s.calls).toEqual([]); // an id that is not one never reaches a read
    expect(await (await go("freeClub", "GET", undefined, CLUB)).json()).toEqual({ club: { id: CLUB } });
    expect(await (await go("freeClubNear", "GET", undefined, CLUB)).json()).toEqual({ near: { id: CLUB } });
    s.clubFound = false;
    for (const route of ["freeClub", "freeClubNear"] as const) {
      const res = await go(route, "GET", undefined, CLUB);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    }
  });

  it("a player's profile: a well-formed id or me, a 404 for anyone the caller may not see, and each action is the website's own", async () => {
    freeAccount();
    expect((await go("freeProfile", "GET", undefined, "../week")).status).toBe(404);
    expect((await go("freeProfile", "GET", undefined)).status).toBe(404);
    expect(s.calls).toEqual([]); // an id that is not one never reaches a read
    expect(await (await go("freeProfile", "GET", undefined, CLUB)).json()).toEqual({ profile: { id: CLUB } });
    expect(await (await go("freeProfile", "GET", undefined, "me")).json()).toEqual({ profile: { id: "me" } });
    s.clubFound = false; // not a friend, or a block either way: the reader answers nothing
    const hidden = await go("freeProfile", "GET", undefined, CLUB);
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toEqual({ error: "not_found" });

    s.calls.length = 0;
    const post = async (body: unknown, id: string | undefined = CLUB) => (await go("freeProfile", "POST", body, id)).status;
    expect(await post({ do: "remove" }, "me")).toBe(400); // nobody acts on "me"
    expect(await post({ do: "remove" }, "nope")).toBe(400);
    expect(await post({ do: "delete-them" })).toBe(400);
    expect(s.calls).toEqual([]);
    expect(await post({ do: "remove" })).toBe(200);
    expect(await post({ do: "report_photo" })).toBe(200);
    expect(await post({ do: "report_line" })).toBe(200);
    expect(s.calls.map((c) => [c.fn, ...c.args])).toEqual([
      ["removeFriend", CLUB],
      ["reportLine", CLUB, "photo"],
      ["reportLine", CLUB, "line"],
    ]);
  });

  it("the blocked list, and taking a block back", async () => {
    freeAccount();
    expect(await (await go("freeBlocked", "GET", undefined)).json()).toEqual({ blocked: [] });
    s.calls.length = 0;
    expect((await go("freeBlocked", "POST", { id: "nope" })).status).toBe(400);
    expect((await go("freeBlocked", "POST", {})).status).toBe(400);
    expect(s.calls).toEqual([]);
    expect((await go("freeBlocked", "POST", { id: CLUB })).status).toBe(200);
    expect(s.calls.map((c) => [c.fn, ...c.args])).toEqual([["unblockPlayer", CLUB]]);
  });

  it("what a member or the captain does to a club goes through the website's action for it", async () => {
    freeAccount();
    const post = async (body: unknown, id: string | undefined = CLUB) => (await go("freeClub", "POST", body, id)).status;
    expect(await post({ do: "leave" }, "nope")).toBe(400);
    expect(await post({ do: "delete-everything" })).toBe(400);
    expect(await post({})).toBe(400);
    expect(await post({ do: "rename" })).toBe(400);
    expect(await post({ do: "remove", member: "the captain" })).toBe(400);
    expect(await post({ do: "county", county: 7, open: true })).toBe(400);
    expect(await post({ do: "county", county: "va-loudoun", open: "yes" })).toBe(400);
    expect(await post({ do: "request", player: PLAYER, accept: "yes" })).toBe(400);
    expect(await post({ do: "request", player: "x", accept: true })).toBe(400);
    expect(s.calls).toEqual([]);

    expect(await post({ do: "leave" })).toBe(200);
    expect(await post({ do: "report" })).toBe(200);
    expect(await post({ do: "rename", name: "Renegados" })).toBe(200);
    expect(await post({ do: "remove", member: PLAYER })).toBe(200);
    expect(await (await go("freeClub", "POST", { do: "link" }, CLUB)).json()).toEqual({ ok: true, code: "NEWC2345" });
    expect(await post({ do: "county", county: "va-loudoun", open: true })).toBe(200);
    expect(await post({ do: "county", county: null, open: false })).toBe(200);
    expect(await post({ do: "end" })).toBe(200);
    expect(await post({ do: "request", player: PLAYER, accept: true })).toBe(200);
    expect(fns()).toEqual(["leaveClub", "reportClub", "renameMyClub", "removeClubMember", "newClubLink", "setClubCounty", "setClubCounty", "endMyClub", "answerClubRequest"]);
    // every action is handed the club from the address, never one from the body
    for (const c of s.calls) expect(c.args[0]).toBe(CLUB);
    expect(s.calls[3].args).toEqual([CLUB, PLAYER]);
    expect(s.calls[5].args).toEqual([CLUB, "va-loudoun", true]);
    expect(s.calls[8].args).toEqual([CLUB, PLAYER, true]);
  });

  it("planning: a club, a kind, an opponent for a game; the plan itself is checked by the website's action", async () => {
    freeAccount();
    const input = { day: "2026-12-05", time: "18:00", minutes: 60, place: "Braemar Park, Bristow", title: "Finishing night" };
    expect((await go("freeClubPlans", "POST", { ...input, kind: "training" })).status).toBe(400);
    expect((await go("freeClubPlans", "POST", { ...input, club: CLUB, kind: "party" })).status).toBe(400);
    expect((await go("freeClubPlans", "POST", { ...input, club: CLUB, kind: "game" })).status).toBe(400);
    expect((await go("freeClubPlans", "POST", { ...input, club: CLUB, kind: "game", opponent: "them" })).status).toBe(400);
    expect(s.calls).toEqual([]);
    expect(await (await go("freeClubPlans", "POST", { ...input, club: CLUB, kind: "training" })).json()).toEqual({ ok: true, id: "plan1" });
    expect(await (await go("freeClubPlans", "POST", { ...input, club: CLUB, kind: "game", opponent: OTHER })).json()).toEqual({ ok: true, id: "plan1" });
    expect(s.calls.map((c) => [c.fn, ...c.args.slice(0, -1)])).toEqual([
      ["planTraining", CLUB],
      ["planGame", CLUB, OTHER],
    ]);
    expect(s.calls[0].args[1]).toEqual(input);
    // a captain who has not accepted the organizer sheet is told so, as a step
    s.organizerOk = false;
    const needs = await go("freeClubPlans", "POST", { ...input, club: CLUB, kind: "training" });
    expect(needs.status).toBe(200);
    expect(await needs.json()).toEqual({ ok: false, needs: "organizer" });
  });

  it("a session or a game: I'm in, the captains' answers, the score, a report", async () => {
    freeAccount();
    const post = async (body: unknown, id: string | undefined = PLAN) => go("freeClubPlan", "POST", body, id);
    expect((await post({ do: "in" }, "nope")).status).toBe(400);
    expect((await post({ do: "win" })).status).toBe(400);
    expect((await post({ do: "score", club: "3", opponent: 1 })).status).toBe(400);
    expect((await post({ do: "report", reason: "because" })).status).toBe(400);
    expect(s.calls).toEqual([]);

    for (const what of ["in", "out", "accept", "pass", "cancel", "confirm", "dispute"]) expect((await post({ do: what })).status, what).toBe(200);
    expect((await post({ do: "report", reason: "place" })).status).toBe(200);
    expect(s.calls.map((c) => [c.fn, ...c.args])).toEqual([
      ["setImIn", PLAN, true],
      ["setImIn", PLAN, false],
      ["answerGame", PLAN, true],
      ["answerGame", PLAN, false],
      ["cancelPlan", PLAN],
      ["answerScore", PLAN, true],
      ["answerScore", PLAN, false],
      ["reportPlan", PLAN, "place"],
    ]);
    // the action's own refusal is passed on as it words it
    const refused = await post({ do: "score", club: 3, opponent: 1 });
    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toContain("once the game has started");
    // a first "I'm in" before the player sheet: a step, not an error
    s.playerOk = false;
    const needs = await post({ do: "in" });
    expect(needs.status).toBe(200);
    expect(await needs.json()).toEqual({ ok: false, needs: "player" });
  });

  it("the two one-time sheets are recorded by the website's own action", async () => {
    freeAccount();
    expect((await go("freePlayTerms", "POST", { kind: "coach" })).status).toBe(400);
    expect((await go("freePlayTerms", "POST", {})).status).toBe(400);
    expect((await go("freePlayTerms", "POST", { kind: "organizer" })).status).toBe(200);
    expect((await go("freePlayTerms", "POST", { kind: "player" })).status).toBe(200);
    expect(s.calls.map((c) => [c.fn, ...c.args])).toEqual([
      ["acceptPlayTerms", "organizer"],
      ["acceptPlayTerms", "player"],
    ]);
  });

  it("starting a club is rate limited hard", async () => {
    freeAccount();
    const h = await handler("freeClubs", "POST");
    const start = () =>
      h(new Request("https://x/api", { method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "x-forwarded-for": "13.13.13.13" }, body: JSON.stringify({ name: "Renegados FC" }) }));
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await start()).status);
    expect(codes.slice(10)).toEqual([429, 429]);
  });
});

describe("the Courses library", () => {
  const course = async (slug: string) => (await handler("course", "GET"))(req("GET"), { params: { slug } });

  it("a member gets the shelf the website shows, open, in its order", async () => {
    const body = await (await (await handler("courses", "GET"))(req("GET"))).json();
    expect(body.locked).toBe(false);
    // a link course is its own pages inside the app; one with none is left out; an off course is not there
    expect(body.courses.map((c: { slug: string }) => c.slug)).toEqual(["keep-it-up", "dribbling-transformation", "college-recruiting"]);
    expect(body.courses.every((c: { locked: boolean }) => c.locked === false)).toBe(true);
    // the cover: the coach's picture, else the still of the first filmed drill, as a whole address
    expect(body.courses[0].cover).toBe("https://thestriveapp.com/drills/posters/juggling-one-touch-catch.jpg");
    expect(body.courses[2].cover).toBe("https://thestriveapp.com/courses/college-recruiting.jpg");
    expect(body.courses[1].cover).toBeNull();
  });

  it("an account that is not a member gets the shelf locked: name, line and picture, never a step", async () => {
    const locked = async () => {
      const res = await (await handler("courses", "GET"))(req("GET"));
      expect(res.status).toBe(200);
      return res.json();
    };
    const check = (body: { locked: boolean; courses: Record<string, unknown>[] }) => {
      expect(body.locked).toBe(true);
      expect(body.courses.length).toBe(3);
      for (const c of body.courses) {
        expect(Object.keys(c).sort()).toEqual(["cover", "locked", "name", "slug", "subtitle"]);
        expect(c.locked).toBe(true);
      }
      expect(JSON.stringify(body)).not.toMatch(/Lock the ankle|Facts only|password|Train five days|video|steps|levels/);
    };
    // a free account: no player record, a free training log
    s.viewer = viewer({ playerId: null });
    s.tracker = { id: "t1" };
    check(await locked());
    // and anyone else the gate keeps out of the member app
    s.viewer = viewer();
    s.player = player({ tier: "elite", subscription_status: "paused" });
    check(await locked());
    s.viewer = viewer({ role: "coach", playerId: null });
    check(await locked());
  });

  it("a single course is refused to an account that is not a member, before it is read", async () => {
    s.viewer = viewer({ playerId: null });
    s.tracker = { id: "t1" };
    const res = await course("keep-it-up");
    expect(res.status).toBe(403);
    expect((await res.json()).state.kind).toBe("free");
    expect(s.calls).toEqual([]);
  });

  it("a member gets a course as the website shows it", async () => {
    const res = await course("keep-it-up");
    expect(res.status).toBe(200);
    const { course: c } = await res.json();
    expect(c).toMatchObject({ slug: "keep-it-up", name: "Keep It Up", kind: "drill", intro: ["Pass the catch version first.", "Then move up."] });
    expect(c.levels.map((l: { label: string; name: string }) => [l.label, l.name])).toEqual([
      ["Level 1", "One touch"],
      ["Level 2", "Two touches each foot"],
    ]);
    // the drill's own name, its clip and still as whole addresses, the cue, the pass mark
    expect(c.levels[0].steps).toEqual([
      {
        id: "k1",
        kind: "drill",
        title: "One touch, catch",
        tag: "beginner",
        cue: "Lock the ankle.",
        passMark: "10 in a row",
        blocks: [],
        video: "https://thestriveapp.com/drills/juggling-one-touch-catch.mp4",
        poster: "https://thestriveapp.com/drills/posters/juggling-one-touch-catch.jpg",
        download: null,
      },
    ]);
    // an unfilmed drill and one switched off in the bank are never sent; a clip hosted elsewhere has no still
    expect(c.levels[1].steps.map((x: { id: string }) => x.id)).toEqual(["k2"]);
    expect(c.levels[1].steps[0]).toMatchObject({ video: "https://files.example.com/clip.mp4", poster: null, tag: "advanced" });
  });

  it("a lesson course comes as pages, its words unchanged", async () => {
    const { course: c } = await (await course("college-recruiting")).json();
    expect(c.kind).toBe("lesson");
    expect(c.levels[0]).toMatchObject({ label: "Part 1", name: "The CV" });
    const page = c.levels[0].steps[0];
    expect(page).toMatchObject({ kind: "lesson", title: "The one-page CV", video: null, download: "https://thestriveapp.com/downloads/cv.pdf" });
    expect(page.blocks).toEqual([
      { heading: null, text: "One page." },
      { heading: "TEMPLATE", text: "[Full name]\n[Graduation year]" },
      { heading: "RULES OF THUMB", text: "" },
      { heading: null, text: "Facts only." },
    ]);
  });

  it("a link course is its own pages, without its address or its password", async () => {
    const res = await course("dribbling-transformation");
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toMatch(/example\.com|password/);
    const c = JSON.parse(text).course;
    expect(c).toMatchObject({ kind: "lesson", intro: [] });
    expect(c.levels[0].steps[0].title).toBe("Welcome");
  });

  it("answers 404 for a course that is not on the shelf", async () => {
    for (const slug of ["nope", "not-yet", "outside-only", "../week", "Keep-It-Up", ""]) {
      const res = await course(slug);
      expect(res.status, slug).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    }
    // a slug that is not one never reaches the database
    expect(s.calls.map((c) => c.args[0])).toEqual(["nope", "not-yet", "outside-only"]);
  });
});

describe("throttling and failures", () => {
  it("rate limits a caller", async () => {
    const h = await handler("accountDelete", "POST");
    const r = () =>
      h(new Request("https://x/api", { method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "x-forwarded-for": "9.9.9.9" }, body: "{}" }));
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await r()).status);
    expect(codes.slice(0, 5).every((c) => c !== 429)).toBe(true);
    expect(codes.slice(5)).toEqual([429, 429]);
  });

  it("never hands the phone a web redirect", async () => {
    const { appRoute } = await import("@/lib/elite/app-api");
    const h = appRoute({ name: "t-redirect", access: "account" }, async () => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    });
    expect((await h(req("POST"))).status).toBe(409);
    const boom = appRoute({ name: "t-boom", access: "account" }, async () => {
      throw new Error("db down");
    });
    const res = await boom(req("POST"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server" });
  });

  it("answers are never cached", async () => {
    const h = await handler("me", "GET");
    const res = await h(req("GET"));
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
