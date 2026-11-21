// The screens a member sees instead of the app, as pure rules (App Store
// punch list, A12). Each one says what is happening and what happens
// next, in plain words, and never leaves the member with nothing to do.
import type { MembershipTier, SubscriptionStatus } from "./types";
import { PRO_ENDED_GATE, PRO_UNPAID_GATE } from "./pro";
import { isPro } from "./tiers";

export type GateCopy = {
  title: string;
  body: string;
  // Offer the coach's email as the next step.
  emailCoach: boolean;
  // Strive Pro (074): the next step is starting the membership, a button
  // that opens the card checkout. Never on the Elite screens.
  startPro?: boolean;
};

// A signed-in player whose profile the coach has not set up yet.
export const NO_PROFILE_GATE: GateCopy = {
  title: "Almost there",
  body: "Your coach is setting up your profile. Your first week shows up here the moment it is ready.",
  emailCoach: false,
};

// Who gets into the app: an active or trialing membership. Everyone else
// sees one of two screens, and they are different on purpose:
//   - never switched on ("none"): a family that has just signed up. The
//     coach switches the membership on from their side. Calling that
//     "paused" told a brand-new family something had gone wrong.
//   - switched off (paused by the coach, or lapsed): nothing is lost, and
//     the coach is the way back in.
export function membershipGate(status: SubscriptionStatus | string | null | undefined): GateCopy | null {
  if (status === "active" || status === "trialing") return null;
  if (!status || status === "none") {
    return {
      title: "One step left",
      body: "Your profile is saved. Your coach switches your membership on from their side, and then your first week shows up here. If you have been waiting more than a day, email your coach.",
      emailCoach: true,
    };
  }
  return {
    title: "Membership paused",
    body: "Your Strive Elite membership is not active right now. Everything you have trained is saved. Email your coach to switch it back on and pick up right where you left off.",
    emailCoach: true,
  };
}

// A Strive Pro member (074) pays by card, so there is no coach to switch
// the membership on: the screen offers the checkout instead. Same two
// cases as above: never started, and switched off (cancelled, lapsed).
export function proMembershipGate(status: SubscriptionStatus | string | null | undefined): GateCopy | null {
  if (status === "active" || status === "trialing") return null;
  const copy = !status || status === "none" ? PRO_UNPAID_GATE : PRO_ENDED_GATE;
  return { ...copy, emailCoach: false, startPro: true };
}

// The one entry point the member shell uses: the right screen for the
// member's offer and status, or null to let them in.
export function gateFor(
  status: SubscriptionStatus | string | null | undefined,
  tier: MembershipTier | string | null | undefined
): GateCopy | null {
  return isPro(tier) ? proMembershipGate(status) : membershipGate(status);
}
