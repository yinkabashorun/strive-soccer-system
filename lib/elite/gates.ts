// The screens a member sees instead of the app, as pure rules (App Store
// punch list, A12). Each one says what is happening and what happens
// next, in plain words, and never leaves the member with nothing to do.
import type { SubscriptionStatus } from "./types";

export type GateCopy = {
  title: string;
  body: string;
  // Offer the coach's email as the next step.
  emailCoach: boolean;
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
