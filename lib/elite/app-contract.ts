// The shapes the native iPhone app (mobile/) and the site's app API
// (app/api/app/*) agree on. Types only, and only from pure modules, so the
// phone can import this file without pulling in anything that runs on the
// server (tests/app-shared.test.ts walks every import to hold that).
import type { AppDrill, AppSession, AppWeek, AppYou } from "./app-payload";
import type { LadderRung } from "./home";
import type { AreaMinutes } from "./time-trained";

export type { AppDrill, AppSession, AppWeek, AppYou, LadderRung, AreaMinutes };

// lib/elite/gates.ts GateCopy, as the phone receives it.
export type AppGate = { title: string; body: string; emailCoach: boolean; startPro?: boolean };

// lib/elite/member-gate.ts MemberState, as the phone receives it.
// tests/app-shared.test.ts fails to compile if the two drift.
export type AppMemberState =
  | { kind: "coach" }
  | { kind: "free" }
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
} as const;

export type AppUsernameAnswer = { ok: true; name: string } | { ok: false; name: string; error: string; taken?: boolean };
