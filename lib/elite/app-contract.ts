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
import type { ClubFace, ClubMemberRow, ClubWeek } from "./club-app";
import type { PlanCard } from "./club-teams";
import type { MatchupView } from "./club-matchups";
import type { Squad } from "./squad-pass";
import type { InboxRow } from "./bell";
import type { NoticePrefs } from "./notice-prefs";
import type { FirstDays } from "./first-days";

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
  // social: a member who also has the free app; Strive Pro adds the Train
  // tab to the free tabs (lib/elite/one-app.ts)
  | { kind: "ok"; social?: boolean };

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
  // The free app (069), as its tabs need it: a free account, and a Strive
  // Pro member who has one behind them (state ok + social). Null for
  // everyone else.
  free: null | {
    // "Marcus B.", the name friends see
    name: string;
    // logs gym work apart from training (high school and older)
    gym: boolean;
    // Strive Pro was on for this player and has ended: said once, calmly,
    // at the top of Week (lib/elite/one-app.ts)
    proEnded?: boolean;
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

// The Inbox (lib/elite/bell.ts inboxRows): the member's notes, each once,
// newest first, with where each opens.
export type AppNotice = InboxRow;
export type AppInbox = { notices: AppNotice[] };
// The notification choices (lib/elite/notice-prefs.ts).
export type AppNoticePrefs = { prefs: NoticePrefs };
export type AppNoticePrefsSaved = { ok: true; prefs: NoticePrefs } | { ok: false; error: string };

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
  notices: "/api/app/notices",
  noticePrefs: "/api/app/notices/prefs",
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
  // the training clock (training-clock.ts): the start, heard by the server, and the finish with both photos
  freeClock: "/api/app/free/clock",
  freeClockFinish: "/api/app/free/clock/finish",
  freeProps: "/api/app/free/props",
  freeReport: "/api/app/free/report",
  freeBlock: "/api/app/free/block",
  freeFriend: "/api/app/free/friend",
  freeWeek: "/api/app/free/week",
  freeWeekCard: "/api/app/free/week/card",
  freeYou: "/api/app/free/you",
  freeProfile: "/api/app/free/profile",
  freeBlocked: "/api/app/free/blocked",
  // clubs, in the free app
  freeClubs: "/api/app/free/clubs",
  freeClubJoin: "/api/app/free/clubs/join",
  freePlans: "/api/app/free/plans",
  freePlayTerms: "/api/app/free/play-terms",
} as const;

// One player's profile: GET it ("me" is the caller's own), POST something
// the caller does about that player (take them off, report their photo or
// their Playing for line).
export function appProfilePath(id: string): string {
  return `${APP_API.freeProfile}/${encodeURIComponent(id)}`;
}

// One club: GET its page, POST something a member or its captain does.
export function appClubPath(id: string): string {
  return `${APP_API.freeClubs}/${encodeURIComponent(id)}`;
}
// Clubs near you, for the club's captain.
export function appClubNearPath(id: string): string {
  return `${appClubPath(id)}/near`;
}
// One session or game: POST what a player or a captain does with it.
export function appPlanPath(id: string): string {
  return `${APP_API.freePlans}/${encodeURIComponent(id)}`;
}

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

export type AppOpenCard = Omit<OpenCard, "photoPath" | "createdAt" | "startPhotoPath"> & {
  photoUrl: string;
  startPhotoUrl?: string | null; // the photo that started the clock (training-clock.ts)
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
  // The first-days list (first-days.ts), or null once it is done or over
  firstDays?: FirstDays | null;
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
  // timed false: the player typed how long, so it counts on their own week only
  entries: { id: string; day: string; label: string; minutes: number; kind: Kind; photo: boolean; timed?: boolean }[];
  board: BoardRow[];
  invite: string;
  // What the one upgrade card on this screen is built from
  // (lib/elite/upgrade-card.ts): the weakest area the drill bank trains,
  // and the sessions a week the player's own answers give.
  upgrade: { area: string | null; sessions: number };
};

// Share my week (lib/elite/week-card.ts): the player's own week as a
// story-size picture, 1080 x 1920, sent as a PNG data URI, and the words
// that go with it on the share sheet (they end with the player's own join
// link). The picture is drawn on the server; the phone only hands it on.
export type AppWeekCard = { image: string; text: string };

export type AppFreeYou = {
  name: string;
  aura: { level: number; label: string; progress: number; next: string | null };
  weekMinutes: number;
  allMinutes: number;
  gymLine: string | null;
  starred: boolean;
  invite: string;
};

