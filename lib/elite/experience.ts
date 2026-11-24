// The member experience (Nov 21 2026, marketing/app-redesign/experience.md):
// the pure rules behind the door, the count-in, the Monday drop, the tabs,
// the member card and the words that name a player's own weak spot.
//
// Everything a screen decides about these moments is decided here, so the
// rule can be tested and no screen can drift from another. Nothing here
// counts what was missed: no streaks, no misses, no percentages (Oct 12
// rule, docs/product-principles.md).
import type { Homework, MembershipTier } from "./types";
import { drillKind } from "./session-flow";
import { creditedMinutes } from "./time-trained";
import { MILESTONE_HOURS } from "./session-flow";
import { tabOn, tierOf } from "./tiers";
import { drillPoster } from "./drill-poster";

const NY = "America/New_York";

// ---------------------------------------------------------------------
// The tabs. Four for Strive Pro (Home, Week, Courses, You); a member whose
// offer includes the coach chat gets Coach before You. Film Room is a card
// on Home and a link on the Coach screen, never a tab of its own. The
// routes are the ones that already exist: Week is /homework.
// ---------------------------------------------------------------------
export type MemberTab = { href: string; label: string; icon: "home" | "week" | "courses" | "coach" | "you" | "friends" };

export const HOME_TAB: MemberTab = { href: "/dashboard", label: "Home", icon: "home" };
export const WEEK_TAB: MemberTab = { href: "/homework", label: "Week", icon: "week" };
export const COURSES_TAB: MemberTab = { href: "/courses", label: "Courses", icon: "courses" };
export const COACH_TAB: MemberTab = { href: "/messages", label: "Coach", icon: "coach" };
export const YOU_TAB: MemberTab = { href: "/you", label: "You", icon: "you" };

// ONE APP on the website (lib/elite/one-app.ts): a member who came through
// the free app keeps it. Their member pages carry a Friends tab that opens
// the free pages (Friends, My week, their clubs), and those pages carry a
// Train tab back (components/elite/FreeShell.tsx). Strive Pro adds; it
// never takes the free pages away.
export const FRIENDS_TAB: MemberTab = { href: "/log", label: "Friends", icon: "friends" };

export function memberTabs(tier: MembershipTier | string | null | undefined, social = false): MemberTab[] {
  const tabs = social ? [HOME_TAB, FRIENDS_TAB, WEEK_TAB, COURSES_TAB] : [HOME_TAB, WEEK_TAB, COURSES_TAB];
  if (tabOn(tier, COACH_TAB.href)) tabs.push(COACH_TAB);
  tabs.push(YOU_TAB);
  return tabs;
}

// Which tab a page belongs to. The pages one tap below a tab (a course,
// Progress, the Film Room) keep their tab lit.
export function activeTab(pathname: string | null | undefined, tabs: MemberTab[]): string | null {
  const p = pathname ?? "";
  if (p.startsWith("/progress")) return YOU_TAB.href;
  if (p.startsWith("/film")) return tabs.some((t) => t.href === COACH_TAB.href) ? COACH_TAB.href : HOME_TAB.href;
  const hit = tabs.find((t) => p === t.href || p.startsWith(t.href + "/"));
  return hit ? hit.href : null;
}

// ---------------------------------------------------------------------
// The member card: the Strive Elite wordmark, their name, member since,
// the tier. No member number (it would be a number we have to keep true).
// ---------------------------------------------------------------------
export function memberSinceLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: NY });
  const year = d.toLocaleDateString("en-US", { year: "numeric", timeZone: NY });
  return `Member since ${month} ${year}`;
}

export function cardTierLabel(tier: MembershipTier | string | null | undefined): string {
  const t = tierOf(tier);
  return t === "pro" ? "Pro" : t === "complete" ? "Complete" : "Elite";
}

