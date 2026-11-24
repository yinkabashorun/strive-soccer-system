// The offer a free account sees after the quiz (Nov 24 2026): every word
// of it, in one place, so it can be read and changed without opening a
// screen. The iPhone app draws exactly what it is handed (AppOffer); it
// writes no word of the offer and no price itself.
//
// THE PRODUCT'S NAME IS ONE CONSTANT. Rename OFFER_PRODUCT and the button,
// the terms line and the payments-off line follow. The price is the one
// number in lib/elite/pro.ts.
//
// What it must stay: TRUE. Nothing is built for a free account, so it says
// what their first week WILL go after, named from their own lowest
// ratings, with drills the bank really holds. No guarantee, no scarcity,
// no countdown, no number that is not a count from the data.
import { PRO_PRICE_LINE, PRO_PRODUCT_NAME } from "./pro";
import { cardTierLabel } from "./experience";
import { areasPhrase } from "./free-intake";

export const OFFER_PRODUCT = PRO_PRODUCT_NAME;

// The tier on the card they would carry.
export const OFFER_CARD_TIER = cardTierLabel("pro");

// "Marcus, your first week goes after your weak foot and first touch."
// With no area to name (no ratings the filmed bank can train), it says
// the plain thing instead.
export function offerHeadline(firstName: string, areas: readonly string[]): string {
  const what = areasPhrase(areas);
  const who = firstName.trim();
  if (!what) return who ? `${who}, your first week is built around what you told us.` : "Your first week is built around what you told us.";
  return who ? `${who}, your first week goes after ${what}.` : `Your first week goes after ${what}.`;
}

export const OFFER_DRILLS_LABEL = "Drills like these";

export const OFFER_GETS: readonly string[] = [
  "A new week every Monday, built around what you told us.",
  "One drill at a time, with the video.",
  "Every course is included.",
];

export const OFFER_PRICE = `${PRO_PRICE_LINE}. Cancel anytime.`;
export const OFFER_START = `Start ${OFFER_PRODUCT}`;
// Right after the quiz the other choice is the free app; opened later from
// inside the free app, it is simply going back.
export const OFFER_LATER_FIRST = "Not now, start free";
export const OFFER_LATER = "Not now";
// The one line under the buttons: what starting means, in plain words.
export const OFFER_TERMS = `${OFFER_PRODUCT} is ${PRO_PRICE_LINE}, charged every month until you cancel. By starting you agree to the Terms of Service and the Privacy Policy.`;

// ---- What the server answers when a start cannot go ahead ---------------
export const UPGRADE_NEEDS_QUIZ = "Answer the quiz first, then start your membership.";
export const UPGRADE_NOT_FREE = "This account already has a membership.";
export const UPGRADE_FAILED = "We couldn't start your membership. Try again in a minute.";
