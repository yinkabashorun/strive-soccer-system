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
  firstDaysFacts,
  friendRequestsFor,
  friendsWeekFor,
  getTargetTable,
  getWeekLogs,
  myPhotoFor,
  blockedFor,
  clubIdsOf,
  profileFor,
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
import type { AppBlocked, AppFeedCard, AppFreeFeed, AppFreePlan, AppFreeWeek, AppFreeYou, AppOffer, AppProfile } from "./app-contract";
import { hasWeekToShare, weekCard, type WeekCard } from "./week-card";
import { shareText } from "./share-link";
import { shareLinkFor } from "./share-link-server";
import type { Viewer } from "./session";
import { squadFor } from "./squad-pass-server";
import { firstDays } from "./first-days";
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
  const [feed, requests, logs, squad, first] = await Promise.all([
    feedFor(viewer, today),
    friendRequestsFor(viewer),
    getWeekLogs(viewer.profile.id, today),
    squadFor(viewer.profile.id).catch(() => undefined),
    firstDaysFacts(viewer.profile.id).catch(() => null),
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
    firstDays: first
      ? firstDays({ joinedAt: tracker.created_at, friends: feed.friendCount, ...first }, Date.now())
      : null,
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

// Share my week (lib/elite/week-card.ts): what is on the player's own
// card, and the words that go with it on the share sheet. Every share is
// an invite, so the words end with their own join link
// (lib/elite/share-link.ts decides which code it carries). Null until the
// player has trained this week.
export async function freeWeekCardFor(
  viewer: Viewer,
  tracker: Tracker,
  today: string
): Promise<{ card: WeekCard; text: string } | null> {
  const [logs, link] = await Promise.all([getWeekLogs(viewer.profile.id, today), shareLinkFor(tracker, false)]);
  // nothing trained yet this week: there is no card (week-card.ts)
  if (!hasWeekToShare(weekProgress(logs, 0, today).minutes)) return null;
  return {
    card: weekCard({
      fullName: viewer.profile.full_name,
      logs,
      target: tracker.target_minutes ?? 0,
      today,
      gym: tracksGym(tracker.grade),
    }),
    text: shareText("week", link),
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

// One player's profile, for the phone. Who may be sent one is the
// website's own rule (profileFor: the player, their friends, the coaches;
// a block either way closes it), and so is which photos come with it.
// Added here: whether each of their clubs is one the caller is in too (its
// page opens only for its members), and the words for the level.
export async function appProfileFor(viewer: Viewer, target: string, today: string): Promise<AppProfile | null> {
  const id = target === "me" ? viewer.profile.id : target;
  const admin = createServiceClient();
  const [p, mine] = await Promise.all([
    profileFor(viewer, id, today),
    admin ? clubIdsOf(admin, viewer.profile.id) : Promise.resolve([] as string[]),
  ]);
  if (!p) return null;
  const myClubs = new Set(mine);
  return {
    id: p.id,
    name: p.name,
    first: firstNameOf(p.name),
    initials: p.initials,
    photo: p.photo,
    username: p.username ?? null,
    starred: p.starred,
    you: p.you,
    friend: p.friend,
    level: p.levelName,
    playingFor: p.playingFor,
    aura: { level: p.aura.level, label: auraLabel(p.aura.level), progress: p.aura.progress, next: p.you ? auraNextLine(p.aura) : null },
    weekMinutes: p.weekMinutes,
    allMinutes: p.allMinutes,
    clubs: p.clubs.map((c) => ({ id: c.id, name: c.name, mine: myClubs.has(c.id) })),
    posts: p.posts.map((g) => ({ id: g.id, day: g.day, minutes: g.minutes, kind: g.kind, photoUrl: g.photoUrl })),
    propsPost: p.propsPost,
  };
}

// The players the caller has blocked, so a block can be taken back.
export async function appBlockedFor(viewer: Viewer): Promise<AppBlocked> {
  return { blocked: await blockedFor(viewer) };
}
