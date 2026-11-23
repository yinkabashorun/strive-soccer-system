// Strive Pro (Nov 20 2026): the pure rules. The low-ticket membership,
// paid by card, no invite code: sign up, pay, take the quiz (the existing
// onboarding), and the hourly plan builder gives week 1 within the hour.
//
// THE PRICE IS ONE NUMBER. Change PRO_MONTHLY_CENTS and every page, the
// checkout and the tests follow. Coach Yinka's number, Nov 18 2026.
import type Stripe from "stripe";
import { GUARDIAN_STATEMENT } from "./legal";
import { FREE_AGE_STATEMENT, FREE_MIN_AGE, ageFromBirth, type Birth } from "./tracker";

export const PRO_MONTHLY_CENTS = 2900;
export const PRO_CURRENCY = "usd";
export const PRO_PRODUCT_NAME = "Strive Pro";

// "$29": whole dollars drop the cents, anything else keeps them.
export function priceLabel(cents: number = PRO_MONTHLY_CENTS): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export const PRO_PRICE_LINE = `${priceLabel()} a month`;

// Where things live.
export const PRO_PAGE = "/pro";
export const PRO_JOIN = "/pro/join";
export const PRO_AFTER_PAYMENT = "/onboarding"; // the quiz, then Home
export const PRO_SESSION_PARAM = "session_id";
export const PRO_PLAN = "pro"; // the checkout's metadata.plan

// ---- Copy ---------------------------------------------------------------

export const PAYMENTS_OFF_MESSAGE =
  "Payments are not switched on yet, so Strive Pro cannot be started today. Check back soon.";

export const PRO_ALREADY_ACTIVE_MESSAGE = "Your Strive Pro membership is already on.";

export const PRO_FREE_ACCOUNT_MESSAGE =
  "This email already has a free training log account, so it cannot also become a Strive Pro account. Use a different email, or email us and we will sort it out.";

export const PRO_EMAIL_EXISTS_MESSAGE = "An account with that email already exists. Sign in instead.";

// What a member who has not paid, or whose membership ended, sees in place
// of the app (lib/elite/gates.ts reads these).
export const PRO_UNPAID_GATE = {
  title: "One step left",
  body: "Your account is ready. Start your Strive Pro membership, answer a few questions about your game, and your first week is built around your answers.",
};

export const PRO_ENDED_GATE = {
  title: "Strive Pro is off",
  body: "Your membership is not active right now. Everything you trained is saved. Start it again and pick up right where you left off.",
};

// ---- Who agrees at sign-up ----------------------------------------------

// ONE rule, from the player's birth month and year (asked first):
//   13 or older: the person signing up ticks "I am 13 or older." (the
//     free app's box), with the line that anyone under 18 should go over
//     the terms with a parent. A parent signing up a 14 year old can tick
//     it truthfully too.
//   under 13: only a parent or guardian signs up, with the members' box.
export function proAgeStatement(birth: Birth, today: string): string {
  return ageFromBirth(birth, today) >= FREE_MIN_AGE ? FREE_AGE_STATEMENT : GUARDIAN_STATEMENT;
}

export const PRO_UNDER_13_LINE = "The player is under 13, so a parent or guardian creates this account.";
export const PRO_UNDER_18_LINE = "Under 18? A parent or guardian should review these terms with you.";

// What the agreement covers, above the two boxes. Written so it reads
// right to a player or a parent. The second line is the Privacy Policy's
// own wording (the members' agreement uses it, lib/elite/legal.ts).
export const PRO_AGREEMENT_POINTS: string[] = [
  "We store the player's profile, quiz answers and training to build each week.",
  "Some of that information is handled by the service providers named in the Privacy Policy, including automated tools that help our coaches prepare training plans. Payments are handled by Stripe.",
  `Strive Pro is ${PRO_PRICE_LINE}, charged every month until you cancel. Cancel anytime from Account.`,
  "We text the number you give us about training. Message and data rates may apply. Reply STOP to any text to end them.",
];

// ---- Checkout -------------------------------------------------------------

// The Checkout Session for one signed-in Pro member. Pure, so the price,
// the plan tag and where the member lands are held by a test. The price is
// written inline (price_data), so no Price ID has to be set anywhere.
export function proCheckoutParams(input: {
  profileId: string;
  email: string;
  appUrl: string;
  customerId?: string | null;
}): Stripe.Checkout.SessionCreateParams {
  const base = input.appUrl.replace(/\/+$/, "");
  return {
    mode: "subscription",
    client_reference_id: input.profileId,
    metadata: { plan: PRO_PLAN, profile_id: input.profileId },
    subscription_data: { metadata: { plan: PRO_PLAN, profile_id: input.profileId } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: PRO_CURRENCY,
          unit_amount: PRO_MONTHLY_CENTS,
          recurring: { interval: "month" },
          product_data: { name: PRO_PRODUCT_NAME },
        },
      },
    ],
    ...(input.customerId ? { customer: input.customerId } : { customer_email: input.email }),
    // Stripe fills in {CHECKOUT_SESSION_ID}; the quiz page reads it to
    // switch the membership on if the webhook has not landed yet.
    success_url: `${base}${PRO_AFTER_PAYMENT}?${PRO_SESSION_PARAM}={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}${PRO_PAGE}`,
  };
}

// ---- The webhook ------------------------------------------------------------

// A finished checkout that should switch a Pro membership on: the profile
// it belongs to, or null when it is not one of ours. The profile comes
// from what our own server put on the session; when both places carry it
// they must agree.
export function proActivation(session: {
  mode?: string | null;
  payment_status?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
}): { profileId: string } | null {
  if (session.metadata?.plan !== PRO_PLAN) return null;
  if (session.mode !== "subscription") return null;
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return null;
  const ref = session.client_reference_id ?? null;
  const meta = session.metadata?.profile_id ?? null;
  if (ref && meta && ref !== meta) return null;
  const profileId = ref ?? meta;
  if (!profileId || !/^[0-9a-f-]{36}$/i.test(profileId)) return null;
  return { profileId };
}

// What a subscription change does to a Pro member's access. Only a
// subscription that is running (active, trialing) or over (canceled)
// changes it. A first "incomplete" event that lands after the checkout
// already switched the member on, and a card that failed once (past_due,
// Stripe retries it), leave access as it is: null.
export function proAccessFor(stripeStatus: string, deleted: boolean): "active" | "trialing" | "canceled" | null {
  if (deleted) return "canceled";
  if (stripeStatus === "active" || stripeStatus === "trialing") return stripeStatus;
  if (stripeStatus === "canceled" || stripeStatus === "unpaid" || stripeStatus === "incomplete_expired") return "canceled";
  return null;
}
