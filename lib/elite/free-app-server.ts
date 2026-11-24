// The free app as the native iPhone app reads it (app/api/app/free/*): the
// website's own readers (lib/elite/tracker-server.ts) and pure rules
// (lib/elite/tracker.ts), shaped as lib/elite/app-contract.ts says. No rule
// is written a second time here: who may see a photo, what a locked post
// carries, what counts toward a week and how a board is ordered are all
// decided where the website decides them.
//
// Runs inside an app request (lib/elite/app-api.ts), after its gate has
// established that the caller is a free account.
import { APP_URL } from "./app-url";
import { createServiceClient } from "./supabase/server";
import { getDrillBank } from "./data";
import { weekPreview } from "./bank-conform";
import { drillPoster } from "./drill-poster";
import { cardName } from "./experience";
import { attributesWeakestFirst, TEAM_TRAINING } from "./quiz";
import { sessionsFor } from "./training";
import type { FreeAnswers, FreeStage } from "./free-intake";
import {
  OFFER_CARD_TIER,
  OFFER_DRILLS_LABEL,
  OFFER_DRILL_LOCKED,
  OFFER_GETS,
  OFFER_LATER,
  OFFER_LATER_FIRST,
  OFFER_PRICE,
  OFFER_START,
  OFFER_TERMS,
  offerHeadline,
} from "./offer";
import {
  auraLogsOf,
  feedFor,
  friendRequestsFor,
  friendsWeekFor,
  getTargetTable,
  getWeekLogs,
  myPhotoFor,
  type Tracker,
} from "./tracker-server";
import {
  allTimeMinutes,
  auraLabel,
  auraLevel,
  auraNextLine,
  auraPoints,
  dayLabel,
  firstNameOf,
  friendsBoard,
  gymThisWeekLine,
  joinLink,
  longDayLabel,
  recommendLine,
  recommendation,
  shortName,
  splitLine,
  todayLine,
  tracksGym,
  weekLabel,
  weekProgress,
  weekStrip,
  type Season,
} from "./tracker";
import type { AppFeedCard, AppFreeFeed, AppFreePlan, AppFreeWeek, AppFreeYou, AppOffer } from "./app-contract";
import type { Viewer } from "./session";
import { squadFor } from "./squad-pass-server";
import { parentLinkFor } from "./parent-link-server";
import { PARENT_SEND, parentShareText } from "./parent-link";

// The areas this player's first week would go after and a few of its
// drills, from their own ratings and the filmed bank (weekPreview).
async function previewFor(answers: FreeAnswers) {
  const { drills: bank } = await getDrillBank({ onlyWithVideo: true });
  return weekPreview(bank, attributesWeakestFirst(answers.attrs), {
    has_wall: answers.wall,
    has_goal: answers.goal,
    space: answers.space ?? "open",
  });
}

function sessionsFrom(answers: FreeAnswers): number {
  return sessionsFor(TEAM_TRAINING.find((t) => t.id === answers.team)?.load);
}

export async function offerFor(viewer: Viewer, answers: FreeAnswers, stage: FreeStage): Promise<AppOffer> {
  const [preview, link] = await Promise.all([previewFor(answers), parentLinkFor(viewer.profile.id).catch(() => null)]);
  return {
    card: { name: cardName(viewer.profile.full_name), tier: OFFER_CARD_TIER },
    headline: offerHeadline(firstNameOf(viewer.profile.full_name), preview.areas),
    drillsLabel: OFFER_DRILLS_LABEL,
    drills: preview.drills.flatMap((d) => {
      const poster = drillPoster(d.video_url);
      return poster ? [{ poster: `${APP_URL}${poster}` }] : [];
    }),
    drillLocked: OFFER_DRILL_LOCKED,
    gets: [...OFFER_GETS],
    price: OFFER_PRICE,
    start: OFFER_START,
    later: stage === "ready" ? OFFER_LATER : OFFER_LATER_FIRST,
    terms: OFFER_TERMS,
    // the player is not the one who pays: the same offer, sent to a parent
    ...(link ? { parent: { label: PARENT_SEND, text: parentShareText(link) } } : {}),
  };
}

