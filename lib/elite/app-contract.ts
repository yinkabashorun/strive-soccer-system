// The shapes the native iPhone app (mobile/) and the site's app API
// (app/api/app/*) agree on. Types only, and only from pure modules, so the
// phone can import this file without pulling in anything that runs on the
// server (tests/app-shared.test.ts walks every import to hold that).
import type { AppDrill, AppSession, AppWeek, AppYou } from "./app-payload";
import type { AppCourse, AppCourseCard, AppCourseLevel, AppCourseList, AppCourseStep, AppLessonBlock } from "./app-courses";
import type { LadderRung } from "./home";
import type { AreaMinutes } from "./time-trained";
import type { FreeStage } from "./free-intake";
import type { QuizStepId } from "./quiz";
import type { BoardRow, Face, Kind, LockedCard, OpenCard, StripDay, TodayLine } from "./tracker";
import type { Squad } from "./squad-pass";

export type { AppDrill, AppSession, AppWeek, AppYou, LadderRung, AreaMinutes };
// The Courses library (lib/elite/app-courses.ts): the shelf, and one course.
export type { AppCourse, AppCourseCard, AppCourseLevel, AppCourseList, AppCourseStep, AppLessonBlock };

// lib/elite/gates.ts GateCopy, as the phone receives it.
export type AppGate = { title: string; body: string; emailCoach: boolean; startPro?: boolean };

// lib/elite/member-gate.ts MemberState, as the phone receives it.
// tests/app-shared.test.ts fails to compile if the two drift.
export type AppMemberState =
  | { kind: "coach" }
  | { kind: "free"; stage: FreeStage }
  | { kind: "no_profile"; gate: AppGate }
  | { kind: "consent" }
  | { kind: "pro_checkout"; gate: AppGate }
  | { kind: "onboarding" }
  | { kind: "membership"; gate: AppGate }
  | { kind: "ok" };

export type AppBootstrap = {
  viewer: { name: string; firstName: string; email: string };
  state: AppMemberState;
  consent: { version: string; points: string[]; guardian: string; terms: string } | null;
  player: {
    id: string;
    tier: string;
    card: { name: string; since: string | null; tier: string };
    position: string | null;
    knownParentPhone: string;
  } | null;
  // From memberTabs (lib/elite/experience.ts): home, week, courses, coach, you.
  tabs: { key: string; label: string }[];
  unread: number;
  // A free account (069), as the free tabs need it. Null for everyone else.
  free: null | {
    // "Marcus B.", the name friends see
    name: string;
    // logs gym work apart from training (high school and older)
    gym: boolean;
  };
  // A member whose quiz was answered while the account was free
  // (lib/elite/free-intake.ts): only the screens still owed are shown, in
  // order. Null for a member who takes the whole quiz.
  quizOwed: QuizStepId[] | null;
  // The required profile photo and @username (migration 081,
  // lib/elite/account-profile.ts). Null while 081 is not applied (or the
  // profile row could not be read): then nothing is asked and nothing is
  // refused, exactly as on the website.
  profileSetup: null | {
    username: string | null;
    hasPhoto: boolean;
    // our own address for the photo, fetched with the bearer token; the
    // same for as long as the photo is the same
    photoUrl: string | null;
    // the screens still owed, in order (username first, then the photo)
    steps: ("username" | "photo")[];
    // a few usernames to offer, when the username is still owed
    ideas: string[];
  };
};

export type AppPickRow = { id: string; title: string; minutes: number; poster: string | null; doneBefore: boolean };
export type AppExtra = {
  shelves: { key: string; label: string; blurb: string }[];
  groups: { key: string; label: string; drills: AppPickRow[] }[];
  warmUpMinutes: number;
  finisherMinutes: number;
  error: string | null;
};

export type AppFirstWeek = {
  status: "live" | "monday" | "waiting" | "off";
  line: { title: string; body: string } | null;
};

