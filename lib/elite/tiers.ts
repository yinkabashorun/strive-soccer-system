// What each membership sees, as ONE pure rule (029, 074).
//
// Every screen, card, button and server action that differs by offer asks
// featureOn(tier, feature). No other file compares a tier string, so a new
// offer or a change to what an offer includes is one edit here, held by
// tests/pro.test.ts.
//
//   elite     the app: the weekly plan, the coach chat, Send a clip, the
//             progress video, the Film Room and the monthly check-in.
//   complete  (retired, kept as it was) all of Elite plus the monthly film
//             timeline, the weekly 1:1 calls card and the parent report.
//   pro       (Nov 20 2026, $29 a month) the weekly plan built from their
//             answers and how their training goes, the session player and
//             timer, Extra work, the weekly check-in that feeds the next
//             week, and the courses. None of the coach's own time.
//
// A row with no tier (demo data, rows from before 029) reads as complete,
// which is what the code did before tiers existed.
import type { MembershipTier } from "./types";

export type Feature =
  | "filmRoom" // the Film tab: the weekly Film Room, its clips, the games
  | "filmTimeline" // the monthly film breakdown timeline
  | "coachChat" // the Coach tab, messages both ways, the coach's note on Home
  | "monthlyCheckin" // booking the monthly 1:1 check-in call
  | "coachingCalls" // the weekly 1:1 coaching calls card
  | "sendClip" // Send a clip on a drill
  | "progressVideo" // the bi-weekly progress video
  | "parentReport" // the weekly parent report text and email
  | "program"; // the 3-month program (065)

export const FEATURES: readonly Feature[] = [
  "filmRoom",
  "filmTimeline",
  "coachChat",
  "monthlyCheckin",
  "coachingCalls",
  "sendClip",
  "progressVideo",
  "parentReport",
  "program",
];

const COMPLETE_ONLY: ReadonlySet<Feature> = new Set(["filmTimeline", "coachingCalls", "parentReport"]);

export function tierOf(raw: unknown): MembershipTier {
  return raw === "elite" || raw === "pro" || raw === "complete" ? raw : "complete";
}

export function featureOn(tier: MembershipTier | string | null | undefined, feature: Feature): boolean {
  const t = tierOf(tier);
  if (t === "complete") return true;
  if (t === "elite") return !COMPLETE_ONLY.has(feature);
  // pro: none of the features above, which are all the coach's own time
  return false;
}

export function isPro(tier: MembershipTier | string | null | undefined): boolean {
  return tierOf(tier) === "pro";
}

// The member tabs a feature switches off. A tab not listed here is on for
// every member (Home, Training, Courses).
const TAB_FEATURE: Record<string, Feature> = {
  "/film": "filmRoom",
  "/messages": "coachChat",
};

export function tabOn(tier: MembershipTier | string | null | undefined, href: string): boolean {
  const feature = TAB_FEATURE[href];
  return feature ? featureOn(tier, feature) : true;
}

// The line a server action answers with when a member's offer does not
// include what they tried (a stale page, a hand-made request).
export const NOT_IN_PLAN_MESSAGE = "That is not part of your membership.";

// How an offer is named on the coach side.
export const TIER_LABEL: Record<MembershipTier, string> = {
  elite: "Strive Elite",
  complete: "Complete Pathway",
  pro: "Strive Pro",
};

// The small chip on a roster card and the player page, or null for none
// (Strive Elite is the default and carries no chip).
export function tierChip(tier: MembershipTier | string | null | undefined): string | null {
  if (tier === "complete") return "Complete";
  if (tier === "pro") return "Pro";
  return null;
}
