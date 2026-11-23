"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "./session";
import { cancelSubscriptions, memberTier } from "./pro-server";
import { isPro } from "./tiers";

// "Cancel Strive Pro", from the Account page (074). No more charges; the
// membership runs to the end of the month already paid for, and Stripe's
// own update then switches access off (the webhook). Only the signed-in
// member's own subscription, found from the session, never from the form.
export async function cancelMyPro(
  _prev: { done: boolean; error: string | null; endsAt: string | null },
  _form: FormData
): Promise<{ done: boolean; error: string | null; endsAt: string | null }> {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || !viewer.playerId) {
    return { done: false, error: "Sign in first.", endsAt: null };
  }
  if (!isPro(await memberTier(viewer.playerId))) {
    return { done: false, error: "This account is not a Strive Pro account.", endsAt: null };
  }
  const res = await cancelSubscriptions(viewer.profile.id, "period_end");
  if (!res.ok) {
    return {
      done: false,
      error: "We couldn't cancel it from here. Email us and we will cancel it the same day.",
      endsAt: null,
    };
  }
  revalidatePath("/account");
  return { done: true, error: null, endsAt: res.endsAt };
}