// Every path the phone calls, in one place.
export const APP_API = {
  me: "/api/app/me",
  week: "/api/app/week",
  you: "/api/app/you",
  drill: "/api/app/drill",
  extra: "/api/app/extra",
  checkin: "/api/app/checkin",
  onboarding: "/api/app/onboarding",
  firstWeek: "/api/app/first-week",
  consent: "/api/app/consent",
  pushToken: "/api/app/push-token",
  accountDelete: "/api/app/account/delete",
  accountPassword: "/api/app/account/password",
  username: "/api/app/profile/username",
  photo: "/api/app/profile/photo",
  courses: "/api/app/courses",
  // the free app
  freeOpen: "/api/app/free/open",
  freeJoin: "/api/app/free/join",
  freeIntake: "/api/app/free/intake",
  freeOffer: "/api/app/free/offer",
  freePlan: "/api/app/free/plan",
  freeUpgrade: "/api/app/free/upgrade",
  freePass: "/api/app/free/pass",
  freeUpgradeConfirm: "/api/app/free/upgrade/confirm",
  freeFeed: "/api/app/free/feed",
  freePost: "/api/app/free/post",
  freeLog: "/api/app/free/log",
  freeProps: "/api/app/free/props",
  freeReport: "/api/app/free/report",
  freeBlock: "/api/app/free/block",
  freeFriend: "/api/app/free/friend",
  freeWeek: "/api/app/free/week",
  freeYou: "/api/app/free/you",
} as const;

// One course, by its slug: GET /api/app/courses/<slug>.
export function appCoursePath(slug: string): string {
  return `${APP_API.courses}/${encodeURIComponent(slug)}`;
}


// ---- The free app (lib/elite/free-app-server.ts) -------------------------

// Is free sign-up open right now (the coaches' switch at /coach/free)?
export type AppJoinOpen = { open: boolean };

// The offer after the quiz. Every word and the price come from the server
// (lib/elite/offer.ts), so the phone never writes either by hand.
export type AppOffer = {
  // the card they would carry: their name and the membership's name
  card: { name: string; tier: string };
  headline: string;
  drillsLabel: string;
  // Stills only: the drills' names are never sent with the offer.
  drills: { poster: string }[];
  drillLocked: string;
  gets: string[];
  price: string;
  start: string;
  later: string;
  terms: string;
  // Send to a parent (parent-link.ts): the button's words and the text it
  // shares, with the player's own link to the page their parent pays from
  parent?: { label: string; text: string };
};

export type AppUpgradeStart = { ok: true; url: string } | { ok: false; error: string };

// The week's set-up: the recommended target and the days.
export type AppFreePlan = {
  recommended: number;
  line: string;
  target: number | null;
  days: number[];
};

export type AppOpenCard = Omit<OpenCard, "photoPath" | "createdAt"> & {
  photoUrl: string;
  ago: string;
  props: number;
  propped: boolean;
  together?: string | null;
};
export type AppFeedCard = AppOpenCard | LockedCard;

export type AppFreeFeed = {
  date: string;
  unlocked: boolean;
  faces: Face[];
  friendCount: number;
  friendsToday: number;
  cards: AppFeedCard[];
  requests: { id: string; name: string; initials: string }[];
  week: { minutes: number; target: number; percent: number };
  invite: string;
  // Bring your squad: three teammates who train earn a month (squad-pass.ts)
  squad?: Squad;
};

export type AppFreeWeek = {
  today: string;
  label: string;
  minutes: number;
  gymMinutes: number;
  target: number;
  percent: number;
  planDays: number[];
  strip: StripDay[];
  todayLine: TodayLine | null;
  splitLine: string | null;
  gymLine: string | null;
  entries: { id: string; day: string; label: string; minutes: number; kind: Kind; photo: boolean }[];
  board: BoardRow[];
  invite: string;
  // What the one upgrade card on this screen is built from
  // (lib/elite/upgrade-card.ts): the weakest area the drill bank trains,
  // and the sessions a week the player's own answers give.
  upgrade: { area: string | null; sessions: number };
};

export type AppFreeYou = {
  name: string;
  aura: { level: number; label: string; progress: number; next: string | null };
  weekMinutes: number;
  allMinutes: number;
  gymLine: string | null;
  starred: boolean;
  invite: string;
};

export type AppUsernameAnswer = { ok: true; name: string } | { ok: false; name: string; error: string; taken?: boolean };