// A player's profile in the free app (lib/elite/tracker.ts Profile): only
// the player, their friends and the coaches are ever sent one. The same
// card the You tab shows, their clubs, and the training photos the caller
// may see. No bio, no follower count, no age or grade.
export type AppProfile = {
  id: string;
  name: string; // "Diego R."
  first: string;
  initials: string;
  photo: string | null;
  username: string | null;
  starred: boolean;
  you: boolean;
  friend: boolean;
  // the level they play at, in its own words, and their own Playing for line
  level: string | null;
  playingFor: string | null;
  // next is said only to the player themselves
  aura: { level: number; label: string; progress: number; next: string | null };
  weekMinutes: number;
  allMinutes: number;
  // mine: the caller is in that club too, so its page opens for them
  clubs: { id: string; name: string; mine: boolean }[];
  posts: { id: string; day: string; minutes: number; kind: Kind; photoUrl: string }[];
  // their latest post the caller may give props on
  propsPost: { id: string; propped: boolean } | null;
};

export type AppBlocked = { blocked: { id: string; name: string }[] };

export type AppUsernameAnswer = { ok: true; name: string } | { ok: false; name: string; error: string; taken?: boolean };


// ---- Clubs in the free app (lib/elite/club-app-server.ts) -----------------

export type { ClubFace, ClubMemberRow, ClubWeek, MatchupView, PlanCard };

// A club on the Clubs tab: alive at a glance.
export type AppClubCard = {
  id: string;
  name: string;
  captain: boolean; // the viewer captains it
  ended: boolean;
  members: number;
  // the club's training this week, as said ("14h")
  weekTime: string;
  // the newest training photo from the club this week that the viewer may
  // see (the feed's own lock), behind the card; null when there is none
  photo: string | null;
  // the members who trained today, you first; nobody else is listed
  today: ClubFace[];
  // "Club training · Tue, Nov 24, 6:00 PM", or null
  next: string | null;
  // "This week: Renegados FC vs Sunday Pickup.", or null (083)
  matchup: string | null;
  // for its captain: answers waiting on them (players asking to join, a
  // game request, a score to enter or confirm)
  waiting: number;
};

export type AppClubs = { clubs: AppClubCard[]; canStart: boolean };

// A training photo on the club page. A locked one (a teammate's post from
// today, before the viewer has posted a photo today) carries whose it is
// and how long, and no photo of the post at all.
export type AppClubTile =
  | { state: "open"; id: string; first: string; mine: boolean; time: string; photoUrl: string }
  | { state: "locked"; id: string; first: string; initials: string; photo: string | null; time: string };

export type AppClubRequest = { id: string; name: string; initials: string };
export type AppGameAsk = { id: string; from: string; fromId: string; when: string; minutes: number; place: string };

export type AppClubPage = {
  id: string;
  name: string;
  // today in New York, so the phone lists the days a plan can be set for
  // from the server's day, never its own clock
  today: string;
  captain: boolean;
  ended: boolean;
  byCoach: boolean; // a club a coach made: it has no captain
  county: string | null;
  countyName: string | null;
  open: boolean; // open to games
  record: string; // games: "4-1", or "New"
  recordLine: string; // "Games won: 4. Games lost: 1. Draws: 0."
  membersCount: number;
  week: ClubWeek;
  // the weekly matchup; null until 083 is applied (then nothing is drawn)
  matchup: MatchupView | null;
  members: ClubMemberRow[];
  next: PlanCard[]; // coming up, the soonest first
  results: PlanCard[]; // games that have started: their result, or waiting on one
  accepted: { organizer: boolean; player: boolean };
  photos: AppClubTile[];
  // what the share sheet sends (the link and the code); null once ended
  share: { text: string; link: string; code: string } | null;
  // the captain's side; null for everyone else
  manage: null | { requests: AppClubRequest[]; games: AppGameAsk[] };
};

// Clubs near you, for a captain: a club's crest, name, record and player
// count, never a player. `refusal` says why a game cannot be sent now.
export type AppNearClub = { id: string; name: string; record: string; members: number; refusal: string | null; played: boolean };
export type AppClubNear = {
  club: { id: string; name: string; county: string | null; countyName: string | null; open: boolean };
  // set when the club already has as many game requests waiting as it may
  fullLine: string | null;
  rows: AppNearClub[];
};

// What a POST to a club, a plan or the play terms answers.
export type AppClubAnswer = { ok: boolean; error?: string; needs?: "organizer" | "player"; id?: string; code?: string; line?: string };