// "Marcus Bryant" -> "Marcus B." The card and the You header carry the
// first name and an initial, the way the approved mock does.
export function cardName(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// ---------------------------------------------------------------------
// The count-in: "Grab your ball", then 3, 2, 1, a tap felt on each number.
// It runs only when a session is started from its first drill with nothing
// done yet; a tap anywhere skips straight to the first drill.
// ---------------------------------------------------------------------
export const COUNT_IN = [3, 2, 1] as const;
export const COUNT_IN_INTRO_MS = 900; // the session's name before the 3
export const COUNT_IN_STEP_MS = 800;

export type CountInState = "intro" | 3 | 2 | 1 | "go";

export function countInWanted(drills: Pick<Homework, "id" | "completed">[], doneIds: Record<string, boolean | undefined>, startIndex: number): boolean {
  if (drills.length === 0 || startIndex !== 0) return false;
  return drills.every((d) => !(doneIds[d.id] ?? d.completed));
}

export function countInNext(state: CountInState, event: "tick" | "tap"): CountInState {
  if (event === "tap") return "go";
  if (state === "intro") return 3;
  if (state === 3) return 2;
  if (state === 2) return 1;
  return "go";
}

// ---------------------------------------------------------------------
// The building screen, after the quiz. It waits for the real build and
// then says plainly where the week is; it never shows a finished week that
// was not built (lib/elite/first-week-actions.ts).
//   live     built and open now: the drop follows
//   monday   built and held to Monday (a quiz finished on a Sunday)
//   waiting  not built yet (still building, or the wait ran out): the
//            hourly builder has it within the hour
//   off      the membership is not switched on yet, so nothing builds
// ---------------------------------------------------------------------
export type FirstWeekStatus = "live" | "monday" | "waiting" | "off";

export function firstWeekStatus(i: { active: boolean; built: boolean; week1Monday: string | null | undefined; today: string }): FirstWeekStatus {
  if (!i.active) return "off";
  if (!i.built) return "waiting";
  if (i.week1Monday && i.week1Monday > i.today) return "monday";
  return "live";
}

export const FIRST_WEEK_LINE: Record<Exclude<FirstWeekStatus, "live">, { title: string; body: string }> = {
  monday: { title: "Your first week starts Monday.", body: "It is built and waiting. It opens Monday morning, and we'll text you when it does." },
  waiting: { title: "Your week lands within the hour.", body: "We'll text you the moment it is ready." },
  off: { title: "Your answers are in.", body: "Your coach switches your membership on, then your first week lands within the hour." },
};

// How long the building screen waits for the build before it says so.
export const FIRST_WEEK_WAIT_MS = 45_000;

// ---------------------------------------------------------------------
// The drop: "Your week is here." shown once per new week, the first time
// the week is opened and before anything in it is done. Which week was
// last shown lives on the phone (a per-viewer convenience, never a record).
// ---------------------------------------------------------------------
export const DROP_SEEN_PREFIX = "strive_drop_seen:";

export function dropSeenKey(playerId: string): string {
  return DROP_SEEN_PREFIX + playerId;
}

export function parseSeenWeek(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function dropDue(i: { seenWeek: number | null; week: number; sessions: number; anyDone: boolean }): boolean {
  if (i.sessions <= 0 || i.anyDone) return false;
  return i.seenWeek === null || i.seenWeek < i.week;
}

// ---------------------------------------------------------------------
// Their own weak spot, in their own words. The quiz stores the tile's name
// as the first weakness ("Weak foot"); a typed one reads as written when
// it is short enough to sit in a line.
// ---------------------------------------------------------------------
export function weakSpotPhrase(weaknesses: string[] | null | undefined): string | null {
  const first = (weaknesses ?? []).map((w) => w.trim()).find(Boolean);
  if (!first || first.length > 28) return null;
  const lower = first.toLowerCase();
  const plain = lower.startsWith("my ") ? lower.slice(3) : lower;
  // "1v1 moves" stays as written; everything else reads lower case.
  return `your ${plain}`;
}

// ---------------------------------------------------------------------
// The session's headline on Home: the two areas most of its drills work,
// "Weak foot and ball mastery", from the pillar each drill is filed under.
// null when the drills carry no pillar (the card then says the plain
// "Today's session").
// ---------------------------------------------------------------------
const PILLAR_WORDS: Record<string, string> = {
  "Weak Foot": "weak foot",
  "Ball Mastery": "ball mastery",
  Passing: "passing",
  Confidence: "1v1 moves",
  Scanning: "scanning",
  "Decision Making": "decisions",
  Speed: "speed",
  Shooting: "shooting",
};

export function sessionHeadline(list: Pick<Homework, "title" | "pillar">[]): string | null {
  const order: string[] = [];
  const count = new Map<string, number>();
  for (const h of list) {
    if (drillKind(h.title) !== "skill" || !h.pillar) continue;
    const word = PILLAR_WORDS[h.pillar] ?? h.pillar.toLowerCase();
    if (!count.has(word)) order.push(word);
    count.set(word, (count.get(word) ?? 0) + 1);
  }
  if (order.length === 0) return null;
  const top = [...order].sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0) || order.indexOf(a) - order.indexOf(b)).slice(0, 2);
  const words = top.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const line = words.join(" and ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

// The picture on a session's card: the still of its first skill drill, else
// of any drill in it, else none (the card is then plain black). Only ever
// Strive's own footage (lib/elite/drill-poster.ts).
export function sessionImage(list: Pick<Homework, "title" | "video_url">[]): string | null {
  const skill = list.filter((h) => drillKind(h.title) === "skill");
  for (const h of [...skill, ...list]) {
    const p = drillPoster(h.video_url);
    if (p) return p;
  }
  return null;
}

// ---------------------------------------------------------------------
// The next hours medal and how far away it is ("5 hours trained, 18
// minutes away"). Hours trained only ever go up, so this is always a
// distance still to cover, never something lost.
// ---------------------------------------------------------------------
export function nextMilestone(minutes: number): { hours: number; minutesAway: number } | null {
  const m = Math.max(0, Math.round(minutes));
  const h = MILESTONE_HOURS.find((x) => x * 60 > m);
  return h === undefined ? null : { hours: h, minutesAway: h * 60 - m };
}

// The medals on You: every hours mark already reached, then the next one,
// dim, so there is always one to go for.
export function hoursMedals(minutes: number, upTo = 4): { hours: number; earned: boolean }[] {
  const earned = MILESTONE_HOURS.filter((h) => h * 60 <= minutes).map((hours) => ({ hours, earned: true }));
  const next = nextMilestone(minutes);
  const shown = earned.slice(-Math.max(0, upTo - (next ? 1 : 0)));
  return next ? [...shown, { hours: next.hours, earned: false }] : shown;
}

// ---------------------------------------------------------------------
// The weekly chart on You: minutes trained in each of the last weeks, the
// live week last. A week with nothing done is a short grey bar, never a
// mark against them.
// ---------------------------------------------------------------------
export function weeklyMinutes(rows: Pick<Homework, "week" | "completed" | "duration_min" | "actual_seconds">[], throughWeek: number, count = 7): { week: number; minutes: number }[] {
  const last = Math.max(1, throughWeek);
  const first = Math.max(1, last - count + 1);
  const out: { week: number; minutes: number }[] = [];
  for (let w = first; w <= last; w++) {
    const minutes = rows
      .filter((h) => h.week === w && h.completed)
      .reduce((s, h) => s + creditedMinutes(h), 0);
    out.push({ week: w, minutes });
  }
  return out;
}

// ---------------------------------------------------------------------
// The day at the top of Home ("Tuesday") and the short date under it.
// ---------------------------------------------------------------------
export function todayName(now = new Date()): string {
  return now.toLocaleDateString("en-US", { weekday: "long", timeZone: NY });
}

export function shortDate(now = new Date()): string {
  return now.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: NY });
}

// "Nov 23 to Nov 29" for a week that starts on the given NY Monday.
export function weekRange(monday: string | null | undefined): string | null {
  if (!monday || !/^\d{4}-\d{2}-\d{2}$/.test(monday)) return null;
  const start = new Date(monday + "T12:00:00Z");
  const end = new Date(start.getTime() + 6 * 864e5);
  const f = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${f(start)} to ${f(end)}`;
}

// The building screen's three lines (the website's quiz and the iPhone
// app). The first two are true the moment the answers are saved; the third
// ticks only when the week really is built.
export function buildingLines(weakSpot: string, sessions: string): [string, string, string] {
  return ["Reading your answers", `Picking drills for ${weakSpot}`, `Setting ${sessions} sessions`];
}

// The NY Monday a given program week starts on, from week1_monday.
export function mondayOfProgramWeek(week1Monday: string | null | undefined, week: number): string | null {
  if (!week1Monday || !/^\d{4}-\d{2}-\d{2}$/.test(week1Monday)) return null;
  const d = new Date(week1Monday + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + (Math.max(1, week) - 1) * 7);
  return d.toISOString().slice(0, 10);
}
