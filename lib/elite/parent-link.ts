// SEND TO A PARENT (Nov 24 2026, the second referral loop; the first is
// lib/elite/squad-pass.ts).
//
// The player is 13 to 17 and is not the one who pays. Until now the only
// way to start the paid membership was a card form in the player's own
// hands. So wherever the player meets the price there is a second button,
// "Send to a parent": it shares one link, by text, to a page made for the
// parent. The page says in plain words what their player asked for and
// what it costs, the parent agrees as the parent, and pays there. The
// player's app turns on by itself.
//
// The link is the player's own and nothing else: a long random code kept
// on their free account (migration 086). The
// page shows the player's first name and what their first week goes after,
// which is what the player chose to send. It never signs anyone in.
//
// Pure: the words and the shapes. Tested in tests/parent-link.test.ts.
import { TIER_LABEL } from "./tiers";

const PRO_PRODUCT_NAME = TIER_LABEL.pro;

export const PARENT_PATH = "/pro/for";
export const PARENT_CODE = /^[a-z2-7]{26}$/;

export function cleanParentCode(raw: unknown): string | null {
  return typeof raw === "string" && PARENT_CODE.test(raw) ? raw : null;
}

export function parentPath(code: string): string {
  return `${PARENT_PATH}/${code}`;
}

export function parentLink(appUrl: string, code: string): string {
  return `${appUrl.replace(/\/+$/, "")}${parentPath(code)}`;
}

// The button in the player's hands, and the text it sends.
export const PARENT_SEND = "Send to a parent";
export function parentShareText(link: string): string {
  return `Can you look at this for me? It is the soccer training I want to do. ${link}`;
}

// The parent's page.
export function parentHeadline(first: string): string {
  return `${first} asked for ${PRO_PRODUCT_NAME}.`;
}
// The proof a parent can check: the training their player has already
// logged on their own this week (gym time is not training time and is
// left out, the free app's own rule). Nothing logged says nothing.
export function parentProofLine(first: string, minutes: number, duration: string): string | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return `${first} has already logged ${duration} of training on their own this week.`;
}

export const PARENT_WHAT = [
  "A new week of training every Monday, built around your player.",
  "One drill at a time, each with a video of how to do it.",
  "Every session is timed, so you can see the work your player really put in.",
  "Cancel anytime, in the app.",
] as const;
export const PARENT_GUARDIAN = "I am this player's parent or legal guardian.";
export const PARENT_TERMS_LEAD = "I agree to the";
export function parentStart(first: string): string {
  return `Start ${first}'s membership`;
}
export const PARENT_NOT_FOUND = "This link does not open anything. Ask your player to send it again.";
export const PARENT_ALREADY_ON = "This membership is already on. There is nothing to pay.";
export const PARENT_NEEDS_BOXES = "Tick both boxes and type your name to continue.";
export const PARENT_DONE = {
  paid: "The membership is on. Your player can open Strive now: their first week is built around them.",
  confirming: "Your payment is being confirmed. Your player's membership turns on by itself in a moment.",
  nothing: "Nothing was started and no charge was made.",
} as const;
