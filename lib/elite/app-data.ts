// The reads behind the native app's API: the same getters the web member
// pages call, shaped by lib/elite/app-payload.ts. Runs inside an app
// request (lib/elite/app-api.ts), so every getter reads as the member.
import { APP_URL } from "./app-url";
import {
  getAchievements,
  getHomework,
  getNotifications,
  getProgram,
  getTrainingBreaks,
  getWeeklyPlans,
} from "./data";
import { settleBreaksForPlayer } from "./breaks-server";
import { currentBreak } from "./breaks";
import { programWeekFor } from "./program";
import { liveWeekFor, nextMondayNY, nyToday } from "./time";
import { profileSetupDue, setupSteps } from "./account-profile";
import { suggestUsernames } from "./account-profile-server";
import { cardName, cardTierLabel, memberSinceLabel, memberTabs } from "./experience";
import { AGREEMENT_POINTS, GUARDIAN_STATEMENT, LEGAL_VERSION, TERMS_STATEMENT } from "./legal";
import { weekPayload, youPayload, type AppWeek, type AppYou } from "./app-payload";
import type { MemberState } from "./member-gate";
import type { AppBootstrap } from "./app-contract";
import type { Viewer } from "./session";
import type { Player } from "./types";

export async function loadWeek(player: Player): Promise<AppWeek> {
  // As the web Home does on every open: a break that ended moves the
  // program clock first. (The Monday unlock is the hourly builder's, never
  // a member request's: tests/app-feel.test.ts.)
  const { week1Monday } = await settleBreaksForPlayer(player);
  const [homework, plans, breaks, program] = await Promise.all([
    getHomework(player.id),
    getWeeklyPlans(player.id),
    getTrainingBreaks(player.id),
    getProgram(player.id).catch(() => null),
  ]);
  // The program's focus for the week being trained (065) is the ladder's
  // middle rung; the week is worked out by the same rule weekPayload uses.
  const live = liveWeekFor(week1Monday, player.current_week);
  const maxBuilt = homework.reduce((m, h) => Math.max(m, h.week), 0);
  const week = maxBuilt > 0 ? Math.max(1, Math.min(live, maxBuilt)) : 0;
  return weekPayload({
    homework,
    week1Monday,
    currentWeek: player.current_week,
    plans,
    programGoal: program?.quiz.goal ?? null,
    onboardingGoal: player.goals?.[0] ?? null,
    focusName: week > 0 ? programWeekFor(program, week)?.focusName ?? null : null,
    onBreak: currentBreak(breaks, nyToday()),
    hasWall: player.has_wall === true,
    base: APP_URL,
    now: Date.now(),
    nextMonday: nextMondayNY(),
  });
}

export async function loadYou(player: Player): Promise<AppYou> {
  const [homework, achievements] = await Promise.all([getHomework(player.id), getAchievements(player.id)]);
  return youPayload({
    fullName: player.full_name,
    joinedAt: player.joined_at,
    tier: player.tier,
    position: player.position,
    homework,
    achievements,
    week1Monday: player.week1_monday,
    currentWeek: player.current_week,
  });
}

// The tabs the app shows, from the one rule (memberTabs). The phone draws
// the tabs it has screens for (mobile/src/tabs.ts): Home, Week, Courses
// and You today; the Coach tab when its screen exists.
const TAB_KEY: Record<string, string> = {
  "/dashboard": "home",
  "/homework": "week",
  "/courses": "courses",
  "/messages": "coach",
  "/you": "you",
};

export async function loadBootstrap(viewer: Viewer, state: MemberState, player: Player | null): Promise<AppBootstrap> {
  const unread =
    state.kind === "ok" && player
      ? (await getNotifications(player.id).catch(() => [])).filter((n) => !n.read).length
      : 0;
  return {
    viewer: {
      name: viewer.profile.full_name,
      firstName: (player?.full_name ?? viewer.profile.full_name).split(" ")[0] ?? "",
      email: viewer.profile.email,
    },
    state,
    consent:
      state.kind === "consent"
        ? { version: LEGAL_VERSION, points: AGREEMENT_POINTS, guardian: GUARDIAN_STATEMENT, terms: TERMS_STATEMENT }
        : null,
    player: player
      ? {
          id: player.id,
          tier: player.tier ?? "complete",
          card: { name: cardName(player.full_name), since: memberSinceLabel(player.joined_at), tier: cardTierLabel(player.tier) },
          position: player.position?.trim() || null,
          knownParentPhone: player.parent_phone ?? "",
        }
      : null,
    tabs: memberTabs(player?.tier).map((t) => ({ key: TAB_KEY[t.href] ?? t.href, label: t.label })),
    unread,
    profileSetup: await profileSetupFor(viewer),
  };
}

// The photo and @username (081) as the phone needs them: what is owed, in
// the website's order, ideas while the username is owed, and the photo at
// our own address (fetched with the bearer token, kept while it is the
// same photo). Null while 081 is not applied: ask nothing, refuse nothing.
async function profileSetupFor(viewer: Viewer): Promise<AppBootstrap["profileSetup"]> {
  const setup = viewer.setup;
  if (!setup.available) return null;
  const steps = setupSteps(setup);
  const ideas =
    profileSetupDue(setup) && !setup.username
      ? await suggestUsernames(viewer.profile.id, viewer.profile.full_name).catch(() => [])
      : [];
  return {
    username: setup.username,
    hasPhoto: setup.hasPhoto,
    photoUrl: setup.photoKey ? `${APP_URL}/api/app/profile/photo?v=${setup.photoKey}` : null,
    steps,
    ideas,
  };
}
