// A free account starts a membership (Nov 24 2026). The one path from the
// free app to Strive Pro, on the server:
//
//   1. the account's own member row is made, once: the same row the
//      website's Strive Pro sign-up makes (createProMember: tier pro,
//      status "none"), from what the free account already gave us (its
//      name, its age from its birthday, its email and phone). Tapping
//      Start again reuses that row; there is never a second one.
//   2. the card checkout is opened for it (openProCheckout), and which
//      checkout it was is kept on the free account's row.
//   3. paying is what switches the membership on: the Stripe webhook, the
//      page the checkout comes back to, or the app asking when the sheet
//      closes (confirmUpgrade). All three end in activateProCheckout, so
//      whichever arrives first does it and the others change nothing.
//
// A checkout that is closed without paying changes nothing the player can
// see: the member row stays at "none", and an account with a free training
// log and a Strive Pro row that is not on is still a free account
// (lib/elite/member-gate.ts livesInFreeApp).
//
// The quiz is not asked again: when the membership is on, the member's
// intake is filled from the stored answers (memberAnswersFor), and only
// the screens a free account was never shown are asked.
import { createServiceClient } from "./supabase/server";
import { isStripeConfigured } from "@/lib/stripe";
import { recordConsent } from "./legal-server";
import { nyToday } from "./time";
import { ageFromBirth, cleanBirth } from "./tracker";
import { PAYMENTS_OFF_MESSAGE } from "./pro";
import { confirmProSession, createProMember, openProCheckout } from "./pro-server";
import { readIntake, setUpgradeCheckout } from "./free-intake-server";
import { memberAnswersFrom } from "./free-intake";
import { getTracker, type Tracker } from "./tracker-server";
import { UPGRADE_FAILED, UPGRADE_NEEDS_QUIZ, UPGRADE_NOT_FREE } from "./offer";
import { isPro } from "./tiers";
import type { QuizAnswers } from "./quiz";
import type { Viewer } from "./session";

// The age a membership starts with: from the birth month and year the
// free account gave at sign-up. Null when it gave none.
export function ageOf(tracker: Pick<Tracker, "birth_month" | "birth_year">, today: string): number | null {
  const birth = cleanBirth({ month: tracker.birth_month, year: tracker.birth_year }, today);
  return birth ? ageFromBirth(birth, today) : null;
}

export type UpgradeStart = { ok: true; url: string } | { ok: false; error: string; status: number };

export async function startProFromFree(viewer: Viewer, userAgent: string | null): Promise<UpgradeStart> {
  if (!isStripeConfigured()) return { ok: false, error: PAYMENTS_OFF_MESSAGE, status: 503 };
  const admin = createServiceClient();
  if (!admin) return { ok: false, error: PAYMENTS_OFF_MESSAGE, status: 503 };
  const profileId = viewer.profile.id;
  const [tracker, intake] = await Promise.all([getTracker(profileId), readIntake(profileId)]);
  if (!tracker || !intake.answers) return { ok: false, error: UPGRADE_NEEDS_QUIZ, status: 409 };

  // the account's own member row: the one it has, or a new one
  const ownRow = async () => {
    const { data } = await admin.from("elite_players").select("id, tier").eq("profile_id", profileId).maybeSingle();
    return (data as { id: string; tier: string | null } | null) ?? null;
  };
  let row = await ownRow();
  if (row && !isPro(row.tier)) return { ok: false, error: UPGRADE_NOT_FREE, status: 409 };
  if (!row) {
    const made = await createProMember(admin, {
      profileId,
      fullName: viewer.profile.full_name,
      age: ageOf(tracker, nyToday()) ?? 0,
      email: viewer.profile.email,
      phone: tracker.phone ?? "",
    });
    row = made ? await ownRow() : null;
    if (!row) return { ok: false, error: UPGRADE_FAILED, status: 500 };
  }
  const playerId = row.id;

  // Starting is agreeing to the Terms and the Privacy Policy as they stand
  // (the line under the button says so); recorded like every acceptance.
  await recordConsent({ profileId, source: "in_app", userAgent }).catch(() => false);

  const checkout = await openProCheckout({ profileId, playerId, email: viewer.profile.email, returnTo: "app" });
  if (!checkout.ok) return { ok: false, error: checkout.error, status: checkout.status };
  await setUpgradeCheckout(profileId, checkout.sessionId).catch(() => undefined);
  return { ok: true, url: checkout.url };
}

// The checkout's sheet closed. Ask Stripe about the checkout this account
// last opened; a paid one switches the membership on now, so nobody waits
// on the webhook to see what they just paid for.
export async function confirmUpgrade(profileId: string): Promise<{ active: boolean }> {
  const intake = await readIntake(profileId);
  if (!intake.checkout) return { active: false };
  return { active: await confirmProSession(intake.checkout) };
}

// The member quiz's answers this account already gave as a free account
// (its age from its birthday), or null when it never took the quiz.
export async function memberAnswersFor(profileId: string): Promise<QuizAnswers | null> {
  const [tracker, intake] = await Promise.all([getTracker(profileId).catch(() => null), readIntake(profileId).catch(() => null)]);
  if (!tracker || !intake?.answers) return null;
  return memberAnswersFrom(intake.answers, ageOf(tracker, nyToday()));
}