export async function planFor(tracker: Tracker): Promise<AppFreePlan> {
  const season: Season = tracker.season ?? "in_season";
  const row = recommendation(await getTargetTable(), season);
  return {
    recommended: row.minutes,
    line: recommendLine(row),
    target: tracker.target_minutes,
    days: tracker.plan_days,
  };
}

export async function freeFeedFor(viewer: Viewer, tracker: Tracker, today: string): Promise<AppFreeFeed> {
  const [feed, requests, logs, squad] = await Promise.all([
    feedFor(viewer, today),
    friendRequestsFor(viewer),
    getWeekLogs(viewer.profile.id, today),
    squadFor(viewer.profile.id).catch(() => undefined),
  ]);
  const week = weekProgress(logs, tracker.target_minutes ?? 0, today);
  // the same cards the website draws; a locked one carries no photo of the post
  const cards: AppFeedCard[] = feed.cards;
  return {
    date: longDayLabel(today),
    unlocked: feed.unlocked,
    faces: feed.faces,
    friendCount: feed.friendCount,
    friendsToday: feed.friendsToday,
    cards,
    requests,
    week: { minutes: week.minutes, target: week.target, percent: week.percent },
    invite: joinLink(APP_URL, tracker.referral_code),
    squad,
  };
}

export async function freeWeekFor(
  viewer: Viewer,
  tracker: Tracker,
  answers: FreeAnswers | null,
  today: string
): Promise<AppFreeWeek> {
  const target = tracker.target_minutes ?? 0;
  const [logs, friends, myPhoto, preview] = await Promise.all([
    getWeekLogs(viewer.profile.id, today),
    friendsWeekFor(viewer, today),
    myPhotoFor(viewer),
    answers ? previewFor(answers).catch(() => null) : Promise.resolve(null),
  ]);
  const week = weekProgress(logs, target, today);
  const gym = tracksGym(tracker.grade);
  const me = {
    id: viewer.profile.id,
    name: shortName(viewer.profile.full_name),
    minutes: week.minutes,
    starred: Boolean(tracker.starred_at),
    photo: myPhoto,
  };
  return {
    today,
    label: weekLabel(today),
    minutes: week.minutes,
    gymMinutes: gym ? week.gymMinutes : 0,
    target,
    percent: week.percent,
    planDays: tracker.plan_days,
    strip: weekStrip(logs, tracker.plan_days, today),
    todayLine: todayLine(logs, tracker.plan_days, target, today),
    splitLine: splitLine(target, tracker.plan_days.length),
    gymLine: gym ? gymThisWeekLine(week.gymMinutes) : null,
    entries: logs
      .filter((l) => l.kind === "training" || gym)
      .map((l) => ({ id: l.id, day: l.trained_on, label: dayLabel(l.trained_on), minutes: l.minutes, kind: l.kind, photo: Boolean(l.photo) })),
    board: friendsBoard([me, ...friends], viewer.profile.id),
    invite: joinLink(APP_URL, tracker.referral_code),
    upgrade: { area: preview?.areas[0] ?? null, sessions: answers ? sessionsFrom(answers) : 0 },
  };
}

export async function freeYouFor(viewer: Viewer, tracker: Tracker, today: string): Promise<AppFreeYou> {
  const admin = createServiceClient();
  const [all, logs] = await Promise.all([
    admin ? auraLogsOf(admin, viewer.profile.id) : Promise.resolve([]),
    getWeekLogs(viewer.profile.id, today),
  ]);
  const week = weekProgress(logs, tracker.target_minutes ?? 0, today);
  const aura = auraLevel(auraPoints(all, tracker.target_minutes ?? 0));
  return {
    name: shortName(viewer.profile.full_name),
    aura: { level: aura.level, label: auraLabel(aura.level), progress: aura.progress, next: auraNextLine(aura) },
    weekMinutes: week.minutes,
    allMinutes: allTimeMinutes(all),
    gymLine: tracksGym(tracker.grade) ? gymThisWeekLine(week.gymMinutes) : null,
    starred: Boolean(tracker.starred_at),
    invite: joinLink(APP_URL, tracker.referral_code),
  };
}
